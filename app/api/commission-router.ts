import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { creditWalletsFromCommission } from "./settlement-router";
import {
  getCommissionConfig,
  updateCommissionConfig,
  splitCommission,
  insertCommissionRecord,
  listCommissionRecords,
  type CommissionConfig,
  type CommissionRecord,
} from "./queries/commission";
import {
  listCommissionVehicleConfigs,
  getCommissionVehicleConfig,
  updateCommissionVehicleConfig,
  duplicateCommissionVehicleConfig,
  restoreDefaultCommissionVehicleConfig,
  seedCommissionVehicleConfigsIfEmpty,
  computeVehicleCommission,
  validateCommissionVehicleConfig,
  type CommissionVehicleConfig,
} from "./queries/commissionVehicleConfig";
import { fareVehicleTypeEnum, commissionMethodEnum } from "@db/schema";
import type { FareVehicleTypeId } from "./queries/fareVehicleConfig";

export type { CommissionConfig, CommissionRecord, CommissionSplit } from "./queries/commission";
export type { CommissionVehicleConfig, CommissionSlab, CommissionComputeResult } from "./queries/commissionVehicleConfig";

void seedCommissionVehicleConfigsIfEmpty();

// Called by ride-router.ts (confirmPayment/confirmCashPayment) and
// parcel-router.ts right after a ride or parcel is actually paid for —
// splits the total per the vehicle's configured commission rule (Commission
// Settings) plus the global secondary distributions (referral/fleet/etc,
// still admin-configured elsewhere), persists the ledger row, then credits
// every wallet its share.
export async function recordCommission(input: {
  source: "ride" | "parcel";
  sourceId: string;
  total: number;
  driverName: string;
  paymentMethod: string;
  /** Falls back to "e-riksha-share" (the cheapest/most common default) when the source has no resolved vehicle type. */
  vehicleType?: FareVehicleTypeId;
}): Promise<CommissionRecord> {
  const vehicleType = input.vehicleType ?? "e-riksha-share";
  const [config, vehicleConfig] = await Promise.all([getCommissionConfig(), getCommissionVehicleConfig(vehicleType)]);
  const paymentMethod = input.paymentMethod === "cash" || input.paymentMethod === "upi" || input.paymentMethod === "wallet" ? input.paymentMethod : undefined;
  const vehicleCommission = computeVehicleCommission(vehicleConfig, input.total, paymentMethod);
  const split = splitCommission(input.total, config, vehicleCommission);
  const record = await insertCommissionRecord({
    source: input.source,
    sourceId: input.sourceId,
    driverName: input.driverName,
    paymentMethod: input.paymentMethod,
    split,
  });
  await creditWalletsFromCommission(record);
  return record;
}

const fareVehicleTypeSchema = z.enum(fareVehicleTypeEnum);
const commissionMethodSchema = z.enum(commissionMethodEnum);
const commissionOverrideMethodSchema = z.enum(["fixed", "percentage"]);
const slabSchema = z.object({
  id: z.string(),
  minFare: z.number().nonnegative(),
  maxFare: z.number().nonnegative().nullable(),
  type: z.enum(["fixed", "percentage"]),
  value: z.number().nonnegative(),
});

const commissionVehicleConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  method: commissionMethodSchema.optional(),
  fixedAmount: z.number().nonnegative().optional(),
  percentageValue: z.number().min(0).max(100).optional(),
  slabs: z.array(slabSchema).optional(),
  minCommission: z.number().nonnegative().optional(),
  maxCommission: z.number().nonnegative().nullable().optional(),
  applyAfterTax: z.boolean().optional(),
  cashOverrideEnabled: z.boolean().optional(),
  cashMethod: commissionOverrideMethodSchema.optional(),
  cashFixedAmount: z.number().nonnegative().optional(),
  cashPercentageValue: z.number().min(0).max(100).optional(),
  onlineOverrideEnabled: z.boolean().optional(),
  onlineMethod: commissionOverrideMethodSchema.optional(),
  onlineFixedAmount: z.number().nonnegative().optional(),
  onlinePercentageValue: z.number().min(0).max(100).optional(),
});

export const commissionRouter = createRouter({
  getConfig: publicQuery.query(() => getCommissionConfig()),

  updateConfig: publicQuery
    .input(z.record(z.string(), z.union([z.number(), z.boolean()])))
    .mutation(({ input }) => updateCommissionConfig(input as Partial<CommissionConfig>)),

  listRecords: publicQuery
    .input(z.object({ limit: z.number().int().positive().max(200).default(50) }).optional())
    .query(({ input }) => listCommissionRecords(input?.limit ?? 50)),

  // Section A–G per-vehicle-type commission configuration — backs the
  // redesigned Commission Settings admin page.
  listVehicleCommissionConfigs: publicQuery.query(() => listCommissionVehicleConfigs()),

  getVehicleCommissionConfig: publicQuery
    .input(z.object({ id: fareVehicleTypeSchema }))
    .query(({ input }) => getCommissionVehicleConfig(input.id)),

  updateVehicleCommissionConfig: publicQuery
    .input(z.object({ id: fareVehicleTypeSchema, updates: commissionVehicleConfigUpdateSchema }))
    .mutation(async ({ input }) => {
      // Merge onto the current row so the validator sees the *effective*
      // config (e.g. a slab-only edit without a fresh `method` in the same
      // call still gets validated against whichever method is actually active).
      const current = await getCommissionVehicleConfig(input.id);
      const merged: CommissionVehicleConfig = { ...current, ...input.updates };
      const error = validateCommissionVehicleConfig(merged);
      if (error) throw new Error(error);
      return updateCommissionVehicleConfig(input.id, input.updates);
    }),

  duplicateVehicleCommissionConfig: publicQuery
    .input(z.object({ fromId: fareVehicleTypeSchema, toId: fareVehicleTypeSchema }))
    .mutation(({ input }) => duplicateCommissionVehicleConfig(input.fromId, input.toId)),

  restoreDefaultVehicleCommissionConfig: publicQuery
    .input(z.object({ id: fareVehicleTypeSchema }))
    .mutation(({ input }) => restoreDefaultCommissionVehicleConfig(input.id)),
});
