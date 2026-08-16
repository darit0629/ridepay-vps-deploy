import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getSubscription } from "./queries/school";
import {
  createSubscriptionCheckout,
  verifySubscriptionCheckoutSignature,
  listInvoices,
  listFailedPayments,
  getBillingSettings,
  updateBillingSettings,
  resyncSubscriptionFromRazorpay,
} from "./queries/schoolBilling";

async function requireOwnedSubscription(id: string, userId: number) {
  const sub = await getSubscription(id);
  if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found." });
  if (sub.guardianUserId != null && sub.guardianUserId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this subscription." });
  }
  return sub;
}

export const schoolBillingRouter = createRouter({
  createCheckout: authedQuery
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedSubscription(input.subscriptionId, ctx.user.id);
      return createSubscriptionCheckout(input.subscriptionId);
    }),

  verifyCheckout: authedQuery
    .input(z.object({ subscriptionId: z.string(), razorpay_payment_id: z.string(), razorpay_subscription_id: z.string(), razorpay_signature: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedSubscription(input.subscriptionId, ctx.user.id);
      const verified = verifySubscriptionCheckoutSignature(input);
      // Optimistic UI confirmation only — never mutates schoolSubscriptions.
      // The webhook (handleWebhookEvent) is the sole writer of billing state.
      return { verified };
    }),

  listInvoices: authedQuery
    .input(z.object({ subscriptionId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOwnedSubscription(input.subscriptionId, ctx.user.id);
      return listInvoices(input.subscriptionId);
    }),

  listFailedPayments: adminQuery.query(() => listFailedPayments()),

  getBillingSettings: adminQuery.query(() => getBillingSettings()),

  updateBillingSettings: adminQuery
    .input(
      z.object({
        gracePeriodDays: z.number().int().positive().max(30).optional(),
        totalBillingCycles: z.number().int().positive().max(120).optional(),
        nightlyGenerationHour: z.number().int().min(0).max(23).optional(),
      })
    )
    .mutation(({ input }) => updateBillingSettings(input)),

  // Ops/debug aid — real webhook delivery can't reach this dev box (no
  // public URL), so this re-derives state directly from Razorpay's own
  // fetch() through the same state machine a real webhook would use.
  resyncFromRazorpay: adminQuery.input(z.object({ subscriptionId: z.string() })).mutation(({ input }) => resyncSubscriptionFromRazorpay(input.subscriptionId)),
});
