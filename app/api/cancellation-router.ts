import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { chargeCancellationFee, creditCancellationCompensation } from "./settlement-router";
import {
  getCancellationConfig,
  updateCancellationConfig,
  insertCancellationRecord,
  listCancellationRecords,
  countCancellationsToday,
  type CancellationConfig,
} from "./queries/cancellation";
import {
  listCancellationVehicleConfigs,
  getCancellationVehicleConfig,
  updateCancellationVehicleConfig,
  duplicateCancellationVehicleConfig,
  restoreDefaultCancellationVehicleConfig,
  seedCancellationVehicleConfigsIfEmpty,
  validateCancellationVehicleConfig,
  simulateCancellation,
  type CancellationVehicleConfig,
} from "./queries/cancellationVehicleConfig";
import { fareVehicleTypeEnum, cancellationFeeTypeEnum, driverPenaltyTypeEnum } from "@db/schema";

export type { VehicleTypeId, CancellationConfig, CancellationRecord } from "./queries/cancellation";
export type { CancellationVehicleConfig, CancellationReason, CancellationSimulationResult } from "./queries/cancellationVehicleConfig";

void seedCancellationVehicleConfigsIfEmpty();

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const fareVehicleTypeSchema = z.enum(fareVehicleTypeEnum);
const stageSchema = z.enum(["searching", "matched"]);
const initiatorSchema = z.enum(["rider", "driver"]);

// Real outcome for a rider cancellation — used by both the preview query and
// the actual record-and-charge mutation, so what the rider is warned about
// is always exactly what they get charged. Wraps simulateCancellation with
// the two things a pure per-vehicle-config function can't know on its own:
// the free time window's start point (matchedAtMs) and today's cancellation
// count (Section F's daily allowance).
async function computePassengerOutcome(input: {
  stage: "searching" | "matched";
  fareVehicleType: (typeof fareVehicleTypeEnum)[number];
  fareAmount: number;
  matchedAtMs: number | null;
  riderName: string;
}): Promise<{ fee: number; waived: boolean; waiveReason?: string }> {
  if (input.stage === "searching") {
    return { fee: 0, waived: true, waiveReason: "No driver was assigned yet" };
  }

  const config = await getCancellationVehicleConfig(input.fareVehicleType);
  const elapsedMin = input.matchedAtMs ? (Date.now() - input.matchedAtMs) / 60000 : Infinity;

  if (elapsedMin <= config.passengerFreeCancellationMin) {
    return { fee: 0, waived: true, waiveReason: `Cancelled within the ${config.passengerFreeCancellationMin} min free cancellation window` };
  }

  // Section F — the rider's first N 'matched'-stage cancellations today are
  // free regardless of timing, replacing an earlier per-login-session
  // version of this same rule with a real, server-tracked daily count.
  const todayCount = await countCancellationsToday({ riderName: input.riderName });
  if (todayCount < config.passengerMaxFreeCancellationsPerDay) {
    return { fee: 0, waived: true, waiveReason: `Free cancellation (${todayCount + 1} of ${config.passengerMaxFreeCancellationsPerDay} allowed today)` };
  }

  if (!config.passengerCancellationEnabled) {
    return { fee: 0, waived: true, waiveReason: "Passenger cancellation fees are disabled for this vehicle type" };
  }

  let fee = config.passengerFeeType === "fixed" ? config.passengerFeeFixedAmount : round2(input.fareAmount * (config.passengerFeePercentage / 100));
  if (config.passengerMaxFee !== null) fee = Math.min(fee, config.passengerMaxFee);
  return { fee: round2(fee), waived: false };
}

export interface DriverCancellationOutcome {
  penalty: number;
  penaltyType: "fixed" | "percentage" | "warning";
  isFree: boolean;
  explanation: string;
}

