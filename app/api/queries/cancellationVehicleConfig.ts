import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { cancellationVehicleConfigs } from "@db/schema";
import { FARE_VEHICLE_LABELS, type FareVehicleTypeId } from "./fareVehicleConfig";

export type CancellationFeeType = "fixed" | "percentage";
export type DriverPenaltyType = "fixed" | "percentage" | "warning";

export interface CancellationReason {
  id: string;
  label: string;
  enabled: boolean;
}

export interface CancellationVehicleConfig {
  id: FareVehicleTypeId;
  label: string;

  passengerCancellationEnabled: boolean;
  passengerFreeCancellationMin: number;
  passengerFeeType: CancellationFeeType;
  passengerFeeFixedAmount: number;
  passengerFeePercentage: number;
  /** null = no cap */
  passengerMaxFee: number | null;

  driverCancellationEnabled: boolean;
  driverFreeCancellationMin: number;
  driverPenaltyType: DriverPenaltyType;
  driverPenaltyFixedAmount: number;
  driverPenaltyPercentage: number;

  passengerNoShowWaitMin: number;
  passengerNoShowCharge: number;
  driverNoShowResponseMin: number;

  autoCancelDriverAcceptEnabled: boolean;
  autoCancelDriverAcceptMin: number;
  autoCancelPassengerConfirmEnabled: boolean;
  autoCancelPassengerConfirmMin: number;
  autoCancelDriverReachPickupEnabled: boolean;
  autoCancelDriverReachPickupMin: number;

  passengerReasons: CancellationReason[];
  driverReasons: CancellationReason[];

  passengerMaxFreeCancellationsPerDay: number;
  passengerWarningThreshold: number;
  passengerRestrictionEnabled: boolean;
  passengerRestrictionHours: number;
  driverMaxDailyCancellations: number;
  driverWarningThreshold: number;
  driverRestrictionEnabled: boolean;
  driverRestrictionHours: number;
  driverAccountReviewThreshold: number;
}

export const CANCELLATION_VEHICLE_LABELS = FARE_VEHICLE_LABELS;
const VEHICLE_IDS = Object.keys(FARE_VEHICLE_LABELS) as FareVehicleTypeId[];

const DEFAULT_PASSENGER_REASONS: CancellationReason[] = [
  { id: "p-1", label: "Changed my mind", enabled: true },
  { id: "p-2", label: "Driver is taking too long", enabled: true },
  { id: "p-3", label: "Booked by mistake", enabled: true },
  { id: "p-4", label: "Found another ride", enabled: true },
  { id: "p-5", label: "Emergency", enabled: true },
];

const DEFAULT_DRIVER_REASONS: CancellationReason[] = [
  { id: "d-1", label: "Passenger not reachable", enabled: true },
  { id: "d-2", label: "Vehicle issue", enabled: true },
  { id: "d-3", label: "Wrong pickup location", enabled: true },
  { id: "d-4", label: "Emergency", enabled: true },
  { id: "d-5", label: "Safety concern", enabled: true },
];

// One shared baseline for every vehicle type — matches the pattern used for
// fare/commission defaults. Admins differentiate per type afterwards.
function defaultRow(id: FareVehicleTypeId) {
  return {
    id,
    label: CANCELLATION_VEHICLE_LABELS[id],
    passengerCancellationEnabled: true,
    passengerFreeCancellationMin: 2,
    passengerFeeType: "fixed" as CancellationFeeType,
    passengerFeeFixedAmount: "25",
    passengerFeePercentage: "10",
    passengerMaxFee: "50",
    driverCancellationEnabled: true,
    driverFreeCancellationMin: 1,
    driverPenaltyType: "warning" as DriverPenaltyType,
    driverPenaltyFixedAmount: "20",
    driverPenaltyPercentage: "10",
    passengerNoShowWaitMin: 5,
    passengerNoShowCharge: "25",
    driverNoShowResponseMin: 10,
    autoCancelDriverAcceptEnabled: true,
    autoCancelDriverAcceptMin: 5,
    autoCancelPassengerConfirmEnabled: false,
    autoCancelPassengerConfirmMin: 3,
    autoCancelDriverReachPickupEnabled: false,
    autoCancelDriverReachPickupMin: 20,
    passengerReasons: DEFAULT_PASSENGER_REASONS,
    driverReasons: DEFAULT_DRIVER_REASONS,
    passengerMaxFreeCancellationsPerDay: 2,
    passengerWarningThreshold: 3,
    passengerRestrictionEnabled: false,
    passengerRestrictionHours: 24,
    driverMaxDailyCancellations: 3,
    driverWarningThreshold: 4,
    driverRestrictionEnabled: false,
    driverRestrictionHours: 24,
    driverAccountReviewThreshold: 6,
  };
}

export async function seedCancellationVehicleConfigsIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(cancellationVehicleConfigs);
  if (Number(count) > 0) return;
  await db.insert(cancellationVehicleConfigs).values(VEHICLE_IDS.map(defaultRow));
}

function toView(row: typeof cancellationVehicleConfigs.$inferSelect): CancellationVehicleConfig {
  return {
    id: row.id,
    label: row.label,
    passengerCancellationEnabled: row.passengerCancellationEnabled,
    passengerFreeCancellationMin: row.passengerFreeCancellationMin,
    passengerFeeType: row.passengerFeeType,
    passengerFeeFixedAmount: Number(row.passengerFeeFixedAmount),
    passengerFeePercentage: Number(row.passengerFeePercentage),
    passengerMaxFee: row.passengerMaxFee === null ? null : Number(row.passengerMaxFee),
    driverCancellationEnabled: row.driverCancellationEnabled,
    driverFreeCancellationMin: row.driverFreeCancellationMin,
    driverPenaltyType: row.driverPenaltyType,
    driverPenaltyFixedAmount: Number(row.driverPenaltyFixedAmount),
    driverPenaltyPercentage: Number(row.driverPenaltyPercentage),
    passengerNoShowWaitMin: row.passengerNoShowWaitMin,
    passengerNoShowCharge: Number(row.passengerNoShowCharge),
    driverNoShowResponseMin: row.driverNoShowResponseMin,
    autoCancelDriverAcceptEnabled: row.autoCancelDriverAcceptEnabled,
    autoCancelDriverAcceptMin: row.autoCancelDriverAcceptMin,
    autoCancelPassengerConfirmEnabled: row.autoCancelPassengerConfirmEnabled,
    autoCancelPassengerConfirmMin: row.autoCancelPassengerConfirmMin,
    autoCancelDriverReachPickupEnabled: row.autoCancelDriverReachPickupEnabled,
    autoCancelDriverReachPickupMin: row.autoCancelDriverReachPickupMin,
    passengerReasons: row.passengerReasons,
    driverReasons: row.driverReasons,
    passengerMaxFreeCancellationsPerDay: row.passengerMaxFreeCancellationsPerDay,
    passengerWarningThreshold: row.passengerWarningThreshold,
    passengerRestrictionEnabled: row.passengerRestrictionEnabled,
    passengerRestrictionHours: row.passengerRestrictionHours,
    driverMaxDailyCancellations: row.driverMaxDailyCancellations,
    driverWarningThreshold: row.driverWarningThreshold,
    driverRestrictionEnabled: row.driverRestrictionEnabled,
    driverRestrictionHours: row.driverRestrictionHours,
    driverAccountReviewThreshold: row.driverAccountReviewThreshold,
  };
}

export async function listCancellationVehicleConfigs(): Promise<CancellationVehicleConfig[]> {
  const rows = await getDb().select().from(cancellationVehicleConfigs);
  return rows.map(toView);
}

export async function getCancellationVehicleConfig(id: FareVehicleTypeId): Promise<CancellationVehicleConfig> {
  const row = await getDb().query.cancellationVehicleConfigs.findFirst({ where: eq(cancellationVehicleConfigs.id, id) });
  if (!row) throw new Error(`No cancellation config seeded for vehicle type "${id}"`);
  return toView(row);
}

