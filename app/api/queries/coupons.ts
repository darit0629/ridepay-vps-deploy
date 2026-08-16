import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { coupons, rides, type Coupon as CouponRow } from "@db/schema";

export type DiscountType = "flat" | "percentage";
export type CouponStatus = "Active" | "Inactive";

export interface Coupon {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  /** Caps the discount amount for percentage coupons; 0 = uncapped. Ignored for flat coupons. */
  maxDiscount: number;
  minBookingAmount: number;
  /** Total redemptions allowed across all riders; 0 = unlimited. */
  usageLimit: number;
  usedCount: number;
  /** Empty = valid for every vehicle type. */
  vehicleRestrictions: string[];
  /** Empty = valid in every area. Freeform area names (no real geofencing in this prototype). */
  areaRestrictions: string[];
  firstRideOnly: boolean;
  repeatUserOnly: boolean;
  isReferralCoupon: boolean;
  isFestivalCoupon: boolean;
  /** ISO date strings (YYYY-MM-DD), matching <input type="date">. */
  validFrom: string;
  validTill: string;
  status: CouponStatus;
}

function toDateStr(d: string | Date): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

function toView(row: CouponRow): Coupon {
  return {
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    maxDiscount: Number(row.maxDiscount),
    minBookingAmount: Number(row.minBooking),
    usageLimit: row.usageLimit,
    usedCount: row.usageCount,
    vehicleRestrictions: row.vehicleRestrictions,
    areaRestrictions: row.areaRestrictions,
    firstRideOnly: row.firstRideOnly,
    repeatUserOnly: row.repeatUserOnly,
    isReferralCoupon: row.isReferralCoupon,
    isFestivalCoupon: row.isFestivalCoupon,
    validFrom: toDateStr(row.validFrom),
    validTill: toDateStr(row.validTill),
    status: row.isActive ? "Active" : "Inactive",
  };
}

export interface CouponInput {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number;
  minBookingAmount: number;
  usageLimit: number;
  vehicleRestrictions: string[];
  areaRestrictions: string[];
  firstRideOnly: boolean;
  repeatUserOnly: boolean;
  isReferralCoupon: boolean;
  isFestivalCoupon: boolean;
  validFrom: string;
  validTill: string;
}