// Real outcome for a driver-initiated cancellation — used by ride-router.ts's
// driverCancel mutation (Section B: free window + fixed/percentage/warning
// penalty; Section F: daily cancellation count). No-show detection
// (Section C) and auto-cancellation (Section D) aren't wired into a live
// enforcement point yet — see the memory note on this redesign for why —
// so this only covers an explicit "Cancel Ride" action, not a passive
// no-show timeout.
export async function computeDriverCancellationOutcome(input: {
  fareVehicleType: (typeof fareVehicleTypeEnum)[number];
  fareAmount: number;
  acceptedAtMs: number | null;
  driverName: string;
}): Promise<DriverCancellationOutcome> {
  const config = await getCancellationVehicleConfig(input.fareVehicleType);
  const elapsedMin = input.acceptedAtMs ? (Date.now() - input.acceptedAtMs) / 60000 : Infinity;

  if (elapsedMin <= config.driverFreeCancellationMin) {
    return {
      penalty: 0,
      penaltyType: config.driverPenaltyType,
      isFree: true,
      explanation: `Cancelled within the ${config.driverFreeCancellationMin} min free window — no penalty.`,
    };
  }

  const todayCount = await countCancellationsToday({ driverName: input.driverName });
  if (todayCount < config.driverMaxDailyCancellations) {
    return {
      penalty: 0,
      penaltyType: config.driverPenaltyType,
      isFree: true,
      explanation: `Free cancellation (${todayCount + 1} of ${config.driverMaxDailyCancellations} allowed today).`,
    };
  }

  if (!config.driverCancellationEnabled) {
    return { penalty: 0, penaltyType: config.driverPenaltyType, isFree: true, explanation: "Driver cancellation penalties are disabled for this vehicle type." };
  }

  const penalty =
    config.driverPenaltyType === "warning" ? 0
    : config.driverPenaltyType === "fixed" ? config.driverPenaltyFixedAmount
    : round2(input.fareAmount * (config.driverPenaltyPercentage / 100));

  return {
    penalty,
    penaltyType: config.driverPenaltyType,
    isFree: penalty === 0,
    explanation:
      config.driverPenaltyType === "warning"
        ? `Past the ${config.driverFreeCancellationMin} min free window and today's ${config.driverMaxDailyCancellations} free cancellations — a warning is recorded.`
        : `Past the ${config.driverFreeCancellationMin} min free window and today's ${config.driverMaxDailyCancellations} free cancellations — ₹${penalty} penalty applies.`,
  };
}

const cancellationReasonSchema = z.object({ id: z.string(), label: z.string().trim().min(1).max(80), enabled: z.boolean() });

const cancellationVehicleConfigUpdateSchema = z.object({
  passengerCancellationEnabled: z.boolean().optional(),
  passengerFreeCancellationMin: z.number().int().min(0).optional(),
  passengerFeeType: z.enum(cancellationFeeTypeEnum).optional(),
  passengerFeeFixedAmount: z.number().min(0).optional(),
  passengerFeePercentage: z.number().min(0).max(100).optional(),
  passengerMaxFee: z.number().min(0).nullable().optional(),
  driverCancellationEnabled: z.boolean().optional(),
  driverFreeCancellationMin: z.number().int().min(0).optional(),
  driverPenaltyType: z.enum(driverPenaltyTypeEnum).optional(),
  driverPenaltyFixedAmount: z.number().min(0).optional(),
  driverPenaltyPercentage: z.number().min(0).max(100).optional(),
  passengerNoShowWaitMin: z.number().int().min(0).optional(),
  passengerNoShowCharge: z.number().min(0).optional(),
  driverNoShowResponseMin: z.number().int().min(0).optional(),
  autoCancelDriverAcceptEnabled: z.boolean().optional(),
  autoCancelDriverAcceptMin: z.number().int().min(0).optional(),
  autoCancelPassengerConfirmEnabled: z.boolean().optional(),
  autoCancelPassengerConfirmMin: z.number().int().min(0).optional(),
  autoCancelDriverReachPickupEnabled: z.boolean().optional(),
  autoCancelDriverReachPickupMin: z.number().int().min(0).optional(),
  passengerReasons: z.array(cancellationReasonSchema).optional(),
  driverReasons: z.array(cancellationReasonSchema).optional(),
  passengerMaxFreeCancellationsPerDay: z.number().int().min(0).optional(),
  passengerWarningThreshold: z.number().int().min(0).optional(),
  passengerRestrictionEnabled: z.boolean().optional(),
  passengerRestrictionHours: z.number().int().min(0).optional(),
  driverMaxDailyCancellations: z.number().int().min(0).optional(),
  driverWarningThreshold: z.number().int().min(0).optional(),
  driverRestrictionEnabled: z.boolean().optional(),
  driverRestrictionHours: z.number().int().min(0).optional(),
  driverAccountReviewThreshold: z.number().int().min(0).optional(),
});

