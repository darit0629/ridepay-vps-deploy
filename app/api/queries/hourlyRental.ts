import { eq, and, asc } from "drizzle-orm";
import { getDb } from "./connection";
import { hourlyRentalPackages } from "@db/schema";

export type RentalVehicleType = "e-riksha" | "auto-rickshaw" | "car" | "bike";

// The single duration Full Day Rental books — a regular workday, same
// convention taxi/rental services use for a "full day" package.
export const FULL_DAY_HOURS = 10;

// Placeholder pricing — real numbers, just not yet admin-editable (Phase 11
// per the Services roadmap). Roughly: e-riksha cheapest, bike cheapest of
// all, car priciest, auto in between — same relative ordering the rest of
// the fare engine's per-vehicle defaults already use.
const DEFAULT_PACKAGES: { vehicleType: RentalVehicleType; hours: number; basePrice: number; includedKm: number; extraHourRate: number }[] = [
  { vehicleType: "bike", hours: 1, basePrice: 100, includedKm: 10, extraHourRate: 90 },
  { vehicleType: "bike", hours: 2, basePrice: 180, includedKm: 18, extraHourRate: 85 },
  { vehicleType: "bike", hours: 4, basePrice: 330, includedKm: 35, extraHourRate: 80 },
  { vehicleType: "bike", hours: 8, basePrice: 600, includedKm: 70, extraHourRate: 75 },

  { vehicleType: "e-riksha", hours: 1, basePrice: 150, includedKm: 8, extraHourRate: 120 },
  { vehicleType: "e-riksha", hours: 2, basePrice: 280, includedKm: 15, extraHourRate: 120 },
  { vehicleType: "e-riksha", hours: 4, basePrice: 520, includedKm: 30, extraHourRate: 110 },
  { vehicleType: "e-riksha", hours: 8, basePrice: 950, includedKm: 60, extraHourRate: 100 },

  { vehicleType: "auto-rickshaw", hours: 1, basePrice: 180, includedKm: 8, extraHourRate: 150 },
  { vehicleType: "auto-rickshaw", hours: 2, basePrice: 340, includedKm: 15, extraHourRate: 150 },
  { vehicleType: "auto-rickshaw", hours: 4, basePrice: 640, includedKm: 30, extraHourRate: 140 },
  { vehicleType: "auto-rickshaw", hours: 8, basePrice: 1180, includedKm: 60, extraHourRate: 130 },

  { vehicleType: "car", hours: 1, basePrice: 300, includedKm: 10, extraHourRate: 250 },
  { vehicleType: "car", hours: 2, basePrice: 560, includedKm: 20, extraHourRate: 240 },
  { vehicleType: "car", hours: 4, basePrice: 1050, includedKm: 40, extraHourRate: 220 },
  { vehicleType: "car", hours: 8, basePrice: 1950, includedKm: 80, extraHourRate: 200 },

  // Full Day Rental (Services hub) — same mechanism as Hourly Rental, just a
  // fixed long-duration tier; UserFullDayRental.tsx books straight into this
  // exact hours value rather than offering a duration picker.
  { vehicleType: "bike", hours: FULL_DAY_HOURS, basePrice: 720, includedKm: 90, extraHourRate: 70 },
  { vehicleType: "e-riksha", hours: FULL_DAY_HOURS, basePrice: 1150, includedKm: 75, extraHourRate: 95 },
  { vehicleType: "auto-rickshaw", hours: FULL_DAY_HOURS, basePrice: 1450, includedKm: 75, extraHourRate: 125 },
  { vehicleType: "car", hours: FULL_DAY_HOURS, basePrice: 2400, includedKm: 100, extraHourRate: 190 },
];

// Idempotent per-row (not all-or-nothing) — lets a later addition like the
// Full Day tier above get backfilled into an already-seeded table instead of
// requiring a truncate/reseed.
export async function seedHourlyRentalPackagesIfEmpty(): Promise<void> {
  const db = getDb();
  for (const p of DEFAULT_PACKAGES) {
    const existing = await findRentalPackage(p.vehicleType, p.hours);
    if (existing) continue;
    await db.insert(hourlyRentalPackages).values({
      vehicleType: p.vehicleType,
      hours: p.hours,
      basePrice: p.basePrice.toString(),
      includedKm: p.includedKm,
      extraHourRate: p.extraHourRate.toString(),
    });
  }
}

export async function listActiveRentalPackages() {
  const db = getDb();
  return db
    .select()
    .from(hourlyRentalPackages)
    .where(eq(hourlyRentalPackages.active, true))
    .orderBy(asc(hourlyRentalPackages.vehicleType), asc(hourlyRentalPackages.hours));
}

export async function findRentalPackage(vehicleType: RentalVehicleType, hours: number) {
  const db = getDb();
  return db.query.hourlyRentalPackages.findFirst({
    where: and(eq(hourlyRentalPackages.vehicleType, vehicleType), eq(hourlyRentalPackages.hours, hours), eq(hourlyRentalPackages.active, true)),
  });
}

// ---- Admin CRUD (Phase 11) --------------------------------------------
export async function listAllRentalPackages() {
  const db = getDb();
  return db.select().from(hourlyRentalPackages).orderBy(asc(hourlyRentalPackages.vehicleType), asc(hourlyRentalPackages.hours));
}

export async function updateRentalPackage(
  id: number,
  updates: Partial<{ basePrice: number; includedKm: number; extraHourRate: number; active: boolean }>
) {
  const db = getDb();
  const values: Record<string, unknown> = {};
  if (updates.basePrice !== undefined) values.basePrice = String(updates.basePrice);
  if (updates.includedKm !== undefined) values.includedKm = updates.includedKm;
  if (updates.extraHourRate !== undefined) values.extraHourRate = String(updates.extraHourRate);
  if (updates.active !== undefined) values.active = updates.active;
  await db.update(hourlyRentalPackages).set(values).where(eq(hourlyRentalPackages.id, id));
  return db.query.hourlyRentalPackages.findFirst({ where: eq(hourlyRentalPackages.id, id) });
}

export async function createRentalPackage(input: {
  vehicleType: RentalVehicleType;
  hours: number;
  basePrice: number;
  includedKm: number;
  extraHourRate: number;
}) {
  const db = getDb();
  const existing = await db.query.hourlyRentalPackages.findFirst({
    where: and(eq(hourlyRentalPackages.vehicleType, input.vehicleType), eq(hourlyRentalPackages.hours, input.hours)),
  });
  if (existing) throw new Error(`A package for ${input.vehicleType} at ${input.hours}h already exists.`);
  const [inserted] = await db.insert(hourlyRentalPackages).values({
    vehicleType: input.vehicleType,
    hours: input.hours,
    basePrice: String(input.basePrice),
    includedKm: input.includedKm,
    extraHourRate: String(input.extraHourRate),
  });
  return db.query.hourlyRentalPackages.findFirst({ where: eq(hourlyRentalPackages.id, inserted.insertId) });
}
