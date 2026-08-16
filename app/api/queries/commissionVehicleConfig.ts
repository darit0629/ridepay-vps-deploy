import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { commissionVehicleConfigs, commissionMethodEnum } from "@db/schema";
import { FARE_VEHICLE_LABELS, type FareVehicleTypeId } from "./fareVehicleConfig";

export type CommissionMethod = (typeof commissionMethodEnum)[number];
/** Cash/online overrides intentionally can't be "slab" — a lighter-weight alternate value, not a whole second slab table. */
export type CommissionOverrideMethod = Exclude<CommissionMethod, "slab">;

export interface CommissionSlab {
  id: string;
  minFare: number;
  /** null = open-ended ("701+") */
  maxFare: number | null;
  type: "fixed" | "percentage";
  value: number;
}

export interface CommissionVehicleConfig {
  id: FareVehicleTypeId;
  label: string;
  enabled: boolean;
  method: CommissionMethod;
  fixedAmount: number;
  percentageValue: number;
  slabs: CommissionSlab[];
  /** 0 = no floor */
  minCommission: number;
  /** null = no ceiling */
  maxCommission: number | null;
  applyAfterTax: boolean;
  cashOverrideEnabled: boolean;
  cashMethod: CommissionOverrideMethod;
  cashFixedAmount: number;
  cashPercentageValue: number;
  onlineOverrideEnabled: boolean;
  onlineMethod: CommissionOverrideMethod;
  onlineFixedAmount: number;
  onlinePercentageValue: number;
}

export const COMMISSION_VEHICLE_LABELS = FARE_VEHICLE_LABELS;
const VEHICLE_IDS = Object.keys(FARE_VEHICLE_LABELS) as FareVehicleTypeId[];

const DEFAULT_SLABS: CommissionSlab[] = [
  { id: "slab-1", minFare: 0, maxFare: 100, type: "fixed", value: 2 },
  { id: "slab-2", minFare: 100, maxFare: 300, type: "percentage", value: 3 },
  { id: "slab-3", minFare: 300, maxFare: 700, type: "percentage", value: 4 },
  { id: "slab-4", minFare: 700, maxFare: null, type: "percentage", value: 5 },
];

// One shared baseline for every vehicle type — same role DEFAULTS played in
// fareVehicleConfig.ts. Admins differentiate per type after the fact via
// the page itself (or "Copy From Another Vehicle").
function defaultRow(id: FareVehicleTypeId) {
  return {
    id,
    label: COMMISSION_VEHICLE_LABELS[id],
    enabled: true,
    method: "percentage" as CommissionMethod,
    fixedAmount: "5",
    percentageValue: "10",
    slabs: DEFAULT_SLABS,
    minCommission: "2",
    maxCommission: "50",
    applyAfterTax: false,
    cashOverrideEnabled: false,
    cashMethod: "percentage" as CommissionOverrideMethod,
    cashFixedAmount: "5",
    cashPercentageValue: "10",
    onlineOverrideEnabled: false,
    onlineMethod: "percentage" as CommissionOverrideMethod,
    onlineFixedAmount: "5",
    onlinePercentageValue: "10",
  };
}

export async function seedCommissionVehicleConfigsIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(commissionVehicleConfigs);
  if (Number(count) > 0) return;
  await db.insert(commissionVehicleConfigs).values(VEHICLE_IDS.map(defaultRow));
}

function toView(row: typeof commissionVehicleConfigs.$inferSelect): CommissionVehicleConfig {
  return {
    id: row.id,
    label: row.label,
    enabled: row.enabled,
    method: row.method,
    fixedAmount: Number(row.fixedAmount),
    percentageValue: Number(row.percentageValue),
    slabs: row.slabs,
    minCommission: Number(row.minCommission),
    maxCommission: row.maxCommission === null ? null : Number(row.maxCommission),
    applyAfterTax: row.applyAfterTax,
    cashOverrideEnabled: row.cashOverrideEnabled,
    cashMethod: row.cashMethod as CommissionOverrideMethod,
    cashFixedAmount: Number(row.cashFixedAmount),
    cashPercentageValue: Number(row.cashPercentageValue),
    onlineOverrideEnabled: row.onlineOverrideEnabled,
    onlineMethod: row.onlineMethod as CommissionOverrideMethod,
    onlineFixedAmount: Number(row.onlineFixedAmount),
    onlinePercentageValue: Number(row.onlinePercentageValue),
  };
}