const PASSTHROUGH_FIELDS = new Set<keyof CancellationVehicleConfig>([
  "passengerReasons", "driverReasons", "passengerFeeType", "driverPenaltyType",
  "passengerCancellationEnabled", "driverCancellationEnabled",
  "autoCancelDriverAcceptEnabled", "autoCancelPassengerConfirmEnabled", "autoCancelDriverReachPickupEnabled",
  "passengerRestrictionEnabled", "driverRestrictionEnabled",
  "passengerFreeCancellationMin", "driverFreeCancellationMin",
  "passengerNoShowWaitMin", "driverNoShowResponseMin",
  "autoCancelDriverAcceptMin", "autoCancelPassengerConfirmMin", "autoCancelDriverReachPickupMin",
  "passengerMaxFreeCancellationsPerDay", "passengerWarningThreshold", "passengerRestrictionHours",
  "driverMaxDailyCancellations", "driverWarningThreshold", "driverRestrictionHours", "driverAccountReviewThreshold",
]);

export async function updateCancellationVehicleConfig(
  id: FareVehicleTypeId,
  patch: Partial<Omit<CancellationVehicleConfig, "id" | "label">>
): Promise<CancellationVehicleConfig> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch) as [keyof CancellationVehicleConfig, unknown][]) {
    if (key === "passengerMaxFee") {
      values[key] = value === null ? null : String(value);
    } else {
      values[key] = PASSTHROUGH_FIELDS.has(key) ? value : String(value);
    }
  }
  if (Object.keys(values).length > 0) {
    await getDb().update(cancellationVehicleConfigs).set(values).where(eq(cancellationVehicleConfigs.id, id));
  }
  return getCancellationVehicleConfig(id);
}

export async function duplicateCancellationVehicleConfig(fromId: FareVehicleTypeId, toId: FareVehicleTypeId): Promise<CancellationVehicleConfig> {
  const source = await getCancellationVehicleConfig(fromId);
  return updateCancellationVehicleConfig(toId, {
    ...source,
    passengerReasons: source.passengerReasons.map((r) => ({ ...r, id: `${r.id}-${Date.now()}` })),
    driverReasons: source.driverReasons.map((r) => ({ ...r, id: `${r.id}-${Date.now()}` })),
  });
}

export async function restoreDefaultCancellationVehicleConfig(id: FareVehicleTypeId): Promise<CancellationVehicleConfig> {
  const d = defaultRow(id);
  return updateCancellationVehicleConfig(id, {
    passengerCancellationEnabled: true,
    passengerFreeCancellationMin: d.passengerFreeCancellationMin,
    passengerFeeType: d.passengerFeeType,
    passengerFeeFixedAmount: Number(d.passengerFeeFixedAmount),
    passengerFeePercentage: Number(d.passengerFeePercentage),
    passengerMaxFee: Number(d.passengerMaxFee),
    driverCancellationEnabled: true,
    driverFreeCancellationMin: d.driverFreeCancellationMin,
    driverPenaltyType: d.driverPenaltyType,
    driverPenaltyFixedAmount: Number(d.driverPenaltyFixedAmount),
    driverPenaltyPercentage: Number(d.driverPenaltyPercentage),
    passengerNoShowWaitMin: d.passengerNoShowWaitMin,
    passengerNoShowCharge: Number(d.passengerNoShowCharge),
    driverNoShowResponseMin: d.driverNoShowResponseMin,
    autoCancelDriverAcceptEnabled: d.autoCancelDriverAcceptEnabled,
    autoCancelDriverAcceptMin: d.autoCancelDriverAcceptMin,
    autoCancelPassengerConfirmEnabled: d.autoCancelPassengerConfirmEnabled,
    autoCancelPassengerConfirmMin: d.autoCancelPassengerConfirmMin,
    autoCancelDriverReachPickupEnabled: d.autoCancelDriverReachPickupEnabled,
    autoCancelDriverReachPickupMin: d.autoCancelDriverReachPickupMin,
    passengerReasons: d.passengerReasons.map((r) => ({ ...r, id: `${r.id}-${Date.now()}` })),
    driverReasons: d.driverReasons.map((r) => ({ ...r, id: `${r.id}-${Date.now()}` })),
    passengerMaxFreeCancellationsPerDay: d.passengerMaxFreeCancellationsPerDay,
    passengerWarningThreshold: d.passengerWarningThreshold,
    passengerRestrictionEnabled: false,
    passengerRestrictionHours: d.passengerRestrictionHours,
    driverMaxDailyCancellations: d.driverMaxDailyCancellations,
    driverWarningThreshold: d.driverWarningThreshold,
    driverRestrictionEnabled: false,
    driverRestrictionHours: d.driverRestrictionHours,
    driverAccountReviewThreshold: d.driverAccountReviewThreshold,
  });
}

