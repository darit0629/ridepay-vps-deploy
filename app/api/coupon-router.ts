import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  listCoupons,
  listActiveCoupons,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
  removeCoupon,
  validateCouponForBooking,
  redeemCoupon,
  hasCompletedRideBefore,
  seedDefaultCouponsIfEmpty,
  type CouponInput,
} from "./queries/coupons";

export type { Coupon, DiscountType, CouponStatus, CouponValidationOk, CouponValidationErr } from "./queries/coupons";
export { validateCouponForBooking } from "./queries/coupons";

void seedDefaultCouponsIfEmpty();

const couponInputSchema = z.object({
  code: z.string(),
  description: z.string().trim().min(1).max(200),
  discountType: z.enum(["flat", "percentage"]),
  discountValue: z.number().nonnegative(),
  maxDiscount: z.number().nonnegative().default(0),
  minBookingAmount: z.number().nonnegative().default(0),
  usageLimit: z.number().int().nonnegative().default(0),
  vehicleRestrictions: z.array(z.string()).default([]),
  areaRestrictions: z.array(z.string()).default([]),
  firstRideOnly: z.boolean().default(false),
  repeatUserOnly: z.boolean().default(false),
  isReferralCoupon: z.boolean().default(false),
  isFestivalCoupon: z.boolean().default(false),
  validFrom: z.string(),
  validTill: z.string(),
});

export const couponRouter = createRouter({
  list: publicQuery.query(() => listCoupons()),

  listActive: publicQuery.query(() => listActiveCoupons()),

  create: publicQuery.input(couponInputSchema).mutation(({ input }) => createCoupon(input as CouponInput)),

  update: publicQuery
    .input(z.object({ code: z.string(), updates: couponInputSchema.partial().omit({ code: true }) }))
    .mutation(({ input }) => updateCoupon(input.code, input.updates)),

  toggleStatus: publicQuery.input(z.object({ code: z.string() })).mutation(({ input }) => toggleCouponStatus(input.code)),

  remove: publicQuery.input(z.object({ code: z.string() })).mutation(async ({ input }) => {
    await removeCoupon(input.code);
    return { ok: true };
  }),

  // isFirstRide is deliberately NOT taken from the client's input here — it's
  // always resolved server-side from ctx.user (a real "has this rider ever
  // completed a ride" check), so a client can't misreport it (accidentally,
  // like the old hardcoded `isFirstRide: false` at the one call site that
  // ever set it, or otherwise) to dodge a firstRideOnly/repeatUserOnly
  // restriction. Falls back to the zod-validated input only for a logged-out
  // caller, which validateCouponForBooking's own checks handle as before.
  validate: publicQuery
    .input(
      z.object({
        code: z.string(),
        bookingAmount: z.number().nonnegative(),
        vehicleType: z.string().optional(),
        area: z.string().optional(),
        isFirstRide: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const isFirstRide = ctx.user ? !(await hasCompletedRideBefore(ctx.user.id)) : input.isFirstRide;
      return validateCouponForBooking({ ...input, isFirstRide });
    }),

  redeem: publicQuery
    .input(
      z.object({
        code: z.string(),
        bookingAmount: z.number().nonnegative(),
        vehicleType: z.string().optional(),
        area: z.string().optional(),
        isFirstRide: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isFirstRide = ctx.user ? !(await hasCompletedRideBefore(ctx.user.id)) : input.isFirstRide;
      return redeemCoupon({ ...input, isFirstRide });
    }),
});
