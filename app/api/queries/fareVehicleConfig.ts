import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { fareVehicleConfigs, fareVehicleTypeEnum } from "@db/schema";

export type FareVehicleTypeId = (typeof fareVehicleTypeEnum)[number];

export interface FareTax {
  id: string;
  name: string;
  type: "percent" | "fixed";
  value: number;
  enabled: boolean;
}

export interface FareVehicleConfig {
  id: FareVehicleTypeId;
  label: string;
  enabled: boolean;
  baseFare: number;
  includedDistanceKm: number;
  perKmCharge: number;
  freeWaitingMin: number;
  waitingChargePerMin: number;
  nightChargeEnabled: boolean;
  nightChargeStart: string;
  nightChargeEnd: string;
  nightChargeType: "percent" | "fixed";
  nightChargeValue: number;
  peakChargeEnabled: boolean;
  peakChargeStart: string;
  peakChargeEnd: string;
  peakChargeType: "percent" | "fixed";
  peakChargeValue: number;
  rainChargeEnabled: boolean;
  rainChargeType: "percent" | "fixed";
  rainChargeValue: number;
  taxes: FareTax[];
  tollEnabled: boolean;
  tollMode: "manual" | "auto";
}

export const FARE_VEHICLE_LABELS: Record<FareVehicleTypeId, string> = {
  "e-riksha-reserve": "E-Rickshaw (Reserve)",
  "e-riksha-share": "E-Rickshaw (Share)",
  "auto-rickshaw": "Auto Rickshaw",
  "bike-taxi": "Bike Taxi",
  car: "Car",
  "e-riksha-women": "E-Rickshaw Women Drive",
  "e-riksha-parcel": "E-Rickshaw Parcel",
  courier: "Courier",
  "e-riksha-school": "E-Rickshaw School",
  "bike-parcel": "Bike Parcel",
};

// Reasonable starting points per type — same role DEFAULT_VEHICLE_PRICING
// played for the old `vehiclePricing` table, just richer now that every
// vehicle type carries its own full section A–G config instead of a shared
// global plus a multiplier.
const DEFAULTS: Record<FareVehicleTypeId, Omit<FareVehicleConfig, "id" | "label" | "taxes" | "enabled">> = {
  "e-riksha-reserve": { baseFare: 30, includedDistanceKm: 2, perKmCharge: 14, freeWaitingMin: 3, waitingChargePerMin: 2, nightChargeEnabled: true, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 15, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 20, tollEnabled: true, tollMode: "manual" },
  "e-riksha-share": { baseFare: 15, includedDistanceKm: 1, perKmCharge: 8, freeWaitingMin: 2, waitingChargePerMin: 1, nightChargeEnabled: true, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 15, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 15, tollEnabled: false, tollMode: "manual" },
  "auto-rickshaw": { baseFare: 25, includedDistanceKm: 2, perKmCharge: 13, freeWaitingMin: 3, waitingChargePerMin: 2, nightChargeEnabled: true, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 15, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 20, tollEnabled: true, tollMode: "manual" },
  "bike-taxi": { baseFare: 15, includedDistanceKm: 1, perKmCharge: 8, freeWaitingMin: 2, waitingChargePerMin: 1, nightChargeEnabled: true, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 10, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 15, tollEnabled: false, tollMode: "manual" },
  car: { baseFare: 40, includedDistanceKm: 2, perKmCharge: 16, freeWaitingMin: 3, waitingChargePerMin: 2, nightChargeEnabled: true, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 15, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 20, tollEnabled: true, tollMode: "manual" },
  "e-riksha-women": { baseFare: 30, includedDistanceKm: 2, perKmCharge: 14, freeWaitingMin: 3, waitingChargePerMin: 2, nightChargeEnabled: true, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 15, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 20, tollEnabled: true, tollMode: "manual" },
  "e-riksha-parcel": { baseFare: 25, includedDistanceKm: 1, perKmCharge: 10, freeWaitingMin: 5, waitingChargePerMin: 1, nightChargeEnabled: false, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 10, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 15, tollEnabled: false, tollMode: "manual" },
  courier: { baseFare: 30, includedDistanceKm: 1, perKmCharge: 10, freeWaitingMin: 5, waitingChargePerMin: 1, nightChargeEnabled: false, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 10, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 15, tollEnabled: true, tollMode: "manual" },
  "e-riksha-school": { baseFare: 18, includedDistanceKm: 2, perKmCharge: 10, freeWaitingMin: 5, waitingChargePerMin: 1, nightChargeEnabled: false, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 10, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 15, tollEnabled: false, tollMode: "manual" },
  "bike-parcel": { baseFare: 12, includedDistanceKm: 1, perKmCharge: 7, freeWaitingMin: 5, waitingChargePerMin: 1, nightChargeEnabled: false, nightChargeStart: "22:00", nightChargeEnd: "05:00", nightChargeType: "percent", nightChargeValue: 10, peakChargeEnabled: false, peakChargeStart: "08:00", peakChargeEnd: "10:00", peakChargeType: "percent", peakChargeValue: 10, rainChargeEnabled: false, rainChargeType: "percent", rainChargeValue: 15, tollEnabled: false, tollMode: "manual" },
};