// ---------------------------------------------------------------------------
// Validation — shared by the update mutation and the admin page.
// ---------------------------------------------------------------------------
export function validateCancellationVehicleConfig(config: {
  passengerFreeCancellationMin: number;
  passengerFeeType: CancellationFeeType;
  passengerFeeFixedAmount: number;
  passengerFeePercentage: number;
  passengerMaxFee: number | null;
  driverFreeCancellationMin: number;
  driverPenaltyType: DriverPenaltyType;
  driverPenaltyFixedAmount: number;
  driverPenaltyPercentage: number;
  passengerNoShowWaitMin: number;
  passengerNoShowCharge: number;
  driverNoShowResponseMin: number;
}): string | null {
  if (config.passengerFreeCancellationMin < 0) return "Free cancellation time cannot be negative.";
  if (config.driverFreeCancellationMin < 0) return "Driver free cancellation time cannot be negative.";
  if (config.passengerFeeFixedAmount < 0) return "Cancellation fee cannot be negative.";
  if (config.passengerFeePercentage < 0 || config.passengerFeePercentage > 100) return "Cancellation fee percentage cannot exceed 100%.";
  if (config.passengerMaxFee !== null && config.passengerMaxFee < 0) return "Maximum fee cannot be negative.";
  if (config.passengerFeeType === "fixed" && config.passengerMaxFee !== null && config.passengerMaxFee < config.passengerFeeFixedAmount) {
    return "Maximum fee must be greater than or equal to the cancellation fee.";
  }
  if (config.driverPenaltyFixedAmount < 0) return "Driver penalty cannot be negative.";
  if (config.driverPenaltyPercentage < 0 || config.driverPenaltyPercentage > 100) return "Driver penalty percentage cannot exceed 100%.";
  if (config.passengerNoShowWaitMin < 0) return "No-show waiting time cannot be negative.";
  if (config.passengerNoShowCharge < 0) return "No-show charge cannot be negative.";
  if (config.driverNoShowResponseMin < 0) return "Driver response time cannot be negative.";
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Shared pure simulation — used both by the live admin preview panel
// (Section G) and by the real cancellation flow, so the preview an admin
// sees is guaranteed to match what a rider/driver actually experiences.
// ---------------------------------------------------------------------------
export interface CancellationSimulationInput {
  rideFare: number;
  timeSinceBookingMin: number;
  waitingTimeMin: number;
  whoCancelled: "passenger" | "driver";
}

export interface CancellationSimulationResult {
  isFree: boolean;
  fee: number;
  penalty: number;
  penaltyType?: DriverPenaltyType;
  isNoShow: boolean;
  finalResult: string;
  explanation: string;
}

export function simulateCancellation(config: CancellationVehicleConfig, input: CancellationSimulationInput): CancellationSimulationResult {
  if (input.whoCancelled === "passenger") {
    if (input.waitingTimeMin >= config.passengerNoShowWaitMin) {
      return {
        isFree: false,
        fee: config.passengerNoShowCharge,
        penalty: 0,
        isNoShow: true,
        finalResult: `Passenger No-Show — ₹${config.passengerNoShowCharge} charged`,
        explanation: `Driver waited ${input.waitingTimeMin} min, at or past the ${config.passengerNoShowWaitMin} min no-show threshold — the ride is marked Passenger No-Show and the no-show charge applies.`,
      };
    }
    if (!config.passengerCancellationEnabled) {
      return {
        isFree: true,
        fee: 0,
        penalty: 0,
        isNoShow: false,
        finalResult: "Passenger cancellation is disabled for this vehicle type",
        explanation: "No fee rule is applied since passenger cancellation is turned off — cancellation still goes through free.",
      };
    }
    if (input.timeSinceBookingMin <= config.passengerFreeCancellationMin) {
      return {
        isFree: true,
        fee: 0,
        penalty: 0,
        isNoShow: false,
        finalResult: "Free cancellation",
        explanation: `Cancelled ${input.timeSinceBookingMin} min after booking, within the ${config.passengerFreeCancellationMin} min free window.`,
      };
    }
    let fee = config.passengerFeeType === "fixed" ? config.passengerFeeFixedAmount : round2(input.rideFare * (config.passengerFeePercentage / 100));
    let cappedNote = "";
    if (config.passengerMaxFee !== null && fee > config.passengerMaxFee) {
      fee = config.passengerMaxFee;
      cappedNote = ` (capped at the ₹${config.passengerMaxFee} maximum)`;
    }
    return {
      isFree: false,
      fee,
      penalty: 0,
      isNoShow: false,
      finalResult: `₹${fee} cancellation fee`,
      explanation:
        config.passengerFeeType === "fixed"
          ? `Cancelled ${input.timeSinceBookingMin} min after booking, past the ${config.passengerFreeCancellationMin} min free window — flat ₹${config.passengerFeeFixedAmount} fee applies${cappedNote}.`
          : `Cancelled ${input.timeSinceBookingMin} min after booking, past the ${config.passengerFreeCancellationMin} min free window — ${config.passengerFeePercentage}% of the ₹${input.rideFare} fare applies${cappedNote}.`,
    };
  }

  // Driver cancelled
  if (input.waitingTimeMin >= config.driverNoShowResponseMin) {
    const penalty = computeDriverPenalty(config, input.rideFare);
    return {
      isFree: penalty === 0,
      fee: 0,
      penalty,
      penaltyType: config.driverPenaltyType,
      isNoShow: true,
      finalResult: config.driverPenaltyType === "warning" ? "Driver No-Show — warning recorded" : `Driver No-Show — ₹${penalty} penalty`,
      explanation: `Driver didn't respond/reach pickup within ${config.driverNoShowResponseMin} min — marked Driver No-Show and the configured penalty applies.`,
    };
  }
  if (!config.driverCancellationEnabled) {
    return {
      isFree: true,
      fee: 0,
      penalty: 0,
      isNoShow: false,
      finalResult: "Driver cancellation is disabled for this vehicle type",
      explanation: "No penalty rule is applied since driver cancellation is turned off.",
    };
  }
  if (input.timeSinceBookingMin <= config.driverFreeCancellationMin) {
    return {
      isFree: true,
      fee: 0,
      penalty: 0,
      isNoShow: false,
      finalResult: "Free cancellation, no penalty",
      explanation: `Driver cancelled ${input.timeSinceBookingMin} min after accepting, within the ${config.driverFreeCancellationMin} min free window.`,
    };
  }
  const penalty = computeDriverPenalty(config, input.rideFare);
  return {
    isFree: penalty === 0,
    fee: 0,
    penalty,
    penaltyType: config.driverPenaltyType,
    isNoShow: false,
    finalResult: config.driverPenaltyType === "warning" ? "Warning recorded, no monetary penalty" : `₹${penalty} penalty`,
    explanation:
      config.driverPenaltyType === "warning"
        ? `Driver cancelled ${input.timeSinceBookingMin} min after accepting, past the ${config.driverFreeCancellationMin} min free window — a warning is recorded on the driver's account.`
        : `Driver cancelled ${input.timeSinceBookingMin} min after accepting, past the ${config.driverFreeCancellationMin} min free window.`,
  };
}

function computeDriverPenalty(config: CancellationVehicleConfig, rideFare: number): number {
  if (config.driverPenaltyType === "warning") return 0;
  if (config.driverPenaltyType === "fixed") return config.driverPenaltyFixedAmount;
  return round2(rideFare * (config.driverPenaltyPercentage / 100));
}
