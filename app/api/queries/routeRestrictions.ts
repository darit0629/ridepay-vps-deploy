import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  routeRestrictions,
  routeRestrictionSegments,
  routeRestrictionEvents,
  rides,
  users,
  scheduledRides,
  type RouteRestriction,
  routeRestrictionReasonEnum,
  routeRestrictionSeverityEnum,
  routeRestrictionEventTypeEnum,
} from "@db/schema";
import { type LatLng, boundingBox, padBoundingBox } from "../lib/routeGeometry";
import { computeRestrictionAwareRoute, type ServerRestrictionGeometry, type RestrictionSeverity } from "../lib/googleDirectionsServer";

function genId(prefix: "rr" | "rrs" | "rre"): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

// In-progress ride statuses a road/area closure could realistically affect —
// same set the dispatch/availability code already treats as "occupied".
const IN_PROGRESS_STATUSES = ["accepted", "pickup", "ongoing", "waiting"] as const;

// ---- Audit log ------------------------------------------------------------
export async function logRestrictionEvent(input: {
  restrictionId: string;
  eventType: (typeof routeRestrictionEventTypeEnum)[number];
  rideId?: number;
  actor?: "system" | "admin" | "driver" | "rider";
  actorUserId?: number;
  detail?: string;
}): Promise<void> {
  await getDb()
    .insert(routeRestrictionEvents)
    .values({
      id: genId("rre"),
      restrictionId: input.restrictionId,
      rideId: input.rideId,
      eventType: input.eventType,
      actor: input.actor ?? "system",
      actorUserId: input.actorUserId,
      detail: input.detail,
    });
}

export async function listRestrictionEvents(restrictionId: string) {
  return getDb()
    .select()
    .from(routeRestrictionEvents)
    .where(eq(routeRestrictionEvents.restrictionId, restrictionId))
    .orderBy(desc(routeRestrictionEvents.createdAt));
}

// ---- Geometry for the routing layer ----------------------------------------
// The single source of truth both getSafeRoute (api/route-restriction-router.ts)
// and the worker (api/lib/routeRestrictionWorker.ts) call — every consumer
// always checks against ALL currently active restrictions, never just one.
export async function getActiveRestrictionGeometries(): Promise<ServerRestrictionGeometry[]> {
  const db = getDb();
  const active = await db.query.routeRestrictions.findMany({ where: eq(routeRestrictions.isActive, true) });

  const results: ServerRestrictionGeometry[] = [];
  for (const r of active) {
    if (r.restrictionType === "road") {
      const roads = await db.query.routeRestrictionSegments.findMany({ where: eq(routeRestrictionSegments.restrictionId, r.id) });
      if (roads.length === 0) continue;
      results.push({ id: r.id, severity: r.severity, restrictionType: "road", segments: roads.map((road) => road.geometry) });
    } else if (r.areaGeometry && r.areaGeometry.length >= 3) {
      results.push({ id: r.id, severity: r.severity, restrictionType: "area", areaGeometry: r.areaGeometry });
    }
  }
  return results;
}

// ---- Create / update / unblock --------------------------------------------
export interface RestrictionSegmentInput {
  roadName: string;
  geometry: LatLng[];
}

export interface CreateRestrictionInput {
  name: string;
  reason: (typeof routeRestrictionReasonEnum)[number];
  reasonNote?: string;
  severity: (typeof routeRestrictionSeverityEnum)[number];
  restrictionType: "road" | "area";
  segments?: RestrictionSegmentInput[];
  areaGeometry?: LatLng[];
  startTime: Date;
  endTime?: Date | null;
  isIndefinite: boolean;
}

async function insertSegments(restrictionId: string, segments: RestrictionSegmentInput[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < segments.length; i++) {
    await db.insert(routeRestrictionSegments).values({
      id: genId("rrs"),
      restrictionId,
      roadName: segments[i].roadName,
      geometry: segments[i].geometry,
      sortOrder: i,
    });
  }
}

