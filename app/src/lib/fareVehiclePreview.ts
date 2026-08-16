import type { FareVehicleConfig } from "@/contexts/FareConfigContext";

// Client-side duplicate of api/queries/fareVehicleConfig.ts's
// computeVehicleFareBreakdown — deliberately duplicated (not imported, same
// reasoning as FareConfigContext.tsx's fallback data / deriveFareVehicleId)
// so the admin's live Fare Preview panel (Section H) can recompute instantly
// against in-progress, unsaved draft edits with no network round-trip. If
// this math ever changes, update both copies.

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function minutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

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
  const now = new Date(inputs.atTimestamp);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
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
