import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { rides, dispatchOffers } from "@db/schema";
import { getDispatchSettings, getPendingOfferForRide, createOffer, logDispatchEvent } from "../queries/dispatch";
import { getEligibleScoredDrivers } from "./driverScoring";
import { sendPushToDrivers } from "../notification-router";

const TICK_MS = 5000;

// This is a single in-process interval loop, not a durable job queue — the
// most durable option achievable without new infrastructure (no Redis/
// BullMQ/cloud cron exist in this environment). It survives the rider's/
// driver's/admin's own app or phone being closed (this runs server-side),
// but not the dev-server process itself dying, which is a known, pre-
// existing, named limitation of this whole environment — not something
// Phase 1 can fix.
//
// The singleton guard lives on `globalThis` rather than a plain module-level
// `let` (unlike api/queries/connection.ts's `let instance`, which is safe to
// re-create harmlessly): Vite's dev-server SSR module runner can re-evaluate
// this file's module graph independently of the actual Node process
// lifetime, and a plain module-level flag would reset on that, silently
// stacking a second live setInterval with no way to clear the first one.
let ticking = false;
const g = globalThis as typeof globalThis & { __dispatchWorkerStarted?: boolean };

export function startDispatchWorker(): void {
  if (g.__dispatchWorkerStarted) return;
  g.__dispatchWorkerStarted = true;
  setInterval(() => {
    void tick();
  }, TICK_MS);
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await expireStaleOffers();
    await advanceSearchingRides();
  } catch (error) {
    console.error("[dispatchWorker] tick failed:", error);
  } finally {
    ticking = false;
  }
}

// Every comparison here against "now" uses MySQL's own NOW()/INTERVAL
// instead of a JS Date object passed as a query parameter — drizzle-orm's
// mysql2 adapter serializes Date parameters in a way that doesn't line up
// with this session's timezone setting (confirmed: a JS `Date` compared via
// lt()/gte() against a real, in-range timestamp column silently matched
// zero rows here, off by exactly the local UTC offset). Reading an
// already-stored Date back out (e.g. `ride.createdAt.getTime()` for pure
// in-memory math) is unaffected — only Date objects going *into* a query are
// at risk, so that's the one thing consistently avoided below.
async function expireStaleOffers(): Promise<void> {
  const db = getDb();
  const stale = await db
    .select()
    .from(dispatchOffers)
    .where(and(eq(dispatchOffers.status, "pending"), sql`${dispatchOffers.expiresAt} < NOW()`));
  for (const offer of stale) {
    await db.update(dispatchOffers).set({ status: "expired", respondedAt: sql`NOW()` }).where(eq(dispatchOffers.id, offer.id));
    await logDispatchEvent({ rideId: offer.rideId, eventType: "offer_expired", driverId: offer.driverId, round: offer.round });
  }
}

async function advanceSearchingRides(): Promise<void> {
  const db = getDb();
  const settings = await getDispatchSettings();

  // Rides the existing broadcast (notifyNearbyDriversOfNewRide, unchanged)
  // hasn't resolved within firstOfferDelaySec — this is the sequential
  // fallback, not a replacement for that broadcast.
  const stuck = await db
    .select()
    .from(rides)
    .where(and(eq(rides.status, "searching"), sql`${rides.createdAt} < NOW() - INTERVAL ${settings.firstOfferDelaySec} SECOND`, isNull(rides.dispatchExhaustedAt)));

  for (const ride of stuck) {
    const existingOffer = await getPendingOfferForRide(ride.id);
    if (existingOffer) continue; // still waiting on a live offer

    if (ride.dispatchRound >= settings.maxOfferRounds) {
      await db.update(rides).set({ dispatchExhaustedAt: sql`NOW()` }).where(and(eq(rides.id, ride.id), isNull(rides.dispatchExhaustedAt)));
      await logDispatchEvent({ rideId: ride.id, eventType: "no_driver_available", round: ride.dispatchRound });
      continue;
    }

    const round = ride.dispatchRound + 1;
    const radiusKm = settings.baseRadiusKm + (round - 1) * settings.radiusExpansionKm;
    const pickupLat = Number(ride.pickupLat);
    const pickupLng = Number(ride.pickupLng);
    const window = { startMs: Date.now(), endMs: Date.now() + ride.estimatedTime * 60_000 };

    // Exclude drivers already offered (any round, any status) this exact
    // ride — a rejected/expired offer shouldn't be immediately re-offered.
    const priorOffers = await db.select({ driverId: dispatchOffers.driverId }).from(dispatchOffers).where(eq(dispatchOffers.rideId, ride.id));
    const excludeDriverIds = priorOffers.map((o) => o.driverId);

    const candidates = await getEligibleScoredDrivers(pickupLat, pickupLng, radiusKm, {
      excludeDriverIds,
      window,
      bufferMin: settings.reservationBufferMin,
      waitAndReturnMaxWaitMin: settings.waitAndReturnMaxWaitMin,
      excludeRideId: ride.id,
    });

    await db.update(rides).set({ dispatchRound: round, lastDispatchAttemptAt: sql`NOW()` }).where(eq(rides.id, ride.id));

    if (candidates.length === 0) {
      await logDispatchEvent({ rideId: ride.id, eventType: "round_skipped_no_candidates", round, detail: `radius ${radiusKm}km` });
      continue;
    }

    const winner = candidates[0];
    await createOffer({ rideId: ride.id, driverId: winner.driverId, round, radiusKm, score: winner.score, offerTimeoutSec: settings.offerTimeoutSec });
    await logDispatchEvent({ rideId: ride.id, eventType: "offer_sent", driverId: winner.driverId, round, detail: `score ${winner.score}, ${winner.distanceKm}km, ETA ${winner.etaMin}min` });

    void sendPushToDrivers([winner.driverId], {
      title: "Ride request",
      message: `Pickup at ${ride.pickupAddress} — you have ${settings.offerTimeoutSec}s to accept.`,
      url: "/driver/dashboard",
    });
  }
}
