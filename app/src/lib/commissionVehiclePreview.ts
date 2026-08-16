// Client-side duplicate of api/queries/commissionVehicleConfig.ts's
// computeVehicleCommission/validateCommissionVehicleConfig — deliberately
// duplicated (not imported), same reasoning as fareVehiclePreview.ts, so
// the admin's live Commission Preview panel (Section F) can recompute
// instantly against in-progress, unsaved draft edits with no network
// round-trip. If this math ever changes, update both copies.

export type CommissionMethod = "fixed" | "percentage" | "slab";
export type CommissionOverrideMethod = "fixed" | "percentage";

export interface CommissionSlab {
  id: string;
  minFare: number;
  maxFare: number | null;
  type: "fixed" | "percentage";
  value: number;
}

export interface CommissionVehicleConfigLike {
  method: CommissionMethod;
  fixedAmount: number;
  percentageValue: number;
  slabs: CommissionSlab[];
  minCommission: number;
  maxCommission: number | null;
  cashOverrideEnabled: boolean;
  cashMethod: CommissionOverrideMethod;
  cashFixedAmount: number;
  cashPercentageValue: number;
  onlineOverrideEnabled: boolean;
  onlineMethod: CommissionOverrideMethod;
  onlineFixedAmount: number;
  onlinePercentageValue: number;
}

export interface CommissionComputeResult {
  platformCommission: number;
  driverEarnings: number;
  appliedMethod: CommissionMethod;
  appliedSlab?: CommissionSlab;
  clampedByMin: boolean;
  clampedByMax: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeVehicleCommission(
  config: CommissionVehicleConfigLike,
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