export async function listCommissionVehicleConfigs(): Promise<CommissionVehicleConfig[]> {
  const rows = await getDb().select().from(commissionVehicleConfigs);
  return rows.map(toView);
}

export async function getCommissionVehicleConfig(id: FareVehicleTypeId): Promise<CommissionVehicleConfig> {
  const row = await getDb().query.commissionVehicleConfigs.findFirst({ where: eq(commissionVehicleConfigs.id, id) });
  if (!row) throw new Error(`No commission config seeded for vehicle type "${id}"`);
  return toView(row);
}

const PASSTHROUGH_FIELDS = new Set<keyof CommissionVehicleConfig>([
  "slabs", "method", "cashMethod", "onlineMethod",
  "enabled", "applyAfterTax", "cashOverrideEnabled", "onlineOverrideEnabled",
]);

export async function updateCommissionVehicleConfig(
  id: FareVehicleTypeId,
  patch: Partial<Omit<CommissionVehicleConfig, "id" | "label">>
): Promise<CommissionVehicleConfig> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch) as [keyof CommissionVehicleConfig, unknown][]) {
    if (key === "maxCommission") {
      values[key] = value === null ? null : String(value);
    } else {
      values[key] = PASSTHROUGH_FIELDS.has(key) ? value : String(value);
    }
  }
  if (Object.keys(values).length > 0) {
    await getDb().update(commissionVehicleConfigs).set(values).where(eq(commissionVehicleConfigs.id, id));
  }
  return getCommissionVehicleConfig(id);
}

export async function duplicateCommissionVehicleConfig(fromId: FareVehicleTypeId, toId: FareVehicleTypeId): Promise<CommissionVehicleConfig> {
  const source = await getCommissionVehicleConfig(fromId);
  return updateCommissionVehicleConfig(toId, {
    enabled: source.enabled,
    method: source.method,
    fixedAmount: source.fixedAmount,
    percentageValue: source.percentageValue,
    slabs: source.slabs.map((s) => ({ ...s, id: `${s.id}-${Date.now()}` })),
    minCommission: source.minCommission,
    maxCommission: source.maxCommission,
    applyAfterTax: source.applyAfterTax,
    cashOverrideEnabled: source.cashOverrideEnabled,
    cashMethod: source.cashMethod,
    cashFixedAmount: source.cashFixedAmount,
    cashPercentageValue: source.cashPercentageValue,
    onlineOverrideEnabled: source.onlineOverrideEnabled,
    onlineMethod: source.onlineMethod,
    onlineFixedAmount: source.onlineFixedAmount,
    onlinePercentageValue: source.onlinePercentageValue,
  });
}

export async function restoreDefaultCommissionVehicleConfig(id: FareVehicleTypeId): Promise<CommissionVehicleConfig> {
  const d = defaultRow(id);
  return updateCommissionVehicleConfig(id, {
    enabled: true,
    method: d.method,
    fixedAmount: Number(d.fixedAmount),
    percentageValue: Number(d.percentageValue),
    slabs: d.slabs.map((s) => ({ ...s, id: `${s.id}-${Date.now()}` })),
    minCommission: Number(d.minCommission),
    maxCommission: Number(d.maxCommission),
    applyAfterTax: false,
    cashOverrideEnabled: false,
    cashMethod: d.cashMethod,
    cashFixedAmount: Number(d.cashFixedAmount),
    cashPercentageValue: Number(d.cashPercentageValue),
    onlineOverrideEnabled: false,
    onlineMethod: d.onlineMethod,
    onlineFixedAmount: Number(d.onlineFixedAmount),
    onlinePercentageValue: Number(d.onlinePercentageValue),
  });
}