const DEFAULT_TAXES: FareTax[] = [{ id: "gst", name: "GST", type: "percent", value: 5, enabled: true }];

export async function seedFareVehicleConfigsIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(fareVehicleConfigs);
  if (Number(count) > 0) return;
  await db.insert(fareVehicleConfigs).values(
    fareVehicleTypeEnum.map((id) => {
      const d = DEFAULTS[id];
      return {
        id,
        label: FARE_VEHICLE_LABELS[id],
        enabled: true,
        baseFare: String(d.baseFare),
        includedDistanceKm: String(d.includedDistanceKm),
        perKmCharge: String(d.perKmCharge),
        freeWaitingMin: d.freeWaitingMin,
        waitingChargePerMin: String(d.waitingChargePerMin),
        nightChargeEnabled: d.nightChargeEnabled,
        nightChargeStart: d.nightChargeStart,
        nightChargeEnd: d.nightChargeEnd,
        nightChargeType: d.nightChargeType,
        nightChargeValue: String(d.nightChargeValue),
        peakChargeEnabled: d.peakChargeEnabled,
        peakChargeStart: d.peakChargeStart,
        peakChargeEnd: d.peakChargeEnd,
        peakChargeType: d.peakChargeType,
        peakChargeValue: String(d.peakChargeValue),
        rainChargeEnabled: d.rainChargeEnabled,
        rainChargeType: d.rainChargeType,
        rainChargeValue: String(d.rainChargeValue),
        taxes: DEFAULT_TAXES,
        tollEnabled: d.tollEnabled,
        tollMode: d.tollMode,
      };
    })
  );
}

function toView(row: typeof fareVehicleConfigs.$inferSelect): FareVehicleConfig {
  return {
    id: row.id,
    label: row.label,
    enabled: row.enabled,
    baseFare: Number(row.baseFare),
    includedDistanceKm: Number(row.includedDistanceKm),
    perKmCharge: Number(row.perKmCharge),
    freeWaitingMin: row.freeWaitingMin,
    waitingChargePerMin: Number(row.waitingChargePerMin),
    nightChargeEnabled: row.nightChargeEnabled,
    nightChargeStart: row.nightChargeStart,
    nightChargeEnd: row.nightChargeEnd,
    nightChargeType: row.nightChargeType,
    nightChargeValue: Number(row.nightChargeValue),
    peakChargeEnabled: row.peakChargeEnabled,
    peakChargeStart: row.peakChargeStart,
    peakChargeEnd: row.peakChargeEnd,
    peakChargeType: row.peakChargeType,
    peakChargeValue: Number(row.peakChargeValue),
    rainChargeEnabled: row.rainChargeEnabled,
    rainChargeType: row.rainChargeType,
    rainChargeValue: Number(row.rainChargeValue),
    taxes: row.taxes,
    tollEnabled: row.tollEnabled,
    tollMode: row.tollMode,
  };
}

export async function listFareVehicleConfigs(): Promise<FareVehicleConfig[]> {
  const rows = await getDb().select().from(fareVehicleConfigs);
  return rows.map(toView);
}

