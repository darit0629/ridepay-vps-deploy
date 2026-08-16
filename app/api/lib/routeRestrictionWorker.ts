// Route Restriction system's periodic worker — exact skeleton copied from
// dispatchWorker.ts/schoolNightlyWorker.ts (globalThis singleton guard +
// separate re-entrancy lock + per-sub-function try/catch + MySQL-native
// NOW()/INTERVAL for all time comparisons, never a JS Date query param).

import { and, eq, or, isNull, lt, inArray, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { routeRestrictions, routeRestrictionSegments, rides, driverProfiles, scheduledRides, schoolSubscriptions } from "@db/schema";
import { getActiveRestrictionGeometries, logRestrictionEvent } from "../queries/routeRestrictions";
import { computeRestrictionAwareRoute, type ServerRestrictionGeometry } from "./googleDirectionsServer";
import { type LatLng, boundingBox, padBoundingBox, boxesOverlap } from "./routeGeometry";
import { sendPushToDrivers } from "../notification-router";

const TICK_MS = 15000;

let ticking = false;
const g = globalThis as typeof globalThis & { __routeRestrictionWorkerStarted?: boolean };

export function startRouteRestrictionWorker(): void {
  if (g.__routeRestrictionWorkerStarted) return;
  g.__routeRestrictionWorkerStarted = true;
  setInterval(() => {
    void tick();
  }, TICK_MS);
}

type RestrictionRow = typeof routeRestrictions.$inferSelect;

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await autoActivateScheduled();
  } catch (error) {
    console.error("[routeRestrictionWorker] tick failed:", error);
  }
  try {
    await autoExpireTemporary();
  } catch (error) {
    console.error("[routeRestrictionWorker] tick failed:", error);
  }

  // Computed once and shared between both sweeps below — each sweep only
  // *reads* this list; only this tick() function ever clears the dirty flag
  // (at the very end), so the two sweeps can't race each other into seeing
  // zero dirty restrictions on whichever one runs second.
  let dirty: RestrictionRow[] = [];
  try {
    dirty = await getDirtyActiveRestrictions();
  } catch (error) {
    console.error("[routeRestrictionWorker] tick failed:", error);
  }

  if (dirty.length > 0) {
    let allActive: ServerRestrictionGeometry[] = [];
    try {
      allActive = await getActiveRestrictionGeometries();
    } catch (error) {
      console.error("[routeRestrictionWorker] tick failed:", error);
    }
    try {
      await sweepAffectedRides(dirty, allActive);
    } catch (error) {
      console.error("[routeRestrictionWorker] tick failed:", error);
    }
    try {
      await sweepUpcomingScheduleImpact(dirty, allActive);
    } catch (error) {
      console.error("[routeRestrictionWorker] tick failed:", error);
    }
    try {
      await markRestrictionsChecked(dirty);
    } catch (error) {
      console.error("[routeRestrictionWorker] tick failed:", error);
    }
  }

  ticking = false;
}

async function autoActivateScheduled(): Promise<void> {
  const db = getDb();
  const due = await db
    .select()
    .from(routeRestrictions)
    .where(
      and(
        eq(routeRestrictions.isActive, false),
        isNull(routeRestrictions.unblockedAt),
        sql`${routeRestrictions.startTime} <= NOW()`,
        or(eq(routeRestrictions.isIndefinite, true), sql`${routeRestrictions.endTime} IS NULL OR ${routeRestrictions.endTime} > NOW()`)
      )
    );
  for (const restriction of due) {
    await db.update(routeRestrictions).set({ isActive: true }).where(eq(routeRestrictions.id, restriction.id));
    await logRestrictionEvent({ restrictionId: restriction.id, eventType: "activated", actor: "system", detail: "Scheduled start time reached." });
  }
}

async function autoExpireTemporary(): Promise<void> {
  const db = getDb();
  const expired = await db
    .select()
    .from(routeRestrictions)
    .where(
      and(
        eq(routeRestrictions.isActive, true),
        eq(routeRestrictions.isIndefinite, false),
        sql`${routeRestrictions.endTime} IS NOT NULL AND ${routeRestrictions.endTime} <= NOW()`
      )
    );
  for (const restriction of expired) {
    await db.update(routeRestrictions).set({ isActive: false }).where(eq(routeRestrictions.id, restriction.id));
    await logRestrictionEvent({ restrictionId: restriction.id, eventType: "auto_expired", actor: "system" });
  }
}

// Restrictions that are active and either never swept, or edited/created
// since their last sweep (updatedAt moved past lastRideCheckAt).
async function getDirtyActiveRestrictions(): Promise<RestrictionRow[]> {
  return getDb()
    .select()
    .from(routeRestrictions)
    .where(and(eq(routeRestrictions.isActive, true), or(isNull(routeRestrictions.lastRideCheckAt), lt(routeRestrictions.lastRideCheckAt, routeRestrictions.updatedAt))));
}

