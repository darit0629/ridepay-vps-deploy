import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  getOrCreateWallet,
  adjustWallet,
  rechargeWallet,
  creditCustomerWallet,
  debitWallet,
  requestWithdrawal,
  listWithdrawalRequests,
  resolveWithdrawal,
  cancelWithdrawal,
  retryPayout,
  listTransactions,
  listWallets,
  earningsSummaryFor,
  freezeWallet,
  unfreezeWallet,
  reverseTransaction,
  settleDuePayouts,
} from "./queries/wallets";
import { requestDriverWithdrawal } from "./queries/payouts";
import { getFinanceSettings, updateFinanceSettings, type FinanceSettings } from "./queries/financeSettings";

// Re-exported so cancellation-router.ts, commission-router.ts,
// referral-router.ts, and school-router.ts don't need to change their
// `from "./settlement-router"` imports — the actual persistence now lives in
// queries/wallets.ts (this file is just the tRPC-facing surface over it).
export {
  creditWalletsFromCommission,
  creditReferralBonus,
  chargeCancellationFee,
  creditCancellationCompensation,
  creditCompanyRevenue,
} from "./queries/wallets";

const walletTypeSchema = z.enum(["driver", "company", "fleet", "referral", "franchise", "customer"]);

export const settlementRouter = createRouter({
  getWallet: publicQuery
    .input(z.object({ walletType: walletTypeSchema, ownerId: z.string().min(1) }))
    .query(async ({ input }) => {
      if (input.walletType === "driver") await settleDuePayouts();
      return {
        ...(await getOrCreateWallet(input.walletType, input.ownerId)),
        earnings: await earningsSummaryFor(input.walletType, input.ownerId),
      };
    }),

  listWallets: publicQuery
    .input(z.object({ walletType: walletTypeSchema.optional() }).optional())
    .query(async ({ input }) => {
      const wallets = await listWallets({ walletType: input?.walletType });
      return Promise.all(wallets.map(async (w) => ({ ...w, earnings: await earningsSummaryFor(w.walletType, w.ownerId) })));
    }),

  listTransactions: publicQuery
    .input(
      z.object({
        walletType: walletTypeSchema.optional(),
        ownerId: z.string().optional(),
        limit: z.number().int().positive().max(200).default(50),
      })
    )
    .query(({ input }) => listTransactions(input)),

  // Bonuses/incentives/penalties/manual adjustments — the non-ride-driven
  // wallet movements the spec calls out for the driver wallet breakdown.
  adjustWallet: publicQuery
    .input(
      z.object({
        walletType: walletTypeSchema,
        ownerId: z.string().min(1),
        amount: z.number(), // negative for penalties/deductions
        type: z.enum(["bonus", "incentive", "penalty", "adjustment", "festival_bonus", "challenge_reward", "peak_bonus"]),
        description: z.string().trim().min(1).max(200),
      })
    )
    .mutation(({ input }) => adjustWallet(input.walletType, input.ownerId, input.amount, input.type, input.description)),

  freezeWallet: publicQuery
    .input(z.object({ walletType: walletTypeSchema, ownerId: z.string().min(1), reason: z.string().trim().min(1).max(255) }))
    .mutation(({ input }) => freezeWallet(input.walletType, input.ownerId, input.reason)),

  unfreezeWallet: publicQuery
    .input(z.object({ walletType: walletTypeSchema, ownerId: z.string().min(1) }))
    .mutation(({ input }) => unfreezeWallet(input.walletType, input.ownerId)),

  // Immutable-ledger reversal — inserts a real offsetting transaction rather
  // than editing/deleting the original.
  reverseTransaction: publicQuery
    .input(z.object({ transactionId: z.string().min(1), adminNote: z.string().trim().min(1).max(200) }))
    .mutation(({ input }) => reverseTransaction(input.transactionId, input.adminNote)),

  // Customer wallet recharge — Add Money actually credits a server-side
  // balance now instead of writing straight to localStorage, so it survives
  // across devices and can't just be edited in devtools.
  rechargeWallet: publicQuery
    .input(
      z.object({
        ownerId: z.string().min(1),
        amount: z.number().positive(),
        method: z.enum(["upi", "card", "netbanking"]).default("upi"),
      })
    )
    .mutation(({ input }) => rechargeWallet(input.ownerId, input.amount, input.method)),

  creditCustomerWallet: publicQuery
    .input(
      z.object({
        ownerId: z.string().min(1),
        amount: z.number().positive(),
        type: z.enum(["refund", "cashback", "promotional_credit", "referral_credit"]),
        description: z.string().trim().min(1).max(200),
      })
    )
    .mutation(({ input }) => creditCustomerWallet(input.ownerId, input.amount, input.type, input.description)),

  // Server-validated spend — the wallet-payment branch of ride/parcel
  // checkout calls this instead of reading/writing localStorage directly, so
  // the balance check (and the deduction itself) can't be bypassed client-side.
  debitWallet: publicQuery
    .input(
      z.object({
        walletType: walletTypeSchema,
        ownerId: z.string().min(1),
        amount: z.number().positive(),
        type: z.enum(["debit", "coupon_discount"]).default("debit"),
        description: z.string().trim().min(1).max(200),
      })
    )
    .mutation(({ input }) => debitWallet(input.walletType, input.ownerId, input.amount, input.type, input.description)),

  // Driver withdrawals go through the validation-gated wrapper (KYC/bank-or-
  // UPI/frozen/limits — see queries/payouts.ts); every other wallet type
  // (company/fleet/referral/franchise — admin-internal, no KYC concept)
  // keeps the old, unvalidated direct path.
  requestWithdrawal: publicQuery
    .input(z.object({
      walletType: walletTypeSchema,
      ownerId: z.string().min(1),
      amount: z.number().positive(),
      method: z.enum(["bank", "upi"]).default("bank"),
    }))
    .mutation(({ input }) =>
      input.walletType === "driver"
        ? requestDriverWithdrawal(input.ownerId, input.amount, input.method)
        : requestWithdrawal(input.walletType, input.ownerId, input.amount, input.method, "manual")
    ),

  cancelWithdrawal: publicQuery
    .input(z.object({ id: z.string(), ownerId: z.string().min(1) }))
    .mutation(({ input }) => cancelWithdrawal(input.id, input.ownerId)),

  retryPayout: publicQuery.input(z.object({ id: z.string() })).mutation(({ input }) => retryPayout(input.id)),

  listWithdrawalRequests: publicQuery
    .input(
      z
        .object({
          walletType: walletTypeSchema.optional(),
          ownerId: z.string().optional(),
          status: z.enum(["pending", "approved", "processing", "completed", "rejected", "failed", "cancelled"]).optional(),
        })
        .optional()
    )
    .query(({ input }) => listWithdrawalRequests(input ?? {})),

  resolveWithdrawal: publicQuery
    .input(z.object({ id: z.string(), approve: z.boolean() }))
    .mutation(({ input }) => resolveWithdrawal(input.id, input.approve)),

  getFinanceSettings: publicQuery.query(() => getFinanceSettings()),

  updateFinanceSettings: publicQuery
    .input(
      z.object({
        automaticPayout: z.boolean().optional(),
        automaticDailySettlement: z.boolean().optional(),
        automaticWeeklySettlement: z.boolean().optional(),
        minWithdrawal: z.number().nonnegative().optional(),
        maxWithdrawal: z.number().positive().optional(),
        dailyWithdrawalLimit: z.number().positive().optional(),
        maxRequestsPerDay: z.number().int().positive().optional(),
        manualApprovalRequired: z.boolean().optional(),
        holidaySettlementPause: z.boolean().optional(),
      }) satisfies z.ZodType<Partial<FinanceSettings>>
    )
    .mutation(({ input }) => updateFinanceSettings(input)),
});
