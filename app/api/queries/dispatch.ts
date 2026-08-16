import { eq, sql, and, desc } from "drizzle-orm";
import { getDb } from "./connection";
import { dispatchSettings, dispatchOffers, dispatchEvents, rides, type DispatchSettings, type Ride } from "@db/schema";
import { isDriverFreeForWindow, rideOccupiedWindow } from "./driverAvailability";

function genEventId(): string {
  return `dev-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

const SETTINGS_ROW_ID = 1;

const DEFAULTS = {
  baseRadiusKm: 5,
  radiusExpansionKm: 3,
  offerTimeoutSec: 20,
  maxOfferRounds: 4,
  firstOfferDelaySec: 45,
  reservationBufferMin: 15,
  waitAndReturnMaxWaitMin: 60,
  riskMediumAfterSec: 300,
  riskHighAfterSec: 600,
};

export interface DispatchSettingsView {
  baseRadiusKm: number;
  radiusExpansionKm: number;
  offerTimeoutSec: number;
  maxOfferRounds: number;
  firstOfferDelaySec: number;
  reservationBufferMin: number;
  waitAndReturnMaxWaitMin: number;
  riskMediumAfterSec: number;
  riskHighAfterSec: number;
}

function toView(row: DispatchSettings): DispatchSettingsView {
  return {
    baseRadiusKm: Number(row.baseRadiusKm),
    radiusExpansionKm: Number(row.radiusExpansionKm),
    offerTimeoutSec: row.offerTimeoutSec,
    maxOfferRounds: row.maxOfferRounds,
    firstOfferDelaySec: row.firstOfferDelaySec,
    reservationBufferMin: row.reservationBufferMin,
    waitAndReturnMaxWaitMin: row.waitAndReturnMaxWaitMin,
    riskMediumAfterSec: row.riskMediumAfterSec,
    riskHighAfterSec: row.riskHighAfterSec,
  };
}

// Idempotent get-or-create singleton — same INSERT...ON DUPLICATE KEY UPDATE
// no-op pattern api/queries/fareEngine.ts's getSurgeSettings already uses.
export async function getDispatchSettings(): Promise<DispatchSettingsView> {
  const db = getDb();
  await db
    .insert(dispatchSettings)
    .values({
      id: SETTINGS_ROW_ID,
      baseRadiusKm: String(DEFAULTS.baseRadiusKm),
      radiusExpansionKm: String(DEFAULTS.radiusExpansionKm),
      offerTimeoutSec: DEFAULTS.offerTimeoutSec,
      maxOfferRounds: DEFAULTS.maxOfferRounds,
      firstOfferDelaySec: DEFAULTS.firstOfferDelaySec,
      reservationBufferMin: DEFAULTS.reservationBufferMin,
      waitAndReturnMaxWaitMin: DEFAULTS.waitAndReturnMaxWaitMin,
      riskMediumAfterSec: DEFAULTS.riskMediumAfterSec,
      riskHighAfterSec: DEFAULTS.riskHighAfterSec,
    })
    .onDuplicateKeyUpdate({ set: { id: sql`${dispatchSettings.id}` } });
  const row = await db.query.dispatchSettings.findFirst({ where: eq(dispatchSettings.id, SETTINGS_ROW_ID) });
  return toView(row!);
}

export async function updateDispatchSettings(patch: Partial<DispatchSettingsView>): Promise<DispatchSettingsView> {
  const db = getDb();
  await getDispatchSettings();
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    values[key] = key.endsWith("RadiusKm") ? String(value) : value;
  }
  await db.update(dispatchSettings).set(values).where(eq(dispatchSettings.id, SETTINGS_ROW_ID));
  return getDispatchSettings();
}

// ---- Audit log --------------------------------------------------------
export async function logDispatchEvent(input: {
  rideId: number;
  eventType: (typeof dispatchEvents.$inferInsert)["eventType"];
  driverId?: number;
  round?: number;
  actor?: "system" | "admin" | "driver" | "rider";
  actorUserId?: number;
  detail?: string;
}): Promise<void> {
  await getDb()
    .insert(dispatchEvents)
    .values({
      id: genEventId(),
      rideId: input.rideId,
      eventType: input.eventType,
      driverId: input.driverId,
      round: input.round,
      actor: input.actor ?? "system",
      actorUserId: input.actorUserId,
      detail: input.detail,
    });
}

export async function listDispatchEvents(rideId: number) {
  return getDb().select().from(dispatchEvents).where(eq(dispatchEvents.rideId, rideId)).orderBy(desc(dispatchEvents.createdAt));
}

// ---- Offers -------------------------------------------------------------
export async function getPendingOfferForRide(rideId: number) {
  const db = getDb();
  return db.query.dispatchOffers.findFirst({
    where: and(eq(dispatchOffers.rideId, rideId), eq(dispatchOffers.status, "pending")),
    orderBy: desc(dispatchOffers.offeredAt),
  });
}

export async function createOffer(input: { rideId: number; driverId: number; round: number; radiusKm: number; score: number; offerTimeoutSec: number }) {
  const db = getDb();
  // MySQL-native NOW() + INTERVAL, not a JS Date value — see the note in
  // api/lib/dispatchWorker.ts on why a JS Date passed as a query value here
  // would silently store the wrong moment relative to this session's
  // timezone, breaking every later NOW()-based expiry comparison.
  const [result] = await db.insert(dispatchOffers).values({
    rideId: input.rideId,
    driverId: input.driverId,
    round: input.round,
    radiusKm: String(input.radiusKm),
    score: input.score,
    expiresAt: sql`NOW() + INTERVAL ${input.offerTimeoutSec} SECOND`,
  });
  return result.insertId;
}

export async function respondToOwnOffer(rideId: number, driverId: number, status: "accepted" | "rejected") {
  const db = getDb();
  const [result] = await db
    .update(dispatchOffers)
    .set({ status, respondedAt: sql`NOW()` })
    .where(and(eq(dispatchOffers.rideId, rideId), eq(dispatchOffers.driverId, driverId), eq(dispatchOffers.status, "pending")));
  return result.affectedRows > 0;
}

// ---- Shared claim logic ---------------------------------------------------
// The atomic-claim pattern ride-router.ts's `accept` already used, now with
// the dispatch engine's availability check and offer-exclusivity folded in.
// A driver can only claim a ride if: (a) it's still `searching`, (b) they
// have no conflicting reservation for the resulting window, and (c) no
// OTHER driver currently holds a live sequential offer on it.
export async function claimRideForDriver(
  rideId: number,
  driverId: number
): Promise<{ success: true; ride: Ride } | { success: false; error: string }> {
  const db = getDb();
  const settings = await getDispatchSettings();

  const [claimResult] = await db
    .update(rides)
    .set({ driverId, status: "accepted" })
    .where(and(eq(rides.id, rideId), eq(rides.status, "searching")));

  if (claimResult.affectedRows === 0) {
    const existing = await db.query.rides.findFirst({ where: eq(rides.id, rideId) });
    if (existing?.driverId === driverId && existing.status === "accepted") {
      return { success: true, ride: existing };
    }
    return { success: false, error: "This ride has already been taken by another driver." };
  }

  let ride = (await db.query.rides.findFirst({ where: eq(rides.id, rideId) }))!;

  // Offer exclusivity: if a different driver currently holds a live offer,
  // they get priority — revert this claim rather than letting a broadcast
  // accept jump the sequential queue.
  const pendingOffer = await getPendingOfferForRide(rideId);
  if (pendingOffer && pendingOffer.driverId !== driverId) {
    await db.update(rides).set({ driverId: null, status: "searching" }).where(eq(rides.id, rideId));
    return { success: false, error: "This ride is currently offered to another driver — try again shortly." };
  }

  // Availability: does this driver already have a conflicting reservation?
  const window = rideOccupiedWindow(ride, settings.reservationBufferMin, settings.waitAndReturnMaxWaitMin);
  const availability = await isDriverFreeForWindow(driverId, window, {
    excludeRideId: rideId,
    bufferMin: settings.reservationBufferMin,
    waitAndReturnMaxWaitMin: settings.waitAndReturnMaxWaitMin,
  });
  if (!availability.free) {
    await db.update(rides).set({ driverId: null, status: "searching" }).where(eq(rides.id, rideId));
    await logDispatchEvent({
      rideId,
      eventType: "availability_conflict_blocked",
      driverId,
      actor: "driver",
      actorUserId: driverId,
      detail: availability.conflict.reason,
    });
    return { success: false, error: `You already have a conflicting booking (${availability.conflict.reason}) during this time.` };
  }

  if (pendingOffer && pendingOffer.driverId === driverId) {
    await respondToOwnOffer(rideId, driverId, "accepted");
    await logDispatchEvent({ rideId, eventType: "offer_accepted", driverId, round: pendingOffer.round, actor: "driver", actorUserId: driverId });
  }

  ride = (await db.query.rides.findFirst({ where: eq(rides.id, rideId) }))!;
  return { success: true, ride };
}

// Admin-only path: bypasses the `status='searching'` guard (the ride may
// already be assigned — this is what makes it reassign, not just assign),
// and surfaces an availability conflict as a warning the caller can choose
// to override via `force`, rather than silently blocking an admin who's
// deliberately resolving a stuck booking.
export async function adminAssignDriver(
  rideId: number,
  driverId: number,
  opts: { actorUserId: number; force?: boolean; reason?: string }
): Promise<{ success: true; ride: Ride } | { success: false; error: string; conflict?: string }> {
  const db = getDb();
  const settings = await getDispatchSettings();
  const existing = await db.query.rides.findFirst({ where: eq(rides.id, rideId) });
  if (!existing) return { success: false, error: "Ride not found." };

  if (!opts.force) {
    const window = rideOccupiedWindow(existing, settings.reservationBufferMin, settings.waitAndReturnMaxWaitMin);
    const availability = await isDriverFreeForWindow(driverId, window, {
      excludeRideId: rideId,
      bufferMin: settings.reservationBufferMin,
      waitAndReturnMaxWaitMin: settings.waitAndReturnMaxWaitMin,
    });
    if (!availability.free) {
      return { success: false, error: "This driver has a scheduling conflict.", conflict: availability.conflict.reason };
    }
  }

  const wasAssigned = !!existing.driverId && existing.driverId !== driverId;
  await db
    .update(rides)
    .set({ driverId, status: existing.status === "searching" ? "accepted" : existing.status })
    .where(eq(rides.id, rideId));

  await logDispatchEvent({
    rideId,
    eventType: wasAssigned ? "admin_reassign" : "admin_manual_assign",
    driverId,
    actor: "admin",
    actorUserId: opts.actorUserId,
    detail: opts.reason,
  });

  const ride = (await db.query.rides.findFirst({ where: eq(rides.id, rideId) }))!;
  return { success: true, ride };
}
