// Client-side duplicate of api/queries/cancellationVehicleConfig.ts's
// simulateCancellation — deliberately duplicated (not imported), same
// reasoning as fareVehiclePreview.ts / commissionVehiclePreview.ts, so the
// admin's live Section G preview panel can recompute instantly against
// in-progress, unsaved draft edits with no network round-trip. If this
// logic ever changes, update both copies.

export type DriverPenaltyType = "fixed" | "percentage" | "warning";

export interface CancellationVehicleConfigLike {
  passengerCancellationEnabled: boolean;
  passengerFreeCancellationMin: number;
  passengerFeeType: "fixed" | "percentage";
  passengerFeeFixedAmount: number;
  passengerFeePercentage: number;
  passengerMaxFee: number | null;
  driverCancellationEnabled: boolean;
  driverFreeCancellationMin: number;
  driverPenaltyType: DriverPenaltyType;
  driverPenaltyFixedAmount: number;
  driverPenaltyPercentage: number;
  passengerNoShowWaitMin: number;
  passengerNoShowCharge: number;
  driverNoShowResponseMin: number;
}

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeDriverPenalty(config: CancellationVehicleConfigLike, rideFare: number): number {
  if (config.driverPenaltyType === "warning") return 0;
  if (config.driverPenaltyType === "fixed") return config.driverPenaltyFixedAmount;
  return round2(rideFare * (config.driverPenaltyPercentage / 100));
}

export function simulateCancellation(config: CancellationVehicleConfigLike, input: CancellationSimulationInput): CancellationSimulationResult {
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

export function validateCancellationVehicleConfig(config: {
  passengerFreeCancellationMin: number;
  passengerFeeType: "fixed" | "percentage";
  passengerFeeFixedAmount: number;
  passengerFeePercentage: number;
  passengerMaxFee: number | null;
  driverFreeCancellationMin: number;
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
