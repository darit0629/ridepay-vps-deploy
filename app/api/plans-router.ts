import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { listPlans, updatePlan, getMyPlanId, setMyPlanId, seedSubscriptionPlansIfEmpty } from "./queries/plans";

export type { PlanCategory, SubscriptionPlan } from "./queries/plans";

void seedSubscriptionPlansIfEmpty();

export const plansRouter = createRouter({
  // publicQuery — the plan catalog itself isn't sensitive, and the admin
  // panel (no real login gate, same as the rest of this app's back-office)
  // needs to read/edit it too.
  listPlans: publicQuery.query(() => listPlans()),

  updatePlan: publicQuery
    .input(
      z.object({
        id: z.string(),
        updates: z.object({
          price: z.number().nonnegative().nullable().optional(),
          period: z.string().trim().max(30).optional(),
          perks: z.array(z.string().trim().min(1).max(200)).optional(),
          category: z.enum(["Individual", "Corporate"]).optional(),
          active: z.boolean().optional(),
        }),
      })
    )
    .mutation(({ input }) => updatePlan(input.id, input.updates)),

  // Rider's own plan — real per-account persistence, replacing the old
  // UserSubscription.tsx local useState that reset to "free" on every reload.
  getMyPlan: authedQuery.query(({ ctx }) => getMyPlanId(ctx.user.id)),

  setMyPlan: authedQuery
    .input(z.object({ planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await setMyPlanId(ctx.user.id, input.planId);
      return { success: true };
    }),
});