export async function createRestriction(input: CreateRestrictionInput, actorUserId: number): Promise<string> {
  const db = getDb();
  const id = genId("rr");
  // Both sides of this comparison are plain JS Date/number — never a
  // JS-Date-vs-MySQL-NOW() SQL comparison, so the documented timezone
  // pitfall (see dispatchWorker.ts) doesn't apply here.
  const activateNow = input.startTime.getTime() <= Date.now();

  await db.insert(routeRestrictions).values({
    id,
    name: input.name,
    reason: input.reason,
    reasonNote: input.reasonNote,
    severity: input.severity,
    restrictionType: input.restrictionType,
    areaGeometry: input.restrictionType === "area" ? input.areaGeometry : undefined,
    startTime: input.startTime,
    endTime: input.endTime ?? undefined,
    isIndefinite: input.isIndefinite,
    isActive: activateNow,
    createdByUserId: actorUserId,
  });

  if (input.restrictionType === "road" && input.segments?.length) {
    await insertSegments(id, input.segments);
  }

  await logRestrictionEvent({ restrictionId: id, eventType: "created", actor: "admin", actorUserId, detail: input.name });
  if (activateNow) {
    await logRestrictionEvent({
      restrictionId: id,
      eventType: "activated",
      actor: "system",
      detail: "Activated immediately at creation — start time had already arrived.",
    });
  }

  return id;
}

export interface UpdateRestrictionInput {
  name?: string;
  reason?: (typeof routeRestrictionReasonEnum)[number];
  reasonNote?: string;
  severity?: (typeof routeRestrictionSeverityEnum)[number];
  segments?: RestrictionSegmentInput[];
  areaGeometry?: LatLng[];
  startTime?: Date;
  endTime?: Date | null;
  isIndefinite?: boolean;
}

export async function updateRestriction(id: string, patch: UpdateRestrictionInput, actorUserId: number): Promise<void> {
  const db = getDb();
  const values: Record<string, unknown> = { lastRideCheckAt: null };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.reason !== undefined) values.reason = patch.reason;
  if (patch.reasonNote !== undefined) values.reasonNote = patch.reasonNote;
  if (patch.severity !== undefined) values.severity = patch.severity;
  if (patch.startTime !== undefined) values.startTime = patch.startTime;
  if (patch.endTime !== undefined) values.endTime = patch.endTime;
  if (patch.isIndefinite !== undefined) values.isIndefinite = patch.isIndefinite;
  if (patch.areaGeometry !== undefined) values.areaGeometry = patch.areaGeometry;

  await db.update(routeRestrictions).set(values).where(eq(routeRestrictions.id, id));

  if (patch.segments) {
    await db.delete(routeRestrictionSegments).where(eq(routeRestrictionSegments.restrictionId, id));
    await insertSegments(id, patch.segments);
  }

  await logRestrictionEvent({ restrictionId: id, eventType: "edited", actor: "admin", actorUserId });
}

export async function unblockRestriction(id: string, actorUserId: number, reason?: string): Promise<void> {
  const db = getDb();
  await db
    .update(routeRestrictions)
    .set({ isActive: false, unblockedAt: sql`NOW()`, unblockedByUserId: actorUserId, unblockReason: reason })
    .where(eq(routeRestrictions.id, id));
  await logRestrictionEvent({ restrictionId: id, eventType: "unblocked", actor: "admin", actorUserId, detail: reason });
}

// ---- Reads for the admin dashboard -----------------------------------------
export interface RestrictionListItem {
  id: string;
  name: string;
  reason: string;
  reasonNote: string | null;
  severity: string;
  restrictionType: "road" | "area";
  areaGeometry: LatLng[] | null;
  segments: { roadName: string; geometry: LatLng[] }[];
  startTime: number;
  endTime: number | null;
  isIndefinite: boolean;
  isActive: boolean;
  unblockedAt: number | null;
  unblockReason: string | null;
  createdAt: number;
  affectedRides24h: number;
}