async function markRestrictionsChecked(dirty: RestrictionRow[]): Promise<void> {
  const db = getDb();
  for (const restriction of dirty) {
    await db.update(routeRestrictions).set({ lastRideCheckAt: sql`NOW()` }).where(eq(routeRestrictions.id, restriction.id));
  }
}

const SWEEP_BBOX_PADDING_KM = 3;
const IN_PROGRESS_STATUSES = ["accepted", "pickup", "ongoing", "waiting"] as const;

async function restrictionGeometryPoints(restriction: RestrictionRow): Promise<LatLng[]> {
  if (restriction.restrictionType === "road") {
    const roads = await getDb().query.routeRestrictionSegments.findMany({ where: eq(routeRestrictionSegments.restrictionId, restriction.id) });
    return roads.flatMap((s) => s.geometry);
  }
  return restriction.areaGeometry ?? [];
}

// Picks the origin/destination pair to check for a given in-progress ride —
// the driver's live GPS once they're actually en route (pickup/ongoing legs),
// otherwise the ride's own pickup→drop as a pre-departure static check.
async function rideCheckPoints(ride: typeof rides.$inferSelect): Promise<{ origin: LatLng; destination: LatLng } | null> {
  const pickup = { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) };
  const drop = { lat: Number(ride.dropLat), lng: Number(ride.dropLng) };

  if ((ride.status === "pickup" || ride.status === "ongoing") && ride.driverId) {
    const db = getDb();
    const profile = await db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, ride.driverId) });
    if (profile?.currentLat && profile?.currentLng) {
      const origin = { lat: Number(profile.currentLat), lng: Number(profile.currentLng) };
      return { origin, destination: ride.status === "pickup" ? pickup : drop };
    }
  }
  return { origin: pickup, destination: drop };
}

// The core live-avoidance detector: re-checks every in-progress ride near a
// restriction that's new or was just edited against ALL currently active
// restrictions (not just the one that triggered the sweep), and flags/
// notifies on a change.
async function sweepAffectedRides(dirty: RestrictionRow[], allActive: ServerRestrictionGeometry[]): Promise<void> {
  const db = getDb();
  const checkedRideIds = new Set<number>();

  for (const restriction of dirty) {
    const points = await restrictionGeometryPoints(restriction);
    if (points.length === 0) continue;

    const box = padBoundingBox(boundingBox(points), SWEEP_BBOX_PADDING_KM);
    const candidates = await db.query.rides.findMany({
      where: and(
        inArray(rides.status, IN_PROGRESS_STATUSES),
        sql`(
          (${rides.pickupLat} BETWEEN ${box.minLat} AND ${box.maxLat} AND ${rides.pickupLng} BETWEEN ${box.minLng} AND ${box.maxLng})
          OR
          (${rides.dropLat} BETWEEN ${box.minLat} AND ${box.maxLat} AND ${rides.dropLng} BETWEEN ${box.minLng} AND ${box.maxLng})
        )`
      ),
    });

    for (const ride of candidates) {
      if (checkedRideIds.has(ride.id)) continue; // already re-checked against the full active set this tick
      checkedRideIds.add(ride.id);
      await checkAndNotifyRide(ride, restriction.id, allActive);
    }
  }
}

async function checkAndNotifyRide(ride: typeof rides.$inferSelect, triggeringRestrictionId: string, allActive: ServerRestrictionGeometry[]): Promise<void> {
  const db = getDb();
  const points = await rideCheckPoints(ride);
  if (!points) return;
  const result = await computeRestrictionAwareRoute(points.origin, points.destination, allActive);

  if (result.status === "no_alternative") {
    if (ride.routeRestrictionNotice !== "no_alternative") {
      await db
        .update(rides)
        .set({ routeRestrictionNotice: "no_alternative", routeRestrictionNoticeAt: sql`NOW()` })
        .where(eq(rides.id, ride.id));
      await logRestrictionEvent({
        restrictionId: triggeringRestrictionId,
        rideId: ride.id,
        eventType: "no_alternative_route",
        detail: `Ride #${ride.id} has no alternative route avoiding the active closure(s).`,
      });
      notifyRide(ride, "no_alternative");
    }
  } else if (result.usedRestrictedRoad || (result.detourAttempts ?? 0) > 0) {
    if (ride.routeRestrictionNotice !== "rerouted") {
      await db
        .update(rides)
        .set({ routeRestrictionNotice: "rerouted", routeRestrictionNoticeAt: sql`NOW()` })
        .where(eq(rides.id, ride.id));
      await logRestrictionEvent({
        restrictionId: triggeringRestrictionId,
        rideId: ride.id,
        eventType: "ride_rerouted",
        detail: `Ride #${ride.id}'s route was updated to avoid an active closure.`,
      });
      notifyRide(ride, "rerouted");
    }
  }
}

