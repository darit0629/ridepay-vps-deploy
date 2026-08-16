import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { fareEngineConfig, surgeSettingsConfig } from "@db/schema";

export interface FareConfig {
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  waitingChargePerMin: number;
  shareMultiplier: number;
  reserveMultiplier: number;
  autoMultiplier: number;
  commissionPerRide: number;
  trafficChargePercent: number;
  nightChargePercent: number;
  peakHourMultiplier: number;
  rainMultiplier: number;
  festivalMultiplier: number;
  airportPickupCharge: number;
  airportDropCharge: number;
  tollChargesEnabled: boolean;
  parkingChargesEnabled: boolean;
  driverIncentivePerRide: number;
  bookingFee: number;
  platformFee: number;
  convenienceFee: number;
  gstPercent: number;
  cancellationCharge: number;
  minFare: number;
  maxFare: number;
  outstationChargePerKm: number;
  longDistanceDiscountPercent: number;
  longDistanceThresholdKm: number;
  roundTripChargePercent: number;
  parcelBaseFare: number;
  parcelPerKmRate: number;
  schoolRideMultiplier: number;
  womenRideMultiplier: number;
  luxuryVehicleMultiplier: number;
}

const CONFIG_ROW_ID = 1;
const NUMERIC_FIELDS: (keyof FareConfig)[] = [
  "baseFare", "perKmRate", "perMinuteRate", "waitingChargePerMin", "shareMultiplier", "reserveMultiplier",
  "autoMultiplier", "commissionPerRide", "trafficChargePercent", "nightChargePercent", "peakHourMultiplier",
  "rainMultiplier", "festivalMultiplier", "airportPickupCharge", "airportDropCharge", "driverIncentivePerRide",
  "bookingFee", "platformFee", "convenienceFee", "gstPercent", "cancellationCharge", "minFare", "maxFare",
  "outstationChargePerKm", "longDistanceDiscountPercent", "longDistanceThresholdKm", "roundTripChargePercent",
  "parcelBaseFare", "parcelPerKmRate", "schoolRideMultiplier", "womenRideMultiplier", "luxuryVehicleMultiplier",
];

function toConfig(row: typeof fareEngineConfig.$inferSelect): FareConfig {
  const out = { tollChargesEnabled: row.tollChargesEnabled, parkingChargesEnabled: row.parkingChargesEnabled } as FareConfig;
  for (const field of NUMERIC_FIELDS) {
    (out as unknown as Record<string, number>)[field] = Number(row[field as keyof typeof row]);
  }
  return out;
}

export async function getFareConfig(): Promise<FareConfig> {
  const db = getDb();
  await db
    .insert(fareEngineConfig)
    .values({ id: CONFIG_ROW_ID })
    .onDuplicateKeyUpdate({ set: { id: sql`${fareEngineConfig.id}` } });
  const row = await db.query.fareEngineConfig.findFirst({ where: eq(fareEngineConfig.id, CONFIG_ROW_ID) });
  return toConfig(row!);
}

export async function updateFareConfig(patch: Partial<FareConfig>): Promise<FareConfig> {
  const db = getDb();
  await getFareConfig();
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    values[key] = typeof value === "boolean" ? value : String(value);
  }
  await db.update(fareEngineConfig).set(values).where(eq(fareEngineConfig.id, CONFIG_ROW_ID));
  return getFareConfig();
}

// The old per-vehicle-type `vehiclePricing` table this file used to expose
// (VehiclePricing/listVehiclePricing/updateVehiclePricing/
// seedVehiclePricingIfEmpty) has been replaced by the much richer
// `fareVehicleConfigs` table — see api/queries/fareVehicleConfig.ts. The
// old table is left in the database (harmless orphaned data, matching this
// codebase's existing tolerance for a couple of legacy tables) but nothing
// reads or writes it anymore.

export interface PeakWindow {
  label: string;
  startHour: number;
  endHour: number;
}

export interface DemandTier {
  count: number;
  percent: number;
}

