import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { rides, schoolSubscriptions, type Ride } from "@db/schema";

export interface OccupiedWindow {
  startMs: number;
  endMs: number;
  reason: string;
}

// Computes the time window a ride occupies its driver for, so a second
// booking that overlaps it can be blocked. `updatedAt` is used as the
// "became active" timestamp — the same convention ride-router.ts already
// relies on elsewhere (e.g. driverCancel's grace-period math) since there's
// no separate "assignedAt" column.
export function rideOccupiedWindow(ride: Ride, bufferMin: number, waitAndReturnMaxWaitMin: number): OccupiedWindow {
  const startMs = ride.updatedAt.getTime();
  const bufferMs = bufferMin * 60_000;

  if (ride.isHourlyRental && ride.rentalHours) {
    return { startMs, endMs: startMs + ride.rentalHours * 60 * 60_000 + bufferMs, reason: "Hourly/Full-Day Rental" };
  }
  if (ride.isWaitAndReturn) {
    // Outbound + estimated return leg + a capped presumed wait — the real
    // wait time isn't known until startReturn actually fires.
    const legMs = ride.estimatedTime * 60_000;
    return { startMs, endMs: startMs + legMs * 2 + waitAndReturnMaxWaitMin * 60_000 + bufferMs, reason: "Wait & Return" };
  }
  return { startMs, endMs: startMs + ride.estimatedTime * 60_000 + bufferMs, reason: "active ride" };
}

export async function getDriverOccupiedWindows(
  driverId: number,
  opts: { excludeRideId?: number; bufferMin: number; waitAndReturnMaxWaitMin: number }
): Promise<OccupiedWindow[]> {
  const db = getDb();
  const conditions = [eq(rides.driverId, driverId), sql`${rides.status} IN ('accepted', 'pickup', 'ongoing', 'waiting')`];
  const activeRides = await db.select().from(rides).where(and(...conditions));
  return activeRides
    .filter((r) => r.id !== opts.excludeRideId)
    .map((r) => rideOccupiedWindow(r, opts.bufferMin, opts.waitAndReturnMaxWaitMin));
}

export type AvailabilityResult = { free: true } | { free: false; conflict: OccupiedWindow };

function overlaps(a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export async function isDriverFreeForWindow(
  driverId: number,
  window: { startMs: number; endMs: number },
  opts: { excludeRideId?: number; bufferMin: number; waitAndReturnMaxWaitMin: number }
): Promise<AvailabilityResult> {
  const occupied = await getDriverOccupiedWindows(driverId, opts);
  const conflict = occupied.find((w) => overlaps(w, window));
  return conflict ? { free: false, conflict } : { free: true };
}

// School's schedule is recurring HH:MM strings, not absolute timestamps, so
// conflict-checking works in minutes-since-midnight instead of epoch ms —
// comparing morning-window-vs-morning-window and evening-vs-evening across
// every OTHER subscription already approved+assigned to this driver.
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function schoolWindow(startHHMM: string, endHHMM: string, bufferMin: number): { startMs: number; endMs: number } {
  const start = toMinutes(startHHMM) - bufferMin;
  const end = toMinutes(endHHMM) + bufferMin;
  return { startMs: start, endMs: end };
}

export async function isDriverFreeForSchoolSubscription(
  driverId: number,
  sub: { morningPickupTime: string; schoolReportingTime: string; schoolEndTime: string; returnPickupTime: string },
  bufferMin: number,
  excludeSubscriptionId?: string
): Promise<AvailabilityResult> {
  const db = getDb();
  const others = await db
    .select()
    .from(schoolSubscriptions)
    .where(and(eq(schoolSubscriptions.assignedDriverId, driverId), eq(schoolSubscriptions.status, "approved")));

  const thisMorning = schoolWindow(sub.morningPickupTime, sub.schoolReportingTime, bufferMin);
  const thisEvening = schoolWindow(sub.schoolEndTime, sub.returnPickupTime, bufferMin);

  for (const other of others) {
    if (excludeSubscriptionId && other.id === excludeSubscriptionId) continue;
    const otherMorning = schoolWindow(other.morningPickupTime, other.schoolReportingTime, bufferMin);
    const otherEvening = schoolWindow(other.schoolEndTime, other.returnPickupTime, bufferMin);
    if (overlaps(thisMorning, otherMorning)) {
      return { free: false, conflict: { startMs: otherMorning.startMs, endMs: otherMorning.endMs, reason: `Morning run for ${other.studentName}` } };
    }
    if (overlaps(thisEvening, otherEvening)) {
      return { free: false, conflict: { startMs: otherEvening.startMs, endMs: otherEvening.endMs, reason: `Evening run for ${other.studentName}` } };
    }
  }
  return { free: true };
}