function notifyRide(ride: typeof rides.$inferSelect, notice: "rerouted" | "no_alternative"): void {
  const driverMessage =
    notice === "rerouted"
      ? "Route Updated — Road ahead is currently blocked, we've found an alternative route."
      : "No Alternative Route — the road ahead is blocked and we couldn't find another way. Please contact support.";
  const riderMessage =
    notice === "rerouted"
      ? "Route Changed — your driver is taking an alternative route."
      : "No Alternative Route — the road ahead is blocked and we couldn't find another way. Please contact support.";

  // sendPushToDrivers works for any userId regardless of role — there's no
  // separate rider-push function in this codebase, same dual-purpose
  // convention already established at api/ride-router.ts's driver-arrived push.
  if (ride.driverId) {
    void sendPushToDrivers([ride.driverId], { title: notice === "rerouted" ? "Route Updated" : "No Alternative Route", message: driverMessage, url: "/driver/dashboard" });
  }
  void sendPushToDrivers([ride.userId], { title: notice === "rerouted" ? "Route Changed" : "No Alternative Route", message: riderMessage, url: "/user/home" });
}

// ---- Scheduled Ride / School Ride protection ------------------------------
const SCHEDULE_DELAY_THRESHOLD_MIN = 10;
// Not a precise "next occurrence within 24h" resolver for weekly/monthly
// schedules (that logic lives client-side in schedule-router.ts's checkDue
// and isn't reused here) — this proximity-checks every currently
// upcoming/active scheduled ride and approved school subscription near a
// dirty restriction's geometry, which is honest as an "estimate" the same
// way previewAffectedRides already is, not a guarantee.
async function sweepUpcomingScheduleImpact(dirty: RestrictionRow[], allActive: ServerRestrictionGeometry[]): Promise<void> {
  const db = getDb();

  for (const restriction of dirty) {
    const points = await restrictionGeometryPoints(restriction);
    if (points.length === 0) continue;
    const box = padBoundingBox(boundingBox(points), SWEEP_BBOX_PADDING_KM);

    const scheduleCandidates = await db.query.scheduledRides.findMany({
      where: and(
        inArray(scheduledRides.status, ["upcoming", "active"]),
        sql`(
          (${scheduledRides.pickupLat} BETWEEN ${box.minLat} AND ${box.maxLat} AND ${scheduledRides.pickupLng} BETWEEN ${box.minLng} AND ${box.maxLng})
          OR
          (${scheduledRides.dropLat} BETWEEN ${box.minLat} AND ${box.maxLat} AND ${scheduledRides.dropLng} BETWEEN ${box.minLng} AND ${box.maxLng})
        )`
      ),
    });
    for (const s of scheduleCandidates) {
      const origin = { lat: Number(s.pickupLat), lng: Number(s.pickupLng) };
      const destination = { lat: Number(s.dropLat), lng: Number(s.dropLng) };
      await flagIfDelayed(restriction.id, `Scheduled Ride${s.label ? ` "${s.label}"` : ` #${s.id}`}`, origin, destination, allActive);
    }

    const schoolCandidates = await db.query.schoolSubscriptions.findMany({ where: eq(schoolSubscriptions.status, "approved") });
    const nearbySchool = schoolCandidates.filter((sub) => boxesOverlap(box, boundingBox([sub.pickupCoords, sub.dropCoords])));
    for (const sub of nearbySchool) {
      await flagIfDelayed(restriction.id, `School Ride for ${sub.studentName}`, sub.pickupCoords, sub.dropCoords, allActive);
    }
  }
}

async function flagIfDelayed(restrictionId: string, label: string, origin: LatLng, destination: LatLng, allActive: ServerRestrictionGeometry[]): Promise<void> {
  const [normal, restricted] = await Promise.all([
    computeRestrictionAwareRoute(origin, destination, []),
    computeRestrictionAwareRoute(origin, destination, allActive),
  ]);

  if (restricted.status === "no_alternative") {
    await logRestrictionEvent({
      restrictionId,
      eventType: "scheduled_ride_delay_flagged",
      detail: `⚠️ ${label} affected — no alternative route currently avoids this closure.`,
    });
    return;
  }
  if (normal.durationMin === undefined || restricted.durationMin === undefined) return;

  const diff = Math.round(restricted.durationMin - normal.durationMin);
  if (diff >= SCHEDULE_DELAY_THRESHOLD_MIN) {
    await logRestrictionEvent({
      restrictionId,
      eventType: "scheduled_ride_delay_flagged",
      detail: `⚠️ ${label} affected — Normal: ${Math.round(normal.durationMin)} min, New: ${Math.round(restricted.durationMin)} min, Difference: +${diff} min`,
    });
  }
}