export interface SurgeSettings {
  enabled: boolean;
  maxSurgePercent: number;
  minFare: number;
  nightChargePercent: number;
  festivalChargePercent: number;
  emergencyOverride: boolean;
  rainActive: boolean;
  festivalActive: boolean;
  surgeMode: "manual" | "auto";
  demandSurgePercent: number;
  demandTiers: DemandTier[];
  peakWindows: PeakWindow[];
  aiPricingEnabled: boolean;
}

const DEFAULT_SURGE: SurgeSettings = {
  enabled: true,
  maxSurgePercent: 50,
  minFare: 30,
  nightChargePercent: 10,
  festivalChargePercent: 20,
  emergencyOverride: false,
  rainActive: false,
  festivalActive: false,
  surgeMode: "manual",
  demandSurgePercent: 0,
  aiPricingEnabled: true,
  demandTiers: [
    { count: 3, percent: 15 },
    { count: 6, percent: 30 },
    { count: 10, percent: 50 },
  ],
  peakWindows: [
    { label: "Morning Peak", startHour: 8, endHour: 10 },
    { label: "Evening Peak", startHour: 18, endHour: 20 },
  ],
};

function toSurgeView(row: typeof surgeSettingsConfig.$inferSelect): SurgeSettings {
  return {
    enabled: row.enabled,
    maxSurgePercent: Number(row.maxSurgePercent),
    minFare: Number(row.minFare),
    nightChargePercent: Number(row.nightChargePercent),
    festivalChargePercent: Number(row.festivalChargePercent),
    emergencyOverride: row.emergencyOverride,
    rainActive: row.rainActive,
    festivalActive: row.festivalActive,
    surgeMode: row.surgeMode,
    demandSurgePercent: Number(row.demandSurgePercent),
    demandTiers: row.demandTiers,
    peakWindows: row.peakWindows,
    aiPricingEnabled: row.aiPricingEnabled,
  };
}

const SURGE_ROW_ID = 1;

export async function getSurgeSettings(): Promise<SurgeSettings> {
  const db = getDb();
  await db
    .insert(surgeSettingsConfig)
    .values({
      id: SURGE_ROW_ID,
      maxSurgePercent: String(DEFAULT_SURGE.maxSurgePercent),
      minFare: String(DEFAULT_SURGE.minFare),
      nightChargePercent: String(DEFAULT_SURGE.nightChargePercent),
      festivalChargePercent: String(DEFAULT_SURGE.festivalChargePercent),
      demandSurgePercent: String(DEFAULT_SURGE.demandSurgePercent),
      demandTiers: DEFAULT_SURGE.demandTiers,
      peakWindows: DEFAULT_SURGE.peakWindows,
    })
    .onDuplicateKeyUpdate({ set: { id: sql`${surgeSettingsConfig.id}` } });
  const row = await db.query.surgeSettingsConfig.findFirst({ where: eq(surgeSettingsConfig.id, SURGE_ROW_ID) });
  return toSurgeView(row!);
}

export async function updateSurgeSettings(patch: Partial<SurgeSettings>): Promise<SurgeSettings> {
  const db = getDb();
  await getSurgeSettings();
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "demandTiers" || key === "peakWindows") values[key] = value;
    else if (typeof value === "boolean" || key === "surgeMode") values[key] = value;
    else values[key] = String(value);
  }
  await db.update(surgeSettingsConfig).set(values).where(eq(surgeSettingsConfig.id, SURGE_ROW_ID));
  return getSurgeSettings();
}

// Live count of rides currently in the searching→matched→in_ride pipeline —
// genuinely ephemeral per-process state (the real-time demand signal auto
// surge mode reacts to), not data that needs to survive a restart, so this
// intentionally stays in-memory rather than round-tripping to the DB on
// every ride start/end.
let activeRideCount = 0;

export function notifyRideStarted() {
  activeRideCount += 1;
}

export function notifyRideEnded() {
  activeRideCount = Math.max(0, activeRideCount - 1);
}

export function getActiveRideCount() {
  return activeRideCount;
}