// ---------------------------------------------------------------------------
// Validation — shared by the update mutation (server-side gate before
// anything is persisted) and the admin page (client-side, before the admin
// even attempts to save).
// ---------------------------------------------------------------------------
export function validateCommissionVehicleConfig(config: {
  method: CommissionMethod;
  fixedAmount: number;
  percentageValue: number;
  slabs: CommissionSlab[];
  minCommission: number;
  maxCommission: number | null;
}): string | null {
  if (config.percentageValue < 0 || config.percentageValue > 100) return "Percentage commission cannot exceed 100%.";
  if (config.fixedAmount < 0) return "Fixed commission cannot be negative.";
  if (config.maxCommission !== null && config.minCommission > config.maxCommission) {
    return "Minimum commission cannot exceed maximum commission.";
  }

  if (config.method === "slab") {
    if (config.slabs.length === 0) return "Add at least one slab, or switch to Fixed/Percentage.";
    const sorted = [...config.slabs].sort((a, b) => a.minFare - b.minFare);
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      if (s.minFare < 0) return "Slab minimum fare cannot be negative.";
      if (s.maxFare !== null && s.minFare >= s.maxFare) {
        return `Slab ₹${s.minFare}–₹${s.maxFare} is invalid: minimum fare must be less than maximum fare.`;
      }
      if (s.type === "percentage" && (s.value < 0 || s.value > 100)) {
        return `Slab ₹${s.minFare}–${s.maxFare ?? "∞"} has an invalid percentage (must be 0–100).`;
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        if (prev.maxFare === null) {
          return `Slab ₹${prev.minFare}+ is open-ended and must be the last slab — it cannot be followed by another.`;
        }
        if (s.minFare < prev.maxFare) {
          return `Slabs ₹${prev.minFare}–₹${prev.maxFare} and ₹${s.minFare}–${s.maxFare ?? "∞"} overlap.`;
        }
      }
    }
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CommissionComputeResult {
  platformCommission: number;
  driverEarnings: number;
  appliedMethod: CommissionMethod;
  appliedSlab?: CommissionSlab;
  clampedByMin: boolean;
  clampedByMax: boolean;
}

// Shared pure math — used both by the live admin preview panel and by the
// real payout split (api/commission-router.ts), so the preview an admin
// sees is guaranteed to match what actually gets deducted from a driver's
// payout. `applyAfterTax` (Section G) isn't wired to real tax-timing yet —
// rides don't currently carry their pre-tax subtotal forward to the
// payment-settlement step where commission is computed — so it's stored
// but has no effect on this calculation yet, same "future support" status
// as Fare Configuration's toll auto-mode.
export function computeVehicleCommission(
  config: CommissionVehicleConfig,
  rideFare: number,
  paymentMethod?: "cash" | "upi" | "wallet"
): CommissionComputeResult {
  let method: CommissionMethod = config.method;
  let fixedAmount = config.fixedAmount;
  let percentageValue = config.percentageValue;

  if (paymentMethod === "cash" && config.cashOverrideEnabled) {
    method = config.cashMethod;
    fixedAmount = config.cashFixedAmount;
    percentageValue = config.cashPercentageValue;
  } else if ((paymentMethod === "upi" || paymentMethod === "wallet") && config.onlineOverrideEnabled) {
    method = config.onlineMethod;
    fixedAmount = config.onlineFixedAmount;
    percentageValue = config.onlinePercentageValue;
  }

  let commission: number;
  let appliedSlab: CommissionSlab | undefined;
  if (method === "fixed") {
    commission = fixedAmount;
  } else if (method === "percentage") {
    commission = round2(rideFare * (percentageValue / 100));
  } else {
    appliedSlab = config.slabs.find((s) => rideFare >= s.minFare && (s.maxFare === null || rideFare <= s.maxFare));
    commission = appliedSlab ? (appliedSlab.type === "fixed" ? appliedSlab.value : round2(rideFare * (appliedSlab.value / 100))) : 0;
  }

  // "Fixed commission cannot exceed the ride fare" — enforced here for
  // every method, not just literal Fixed Amount, since a large percentage/
  // slab value could produce the same problem on a small fare.
  commission = Math.min(commission, rideFare);

  let clampedByMin = false;
  let clampedByMax = false;
  if (config.minCommission > 0 && commission < config.minCommission) {
    commission = Math.min(config.minCommission, rideFare);
    clampedByMin = true;
  }
  if (config.maxCommission !== null && commission > config.maxCommission) {
    commission = config.maxCommission;
    clampedByMax = true;
  }

  commission = round2(commission);
  return {
    platformCommission: commission,
    driverEarnings: round2(rideFare - commission),
    appliedMethod: method,
    appliedSlab,
    clampedByMin,
    clampedByMax,
  };
}