// Seeds the same starter coupons the old in-memory Map shipped with, so a
// fresh database doesn't leave the Offers page empty. No-ops once any
// coupon exists (admin-created or previously seeded).
export async function seedDefaultCouponsIfEmpty(): Promise<void> {
  const [{ count }] = await getDb().select({ count: sql<number>`count(*)` }).from(coupons);
  if (Number(count) > 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const base = {
    maxDiscount: 0,
    usageLimit: 0,
    vehicleRestrictions: [] as string[],
    areaRestrictions: [] as string[],
    firstRideOnly: false,
    repeatUserOnly: false,
    isReferralCoupon: false,
    isFestivalCoupon: false,
    validFrom: today,
    validTill: nextMonth,
  };
  await getDb().insert(coupons).values([
    {
      code: "FLY50", description: "Get ₹50 off", discountType: "flat", discountValue: "50",
      minBooking: "50", ...base, maxDiscount: "0", validFrom: today, validTill: nextMonth,
    },
    {
      code: "INDIA20", description: "20% off your ride", discountType: "percentage", discountValue: "20",
      minBooking: "80", maxDiscount: "60", isFestivalCoupon: true,
      usageLimit: 0, vehicleRestrictions: [], areaRestrictions: [], firstRideOnly: false, repeatUserOnly: false, isReferralCoupon: false,
      validFrom: today, validTill: nextMonth,
    },
    {
      code: "WELCOME10", description: "New user welcome discount", discountType: "flat", discountValue: "10",
      minBooking: "30", firstRideOnly: true, isActive: false,
      maxDiscount: "0", usageLimit: 0, vehicleRestrictions: [], areaRestrictions: [], repeatUserOnly: false, isReferralCoupon: false, isFestivalCoupon: false,
      validFrom: today, validTill: nextMonth,
    },
    {
      code: "RIDE100", description: "Flat ₹100 off on reserve rides", discountType: "flat", discountValue: "100",
      minBooking: "200", vehicleRestrictions: ["e-riksha"],
      maxDiscount: "0", usageLimit: 0, areaRestrictions: [], firstRideOnly: false, repeatUserOnly: false, isReferralCoupon: false, isFestivalCoupon: false,
      validFrom: today, validTill: nextMonth,
    },
  ]);
}

export async function listCoupons(): Promise<Coupon[]> {
  const rows = await getDb().select().from(coupons);
  return rows.map(toView);
}

export async function listActiveCoupons(): Promise<Coupon[]> {
  const all = await listCoupons();
  const nowMs = Date.now();
  return all.filter(
    (c) =>
      c.status === "Active" &&
      nowMs >= new Date(c.validFrom).getTime() &&
      nowMs <= new Date(c.validTill).getTime() + 86_400_000 - 1 &&
      (c.usageLimit === 0 || c.usedCount < c.usageLimit)
  );
}

export async function createCoupon(input: CouponInput): Promise<Coupon> {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Coupon code is required");
  await getDb().insert(coupons).values({
    code,
    description: input.description,
    discountType: input.discountType,
    discountValue: String(input.discountValue),
    maxDiscount: String(input.maxDiscount),
    minBooking: String(input.minBookingAmount),
    usageLimit: input.usageLimit,
    vehicleRestrictions: input.vehicleRestrictions,
    areaRestrictions: input.areaRestrictions,
    firstRideOnly: input.firstRideOnly,
    repeatUserOnly: input.repeatUserOnly,
    isReferralCoupon: input.isReferralCoupon,
    isFestivalCoupon: input.isFestivalCoupon,
    validFrom: input.validFrom,
    validTill: input.validTill,
  });
  const row = await getDb().query.coupons.findFirst({ where: eq(coupons.code, code) });
  return toView(row!);
}

export async function updateCoupon(code: string, updates: Partial<CouponInput>): Promise<Coupon> {
  const normalizedCode = code.trim().toUpperCase();
  const existing = await getDb().query.coupons.findFirst({ where: eq(coupons.code, normalizedCode) });
  if (!existing) throw new Error("Coupon not found");

  const values: Record<string, unknown> = {};
  if (updates.description !== undefined) values.description = updates.description;
  if (updates.discountType !== undefined) values.discountType = updates.discountType;
  if (updates.discountValue !== undefined) values.discountValue = String(updates.discountValue);
  if (updates.maxDiscount !== undefined) values.maxDiscount = String(updates.maxDiscount);
  if (updates.minBookingAmount !== undefined) values.minBooking = String(updates.minBookingAmount);
  if (updates.usageLimit !== undefined) values.usageLimit = updates.usageLimit;
  if (updates.vehicleRestrictions !== undefined) values.vehicleRestrictions = updates.vehicleRestrictions;
  if (updates.areaRestrictions !== undefined) values.areaRestrictions = updates.areaRestrictions;
  if (updates.firstRideOnly !== undefined) values.firstRideOnly = updates.firstRideOnly;
  if (updates.repeatUserOnly !== undefined) values.repeatUserOnly = updates.repeatUserOnly;
  if (updates.isReferralCoupon !== undefined) values.isReferralCoupon = updates.isReferralCoupon;
  if (updates.isFestivalCoupon !== undefined) values.isFestivalCoupon = updates.isFestivalCoupon;
  if (updates.validFrom !== undefined) values.validFrom = updates.validFrom;
  if (updates.validTill !== undefined) values.validTill = updates.validTill;

  if (Object.keys(values).length > 0) {
    await getDb().update(coupons).set(values).where(eq(coupons.code, normalizedCode));
  }
  const row = await getDb().query.coupons.findFirst({ where: eq(coupons.code, normalizedCode) });
  return toView(row!);
}

export async function toggleCouponStatus(code: string): Promise<Coupon> {
  const normalizedCode = code.trim().toUpperCase();
  const existing = await getDb().query.coupons.findFirst({ where: eq(coupons.code, normalizedCode) });
  if (!existing) throw new Error("Coupon not found");
  await getDb().update(coupons).set({ isActive: !existing.isActive }).where(eq(coupons.code, normalizedCode));
  const row = await getDb().query.coupons.findFirst({ where: eq(coupons.code, normalizedCode) });
  return toView(row!);
}

export async function removeCoupon(code: string): Promise<void> {
  await getDb().delete(coupons).where(eq(coupons.code, code.trim().toUpperCase()));
}

// Real "has this rider ever finished a ride" check — backs the firstRideOnly/
// repeatUserOnly coupon restrictions below. Previously `isFirstRide` was
// never computed anywhere in the app (either omitted entirely, which
// silently bypassed both restrictions, or hardcoded to `false` at one
// specific call site) — this is the fix, called from the router layer
// (which has ctx.user) rather than from here, since this file has no
// request context of its own.
export async function hasCompletedRideBefore(userId: number): Promise<boolean> {
  const db = getDb();
  const existing = await db.query.rides.findFirst({ where: and(eq(rides.userId, userId), eq(rides.status, "completed")) });
  return !!existing;
}

export interface CouponValidationOk {
  ok: true;
  discount: number;
  coupon: Coupon;
}
export interface CouponValidationErr {
  ok: false;
  error: string;
}

// Shared by this router's own `validate`/`redeem` procedures AND
// fare-router.ts's calculateFare, so a coupon applied at booking time is
// checked against the exact same rules shown to the rider as a live preview.
export async function validateCouponForBooking(input: {
  code: string;
  bookingAmount: number;
  vehicleType?: string;
  area?: string;
  isFirstRide?: boolean;
}): Promise<CouponValidationOk | CouponValidationErr> {
  const row = await getDb().query.coupons.findFirst({ where: eq(coupons.code, input.code.trim().toUpperCase()) });
  if (!row) return { ok: false, error: "Invalid coupon code" };
  const coupon = toView(row);
  if (coupon.status !== "Active") return { ok: false, error: "This coupon is no longer active" };

  const nowMs = Date.now();
  if (nowMs < new Date(coupon.validFrom).getTime()) return { ok: false, error: "This coupon isn't active yet" };
  // validTill is a calendar day — valid through the end of that day.
  if (nowMs > new Date(coupon.validTill).getTime() + 86_400_000 - 1) return { ok: false, error: "This coupon has expired" };

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, error: "This coupon has reached its usage limit" };
  }
  if (input.bookingAmount < coupon.minBookingAmount) {
    return { ok: false, error: `Minimum booking amount for this coupon is ₹${coupon.minBookingAmount}` };
  }
  if (coupon.vehicleRestrictions.length > 0 && input.vehicleType && !coupon.vehicleRestrictions.includes(input.vehicleType)) {
    return { ok: false, error: "This coupon isn't valid for the selected vehicle" };
  }
  if (coupon.areaRestrictions.length > 0 && input.area && !coupon.areaRestrictions.includes(input.area)) {
    return { ok: false, error: "This coupon isn't valid in your area" };
  }
  if (coupon.firstRideOnly && input.isFirstRide === false) {
    return { ok: false, error: "This coupon is only valid on your first ride" };
  }
  if (coupon.repeatUserOnly && input.isFirstRide === true) {
    return { ok: false, error: "This coupon is only valid for repeat riders" };
  }

  let discount = coupon.discountType === "flat" ? coupon.discountValue : Math.round(input.bookingAmount * (coupon.discountValue / 100));
  if (coupon.discountType === "percentage" && coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, input.bookingAmount));

  return { ok: true, discount, coupon };
}

// Called once a coupon-discounted booking is actually confirmed (not on
// every keystroke/preview) — this is the only place usedCount increments.
export async function redeemCoupon(input: {
  code: string;
  bookingAmount: number;
  vehicleType?: string;
  area?: string;
  isFirstRide?: boolean;
}): Promise<CouponValidationOk | CouponValidationErr> {
  const result = await validateCouponForBooking(input);
  if (!result.ok) return result;
  await getDb()
    .update(coupons)
    .set({ usageCount: sql`${coupons.usageCount} + 1` })
    .where(eq(coupons.code, result.coupon.code));
  return { ok: true, discount: result.discount, coupon: { ...result.coupon, usedCount: result.coupon.usedCount + 1 } };
}