async function toListItem(r: RouteRestriction): Promise<RestrictionListItem> {
  const db = getDb();
  const segments =
    r.restrictionType === "road"
      ? (await db.query.routeRestrictionSegments.findMany({ where: eq(routeRestrictionSegments.restrictionId, r.id) })).map((s) => ({
          roadName: s.roadName,
          geometry: s.geometry,
        }))
      : [];
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${routeRestrictionEvents.rideId})` })
    .from(routeRestrictionEvents)
    .where(
      and(
        eq(routeRestrictionEvents.restrictionId, r.id),
        eq(routeRestrictionEvents.eventType, "ride_rerouted"),
        sql`${routeRestrictionEvents.createdAt} >= NOW() - INTERVAL 1 DAY`
      )
    );

  return {
    id: r.id,
    name: r.name,
    reason: r.reason,
    reasonNote: r.reasonNote,
    severity: r.severity,
    restrictionType: r.restrictionType,
    areaGeometry: r.areaGeometry,
    segments,
    startTime: r.startTime.getTime(),
    endTime: r.endTime?.getTime() ?? null,
    isIndefinite: r.isIndefinite,
    isActive: r.isActive,
    unblockedAt: r.unblockedAt?.getTime() ?? null,
    unblockReason: r.unblockReason,
    createdAt: r.createdAt.getTime(),
    affectedRides24h: Number(countRow?.count ?? 0),
  };
}

export async function listRestrictions(): Promise<RestrictionListItem[]> {
  const rows = await getDb().select().from(routeRestrictions).orderBy(desc(routeRestrictions.createdAt));
  const results: RestrictionListItem[] = [];
  for (const r of rows) results.push(await toListItem(r));
  return results;
}

export async function getRestrictionById(id: string): Promise<RestrictionListItem | null> {
  const row = await getDb().query.routeRestrictions.findFirst({ where: eq(routeRestrictions.id, id) });
  return row ? toListItem(row) : null;
}

// ---- Affected-rides preview (live, while an admin is still editing the form) ---
export interface PreviewDraft {
  severity: RestrictionSeverity;
  restrictionType: "road" | "area";
  segments?: RestrictionSegmentInput[];
  areaGeometry?: LatLng[];
}

export interface AffectedRidesPreview {
  activeRideCount: number;
  scheduledRideCount: number;
  driverCount: number;
  sampleRides: { id: number; riderName: string; driverName: string | null; status: string }[];
  cappedAtLimit: boolean;
}

// Bounds Directions cost while an admin is still mid-edit on the block-road
// form — only the closest candidates within the padded bbox get an actual
// route-avoidance check; beyond this the count is reported as "N+".
const PREVIEW_CANDIDATE_LIMIT = 25;
const PREVIEW_BBOX_PADDING_KM = 3;

export async function previewAffectedRides(draft: PreviewDraft): Promise<AffectedRidesPreview> {
  const db = getDb();
  const points: LatLng[] =
    draft.restrictionType === "road" ? (draft.segments ?? []).flatMap((s) => s.geometry) : (draft.areaGeometry ?? []);
  if (points.length === 0) {
    return { activeRideCount: 0, scheduledRideCount: 0, driverCount: 0, sampleRides: [], cappedAtLimit: false };
  }
  const box = padBoundingBox(boundingBox(points), PREVIEW_BBOX_PADDING_KM);

  const candidates = await db.query.rides.findMany({
    where: and(
      inArray(rides.status, IN_PROGRESS_STATUSES),
      sql`(
        (${rides.pickupLat} BETWEEN ${box.minLat} AND ${box.maxLat} AND ${rides.pickupLng} BETWEEN ${box.minLng} AND ${box.maxLng})
        OR
        (${rides.dropLat} BETWEEN ${box.minLat} AND ${box.maxLat} AND ${rides.dropLng} BETWEEN ${box.minLng} AND ${box.maxLng})
      )`
    ),
    limit: PREVIEW_CANDIDATE_LIMIT + 1,
  });
  const cappedAtLimit = candidates.length > PREVIEW_CANDIDATE_LIMIT;
  const checked = candidates.slice(0, PREVIEW_CANDIDATE_LIMIT);

  const draftRestriction: ServerRestrictionGeometry = {
    id: "draft",
    severity: draft.severity,
    restrictionType: draft.restrictionType,
    segments: draft.restrictionType === "road" ? draft.segments?.map((s) => s.geometry) : undefined,
    areaGeometry: draft.restrictionType === "area" ? draft.areaGeometry : undefined,
  };

  const affected: (typeof checked)[number][] = [];
  for (const ride of checked) {
    const origin = { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) };
    const destination = { lat: Number(ride.dropLat), lng: Number(ride.dropLng) };
    const result = await computeRestrictionAwareRoute(origin, destination, [draftRestriction]);
    if (result.status === "no_alternative" || result.usedRestrictedRoad || (result.detourAttempts ?? 0) > 0) {
      affected.push(ride);
    }
  }

  const driverIds = [...new Set(affected.map((r) => r.driverId).filter((id): id is number => id != null))];
  const riderIds = affected.map((r) => r.userId);
  const lookupIds = [...new Set([...riderIds, ...driverIds])];
  const userRows = lookupIds.length ? await db.query.users.findMany({ where: inArray(users.id, lookupIds) }) : [];
  const nameById = new Map(userRows.map((u) => [u.id, u.name ?? "Unknown"]));

  const sampleRides = affected.slice(0, 10).map((r) => ({
    id: r.id,
    riderName: nameById.get(r.userId) ?? "Rider",
    driverName: r.driverId ? (nameById.get(r.driverId) ?? "Driver") : null,
    status: r.status,
  }));

  // Cheap proximity-only estimate (no Directions calls) — the definitive
  // scheduled/school-ride impact check runs later in the worker's
  // sweepUpcomingScheduleImpact tick, which does spend a real Directions
  // call per candidate. This number is a rough "how many are nearby" count.
  const scheduledCandidates = await db.query.scheduledRides.findMany({
    where: and(
      inArray(scheduledRides.status, ["upcoming", "active"]),
      sql`(
        (${scheduledRides.pickupLat} BETWEEN ${box.minLat} AND ${box.maxLat} AND ${scheduledRides.pickupLng} BETWEEN ${box.minLng} AND ${box.maxLng})
        OR
        (${scheduledRides.dropLat} BETWEEN ${box.minLat} AND ${box.maxLat} AND ${scheduledRides.dropLng} BETWEEN ${box.minLng} AND ${box.maxLng})
      )`
    ),
  });

  return {
    activeRideCount: affected.length,
    scheduledRideCount: scheduledCandidates.length,
    driverCount: driverIds.length,
    sampleRides,
    cappedAtLimit,
  };
}

// ---- Post-creation drill-down (definitive, from the event log — not re-computed) ---
export interface AffectedRideRecord {
  eventId: string;
  rideId: number | null;
  eventType: string;
  riderName: string | null;
  driverName: string | null;
  detail: string | null;
  createdAt: number;
}

export async function listAffectedRides(restrictionId: string): Promise<AffectedRideRecord[]> {
  const db = getDb();
  const events = await db.query.routeRestrictionEvents.findMany({
    where: and(eq(routeRestrictionEvents.restrictionId, restrictionId), inArray(routeRestrictionEvents.eventType, ["ride_rerouted", "no_alternative_route"])),
    orderBy: desc(routeRestrictionEvents.createdAt),
  });

  const rideIds = [...new Set(events.map((e) => e.rideId).filter((id): id is number => id != null))];
  const rideRows = rideIds.length ? await db.query.rides.findMany({ where: inArray(rides.id, rideIds) }) : [];
  const rideById = new Map(rideRows.map((r) => [r.id, r]));
  const userIds = [...new Set(rideRows.flatMap((r) => [r.userId, r.driverId]).filter((id): id is number => id != null))];
  const userRows = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds) }) : [];
  const nameById = new Map(userRows.map((u) => [u.id, u.name ?? "Unknown"]));

  return events.map((e) => {
    const ride = e.rideId != null ? rideById.get(e.rideId) : undefined;
    return {
      eventId: e.id,
      rideId: e.rideId,
      eventType: e.eventType,
      riderName: ride ? (nameById.get(ride.userId) ?? "Rider") : null,
      driverName: ride?.driverId ? (nameById.get(ride.driverId) ?? "Driver") : null,
      detail: e.detail,
      createdAt: e.createdAt.getTime(),
    };
  });
}