export async function getFareVehicleConfig(id: FareVehicleTypeId): Promise<FareVehicleConfig> {
  const row = await getDb().query.fareVehicleConfigs.findFirst({ where: eq(fareVehicleConfigs.id, id) });
  if (!row) throw new Error(`No fare config seeded for vehicle type "${id}"`);
  return toView(row);
}

// Fields stored as-is (JSON, plain strings/enums, or a real int column) —
// everything else in FareVehicleConfig is a decimal column and needs
// stringifying for drizzle's mysql decimal type.
const PASSTHROUGH_FIELDS = new Set<keyof FareVehicleConfig>([
  "taxes", "freeWaitingMin",
  "nightChargeStart", "nightChargeEnd", "nightChargeType",
  "peakChargeStart", "peakChargeEnd", "peakChargeType",
  "rainChargeType", "tollMode",
  "enabled", "nightChargeEnabled", "peakChargeEnabled", "rainChargeEnabled", "tollEnabled",
]);

export async function updateFareVehicleConfig(
  id: FareVehicleTypeId,
  patch: Partial<Omit<FareVehicleConfig, "id" | "label">>
): Promise<FareVehicleConfig> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch) as [keyof FareVehicleConfig, unknown][]) {
    values[key] = PASSTHROUGH_FIELDS.has(key) ? value : String(value);
  }
  if (Object.keys(values).length > 0) {
    await getDb().update(fareVehicleConfigs).set(values).where(eq(fareVehicleConfigs.id, id));
  }
  return getFareVehicleConfig(id);
}

// Copies every section A–G field from one vehicle type onto another —
// backs the page's optional "Duplicate Configuration from another Vehicle
// Type" action.
export async function duplicateFareVehicleConfig(fromId: FareVehicleTypeId, toId: FareVehicleTypeId): Promise<FareVehicleConfig> {
  const source = await getFareVehicleConfig(fromId);
  return updateFareVehicleConfig(toId, {
    baseFare: source.baseFare,
    includedDistanceKm: source.includedDistanceKm,
    perKmCharge: source.perKmCharge,
    freeWaitingMin: source.freeWaitingMin,
    waitingChargePerMin: source.waitingChargePerMin,
    nightChargeEnabled: source.nightChargeEnabled,
    nightChargeStart: source.nightChargeStart,
    nightChargeEnd: source.nightChargeEnd,
    nightChargeType: source.nightChargeType,
    nightChargeValue: source.nightChargeValue,
    peakChargeEnabled: source.peakChargeEnabled,
    peakChargeStart: source.peakChargeStart,
    peakChargeEnd: source.peakChargeEnd,
    peakChargeType: source.peakChargeType,
    peakChargeValue: source.peakChargeValue,
    rainChargeEnabled: source.rainChargeEnabled,
    rainChargeType: source.rainChargeType,
    rainChargeValue: source.rainChargeValue,
    taxes: source.taxes.map((t) => ({ ...t, id: `${t.id}-${Date.now()}` })),
    tollEnabled: source.tollEnabled,
    tollMode: source.tollMode,
  });
}

// Maps a real booking's (vehicleType, segment) — the taxonomy ride-router.ts
// and UserHome.tsx already use — onto one of the 10 fare-config vehicle
// types above. Kept as its own small function (rather than requiring every
// caller to know the mapping) since it's needed both by calculateFare and
// by the client's isVehicleEnabled() check (duplicated there in
// FareConfigContext.tsx — see that file's comment for why it can't just
// import this one).
export function deriveFareVehicleId(
  vehicleType: "e-riksha" | "auto-rickshaw" | "car" | "bike" | "e-riksha-woman" | "e-riksha-parcel" | "bike-parcel" | "e-riksha-school",
  segment: "share" | "reserve" | "auto" | "parcel" | "school" | "women"
): FareVehicleTypeId {
  if (vehicleType === "e-riksha") return segment === "reserve" ? "e-riksha-reserve" : "e-riksha-share";
  if (vehicleType === "auto-rickshaw") return "auto-rickshaw";
  if (vehicleType === "bike") return "bike-taxi";
  if (vehicleType === "car") return "car";
  if (vehicleType === "e-riksha-woman") return "e-riksha-women";
  if (vehicleType === "e-riksha-parcel") return "e-riksha-parcel";
  if (vehicleType === "bike-parcel") return "bike-parcel";
  return "e-riksha-school";
}

