import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { driverProfiles, users, rides, dispatchOffers } from "@db/schema";
import { calculateDistance, calculateTime } from "./geo";
import { isDriverFreeForWindow } from "../queries/driverAvailability";

// Weights sum to 1 — same weighted-sum shape as src/lib/aiDriverMatching.ts's
// UI mockup (SCORE_WEIGHTS/computeDriverScore), but scored only against
// factors backed by real columns/queries. That mockup's fuelType/
// vehicleHealth/experience/customerPreference factors have no real data
// source anywhere in this app and are intentionally dropped, not ported.
const WEIGHTS = {
  proximity: 0.4,
  rating: 0.25,
  cancellationPenalty: 0.2,
  acceptanceRate: 0.15,
};

export interface DriverCandidate {
  driverId: number;
  name: string;
  distanceKm: number;
  etaMin: number;
  rating: number;
  score: number;
}

// 0-100, higher is better. Distance/rating/cancellations are always real;
// acceptanceRate defaults to a neutral 50 for drivers with fewer than 3
// historical dispatch_offers rows (cold start — nothing to judge yet).
function scoreCandidate(input: { distanceKm: number; radiusKm: number; rating: number; recentCancellations: number; acceptanceRate: number | null }): number {
  const proximityScore = Math.max(0, 100 - (input.distanceKm / input.radiusKm) * 100);
  const ratingScore = (input.rating / 5) * 100;
  const cancellationScore = Math.max(0, 100 - input.recentCancellations * 20);
  const acceptanceScore = input.acceptanceRate ?? 50;

  return Math.round(
    proximityScore * WEIGHTS.proximity +
      ratingScore * WEIGHTS.rating +
      cancellationScore * WEIGHTS.cancellationPenalty +
      acceptanceScore * WEIGHTS.acceptanceRate
  );
}

async function getRecentCancellationCount(driverId: number): Promise<number> {
  const db = getDb();
  // MySQL-native NOW() - INTERVAL, not a JS Date — see the note in
  // api/lib/dispatchWorker.ts on why a JS Date compared via gte() silently
  // matches zero rows in this environment's timezone configuration.
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rides)
    .where(and(eq(rides.driverId, driverId), eq(rides.status, "driver_cancelled"), sql`${rides.createdAt} >= NOW() - INTERVAL 7 DAY`));
  return Number(row?.count ?? 0);
}

async function getAcceptanceRate(driverId: number): Promise<number | null> {
  const db = getDb();
  const offers = await db.select().from(dispatchOffers).where(eq(dispatchOffers.driverId, driverId));
  const resolved = offers.filter((o) => o.status === "accepted" || o.status === "rejected" || o.status === "expired");
  if (resolved.length < 3) return null;
  const accepted = resolved.filter((o) => o.status === "accepted").length;
  return Math.round((accepted / resolved.length) * 100);
}

// Eligible = approved + online + free for the requested window. Scored and
// sorted best-first. `excludeDriverIds` lets the dispatch worker skip
// drivers already offered this exact ride in an earlier round.
export async function getEligibleScoredDrivers(
  pickupLat: number,
  pickupLng: number,
  radiusKm: number,
  opts: {
    excludeDriverIds?: number[];
    window: { startMs: number; endMs: number };
    bufferMin: number;
    waitAndReturnMaxWaitMin: number;
    excludeRideId?: number;
  }
): Promise<DriverCandidate[]> {
  const db = getDb();
  const exclude = new Set(opts.excludeDriverIds ?? []);

  const onlineApproved = await db
    .select({
      userId: driverProfiles.userId,
      name: users.name,
      currentLat: driverProfiles.currentLat,
      currentLng: driverProfiles.currentLng,
      rating: driverProfiles.rating,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(driverProfiles.userId, users.id))
    .where(and(eq(driverProfiles.isOnline, true), eq(driverProfiles.status, "approved")));

  const candidates: DriverCandidate[] = [];
  for (const d of onlineApproved) {
    if (exclude.has(d.userId) || !d.currentLat || !d.currentLng) continue;
    const distanceKm = calculateDistance(pickupLat, pickupLng, Number(d.currentLat), Number(d.currentLng));
    if (distanceKm > radiusKm) continue;

    const availability = await isDriverFreeForWindow(d.userId, opts.window, {
      excludeRideId: opts.excludeRideId,
      bufferMin: opts.bufferMin,
      waitAndReturnMaxWaitMin: opts.waitAndReturnMaxWaitMin,
    });
    if (!availability.free) continue;

    const [recentCancellations, acceptanceRate] = await Promise.all([getRecentCancellationCount(d.userId), getAcceptanceRate(d.userId)]);
    const rating = Number(d.rating);
    const score = scoreCandidate({ distanceKm, radiusKm, rating, recentCancellations, acceptanceRate });

    candidates.push({
      driverId: d.userId,
      name: d.name ?? `Driver #${d.userId}`,
      distanceKm,
      etaMin: calculateTime(distanceKm),
      rating,
      score,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}
