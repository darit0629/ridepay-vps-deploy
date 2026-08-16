import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware";
import {
  getReferralConfig,
  updateReferralConfig,
  myReferralCode,
  applyReferralCode,
  listReferralRecords,
  recordShare,
  type ReferralConfig,
  type ReferralRole,
} from "./queries/referrals";

export type { ReferralRole, ReferralBonusPair, ReferralConfig, ReferralMember, ReferralStatus, ReferralRecord } from "./queries/referrals";
export { completeReferralsFor } from "./queries/referrals";

const bonusPairSchema = z.object({
  referrerBonus: z.number().min(0).max(10_000),
  refereeBonus: z.number().min(0).max(10_000),
});

/** Referral identity is server-derived from the session, never client input
 *  — closes the old spoof vector where any caller could pass someone else's
 *  name to read or apply against their referral code/history. */
function roleFor(ctxRole: string): ReferralRole {
  return ctxRole === "driver" ? "driver" : "rider";
}

export const referralRouter = createRouter({
  getConfig: publicQuery.query(() => getReferralConfig()),

  updateConfig: adminQuery
    .input(
      z.object({
        enabled: z.boolean(),
        payoutTrigger: z.enum(["signup", "first_ride"]),
        riderToRider: bonusPairSchema,
        riderToDriver: bonusPairSchema,
        driverToDriver: bonusPairSchema,
        driverToRider: bonusPairSchema,
      })
    )
    .mutation(({ input }) => updateReferralConfig(input as ReferralConfig)),

  // The referral screen's everything-query: this user's permanent code,
  // aggregate stats, and their own referral history. Identity comes from
  // the session, not the client.
  myCode: authedQuery.query(({ ctx }) => {
    const role = roleFor(ctx.user.role);
    return myReferralCode(ctx.user.id, ctx.user.name ?? (role === "driver" ? "Driver" : "Rider"), role);
  }),

  // Referee enters someone's code (at registration, or from the Refer &
  // Earn screen). Referee's signup bonus lands in their wallet immediately;
  // the referrer is paid per config.payoutTrigger.
  // ("apply" itself is a reserved word in tRPC router keys.)
  applyCode: authedQuery
    .input(z.object({ code: z.string().trim().min(1).max(20) }))
    .mutation(({ ctx, input }) => {
      const role = roleFor(ctx.user.role);
      return applyReferralCode({
        code: input.code,
        refereeUserId: ctx.user.id,
        refereeName: ctx.user.name ?? (role === "driver" ? "Driver" : "Rider"),
        refereeRole: role,
      });
    }),

  // Bumps the "Friends Invited" share counter — fired whenever the rider
  // taps any of the share buttons on the Refer & Earn screen.
  recordShare: authedQuery.mutation(({ ctx }) => {
    const role = roleFor(ctx.user.role);
    return recordShare(ctx.user.id, ctx.user.name ?? (role === "driver" ? "Driver" : "Rider"), role);
  }),

  // Admin: the full program ledger.
  listRecords: adminQuery.query(() => listReferralRecords()),
});