export const cancellationRouter = createRouter({
  getConfig: publicQuery.query(() => getCancellationConfig()),

  updateConfig: publicQuery
    .input(
      z.object({
        freeCancellationWindowSec: z.number().int().min(0).max(600),
        driverCompensationPercent: z.number().min(0).max(100),
      })
    )
    .mutation(({ input }) => updateCancellationConfig(input as CancellationConfig)),

  // Section A–G per-vehicle-type cancellation rules — backs the redesigned
  // Cancellation Rules admin page.
  listVehicleConfigs: publicQuery.query(() => listCancellationVehicleConfigs()),

  getVehicleConfig: publicQuery
    .input(z.object({ id: fareVehicleTypeSchema }))
    .query(({ input }) => getCancellationVehicleConfig(input.id)),

  updateVehicleConfig: publicQuery
    .input(z.object({ id: fareVehicleTypeSchema, updates: cancellationVehicleConfigUpdateSchema }))
    .mutation(async ({ input }) => {
      const current = await getCancellationVehicleConfig(input.id);
      const merged: CancellationVehicleConfig = { ...current, ...input.updates };
      const error = validateCancellationVehicleConfig(merged);
      if (error) throw new Error(error);
      return updateCancellationVehicleConfig(input.id, input.updates);
    }),

  duplicateVehicleConfig: publicQuery
    .input(z.object({ fromId: fareVehicleTypeSchema, toId: fareVehicleTypeSchema }))
    .mutation(({ input }) => duplicateCancellationVehicleConfig(input.fromId, input.toId)),

  restoreDefaultVehicleConfig: publicQuery
    .input(z.object({ id: fareVehicleTypeSchema }))
    .mutation(({ input }) => restoreDefaultCancellationVehicleConfig(input.id)),

  // Section G — live rule simulator. Pure section A–C math only (no daily-
  // count/session state), so it reflects exactly what the configured rules
  // say — the real daily-allowance check (computePassengerOutcome below)
  // additionally depends on today's actual cancellation history, which a
  // what-if simulator intentionally doesn't reach into.
  simulateVehicleConfig: publicQuery
    .input(
      z.object({
        id: fareVehicleTypeSchema,
        rideFare: z.number().nonnegative(),
        timeSinceBookingMin: z.number().nonnegative(),
        waitingTimeMin: z.number().nonnegative(),
        whoCancelled: z.enum(["passenger", "driver"]),
      })
    )
    .query(async ({ input }) => {
      const config = await getCancellationVehicleConfig(input.id);
      return simulateCancellation(config, {
        rideFare: input.rideFare,
        timeSinceBookingMin: input.timeSinceBookingMin,
        waitingTimeMin: input.waitingTimeMin,
        whoCancelled: input.whoCancelled,
      });
    }),

  // Lets the client show "Cancelling now may cost ₹X" before the rider
  // commits — computed with the exact same logic that will actually be
  // charged, so there's never a surprise between preview and confirm.
  previewFee: publicQuery
    .input(
      z.object({
        vehicleType: fareVehicleTypeSchema,
        stage: stageSchema,
        fareAmount: z.number().min(0),
        matchedAtMs: z.number().nullable(),
        riderName: z.string().trim().min(1).max(80),
      })
    )
    .query(({ input }) =>
      computePassengerOutcome({
        stage: input.stage,
        fareVehicleType: input.vehicleType,
        fareAmount: input.fareAmount,
        matchedAtMs: input.matchedAtMs,
        riderName: input.riderName,
      })
    ),

  record: publicQuery
    .input(
      z.object({
        vehicleType: fareVehicleTypeSchema,
        stage: stageSchema,
        initiator: initiatorSchema,
        reason: z.string().trim().min(1).max(200),
        riderName: z.string().trim().min(1).max(80),
        driverName: z.string().trim().max(80).optional(),
        fareAmount: z.number().min(0),
        matchedAtMs: z.number().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const { fee, waived, waiveReason } = await computePassengerOutcome({
        stage: input.stage,
        fareVehicleType: input.vehicleType,
        fareAmount: input.fareAmount,
        matchedAtMs: input.matchedAtMs,
        riderName: input.riderName,
      });
      const config = await getCancellationConfig();

      // Fees are only ever collected from the rider — a driver-initiated
      // cancellation is handled by ride.driverCancel instead (its own
      // penalty, not a rider-facing fee).
      let feeCharged = 0;
      let driverCompensation = 0;
      if (fee > 0 && input.initiator === "rider") {
        const { debited, deferred } = await chargeCancellationFee(
          input.riderName,
          fee,
          `Cancellation fee — ${input.vehicleType} ride cancelled after driver was dispatched`
        );
        feeCharged = round2(debited + deferred);
        driverCompensation = round2(feeCharged * (config.driverCompensationPercent / 100));
        if (input.driverName && driverCompensation > 0) {
          await creditCancellationCompensation(
            input.driverName,
            driverCompensation,
            `Cancellation compensation — rider cancelled after dispatch`
          );
        }
      }

      return insertCancellationRecord({
        fareVehicleType: input.vehicleType,
        stage: input.stage,
        initiator: input.initiator,
        reason: input.reason,
        riderName: input.riderName,
        driverName: input.driverName,
        fareAmount: input.fareAmount,
        feeCharged,
        feeWaived: waived,
        waiveReason,
        driverCompensation,
        driverPenalty: 0,
      });
    }),

  listRecords: publicQuery
    .input(z.object({ riderName: z.string().optional(), limit: z.number().int().positive().max(500).default(200) }).optional())
    .query(({ input }) => listCancellationRecords({ riderName: input?.riderName, limit: input?.limit ?? 200 })),
});