// ---------------------------------------------------------------------------
// Shared pure fare math for sections A–G — used both by the live admin
// preview panel and by the real booking engine (api/fare-router.ts), so the
// preview an admin sees is guaranteed to match what a rider is actually
// charged for these sections.
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function minutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Handles overnight windows (e.g. 22:00–05:00) the same way isWithinPeakWindow does for hours.
function isWithinTimeWindow(nowMinutes: number, startHhMm: string, endHhMm: string): boolean {
  const start = minutesSinceMidnight(startHhMm);
  const end = minutesSinceMidnight(endHhMm);
  return start <= end ? nowMinutes >= start && nowMinutes <= end : nowMinutes >= start || nowMinutes <= end;
}

export interface VehicleFareInputs {
  distanceKm: number;
  waitingMin: number;
  atTimestamp: number;
  isRaining: boolean;
  tollAmount: number;
}

export interface VehicleFareLine {
  label: string;
  amount: number;
}

export interface VehicleFareBreakdown {
  baseFare: number;
  distanceCharge: number;
  waitingCharge: number;
  timeCharges: VehicleFareLine[];
  weatherCharge: VehicleFareLine | null;
  taxes: VehicleFareLine[];
  tollCharge: number;
  /** base + distance + waiting + time + weather, before taxes/toll. */
  subtotalBeforeTax: number;
  totalTax: number;
  total: number;
}

export function computeVehicleFareBreakdown(config: FareVehicleConfig, inputs: VehicleFareInputs): VehicleFareBreakdown {
  const chargeableDistance = Math.max(0, inputs.distanceKm - config.includedDistanceKm);
  const distanceCharge = round2(config.perKmCharge * chargeableDistance);

  const chargeableWaiting = Math.max(0, inputs.waitingMin - config.freeWaitingMin);
  const waitingCharge = round2(config.waitingChargePerMin * chargeableWaiting);

  let running = config.baseFare + distanceCharge + waitingCharge;

  const applyCharge = (type: "percent" | "fixed", value: number): number => {
    const amount = type === "percent" ? round2(running * (value / 100)) : round2(value);
    running += amount;
    return amount;
  };

  const timeCharges: VehicleFareLine[] = [];
  const nowMinutes = new Date(inputs.atTimestamp).getHours() * 60 + new Date(inputs.atTimestamp).getMinutes();
  if (config.nightChargeEnabled && isWithinTimeWindow(nowMinutes, config.nightChargeStart, config.nightChargeEnd)) {
    timeCharges.push({ label: "Night Charge", amount: applyCharge(config.nightChargeType, config.nightChargeValue) });
  }
  if (config.peakChargeEnabled && isWithinTimeWindow(nowMinutes, config.peakChargeStart, config.peakChargeEnd)) {
    timeCharges.push({ label: "Peak Hour Charge", amount: applyCharge(config.peakChargeType, config.peakChargeValue) });
  }

  let weatherCharge: VehicleFareLine | null = null;
  if (config.rainChargeEnabled && inputs.isRaining) {
    weatherCharge = { label: "Rain Charge", amount: applyCharge(config.rainChargeType, config.rainChargeValue) };
  }

  const subtotalBeforeTax = round2(running);

  const taxes: VehicleFareLine[] = [];
  let totalTax = 0;
  for (const tax of config.taxes) {
    if (!tax.enabled) continue;
    const amount = tax.type === "percent" ? round2(subtotalBeforeTax * (tax.value / 100)) : round2(tax.value);
    taxes.push({ label: tax.name, amount });
    totalTax += amount;
  }
  totalTax = round2(totalTax);

  const tollCharge = config.tollEnabled ? round2(inputs.tollAmount) : 0;

  return {
    baseFare: config.baseFare,
    distanceCharge,
    waitingCharge,
    timeCharges,
    weatherCharge,
    taxes,
    tollCharge,
    subtotalBeforeTax,
    totalTax,
    total: Math.round(subtotalBeforeTax + totalTax + tollCharge),
  };
}
