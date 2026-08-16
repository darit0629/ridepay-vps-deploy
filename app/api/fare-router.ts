import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { validateCouponForBooking } from "./coupon-router";
import { hasCompletedRideBefore } from "./queries/coupons";
import { matchingZones } from "./zone-router";
import {
  getFareConfig,
  updateFareConfig,
  getSurgeSettings,
  updateSurgeSettings,
  notifyRideStarted,
  notifyRideEnded,
  getActiveRideCount,
  type FareConfig,
  type SurgeSettings,
} from "./queries/fareEngine";
import {
  listFareVehicleConfigs,
  getFareVehicleConfig,
  updateFareVehicleConfig,
  duplicateFareVehicleConfig,
  seedFareVehicleConfigsIfEmpty,
  deriveFareVehicleId,
  computeVehicleFareBreakdown,
} from "./queries/fareVehicleConfig";
import { fareVehicleTypeEnum, feeTypeEnum } from "@db/schema";

export type { FareConfig, PeakWindow, DemandTier, SurgeSettings } from "./queries/fareEngine";
export type { FareVehicleTypeId, FareVehicleConfig, FareTax } from "./queries/fareVehicleConfig";

void seedFareVehicleConfigsIfEmpty();

// Security: the authoritative sanity bounds every payment-creating mutation
// clamps a client-supplied ride/parcel amount into, server-side — closes off
// a rider tampering with devtools to submit ridePayment.submit/parcel.book
// with an inflated or near-zero amount and having that number flow straight
// into commission splits and wallet credits.
export async function clampToFareBounds(amount: number): Promise<number> {
  const { minFare, maxFare } = await getFareConfig();
  return Math.min(Math.max(amount, minFare), maxFare);
}

// Parcels run cheaper than rides, so they get their own floor (the
// configured parcel base fare) rather than the ride minFare.
export async function clampToParcelBounds(amount: number): Promise<number> {
  const { parcelBaseFare, maxFare } = await getFareConfig();
  return Math.min(Math.max(amount, parcelBaseFare), maxFare);
}

function computeDemandSurgePercent(surgeSettings: SurgeSettings, activeRideCount: number): number {
  if (surgeSettings.surgeMode !== "auto") return surgeSettings.demandSurgePercent;
  const sorted = [...surgeSettings.demandTiers].sort((a, b) => b.count - a.count);
  const tier = sorted.find((t) => activeRideCount >= t.count);
  return tier ? tier.percent : 0;
}

function isWithinPeakWindow(surgeSettings: SurgeSettings, hour: number): boolean {
  return surgeSettings.peakWindows.some((w) =>
    w.startHour <= w.endHour ? hour >= w.startHour && hour <= w.endHour : hour >= w.startHour || hour <= w.endHour
  );
}

// ---------------------------------------------------------------------------
// The fare engine itself — every number a rider is ever charged is produced
// here, server-side, from fareConfig/vehiclePricing/surgeSettings.
// ---------------------------------------------------------------------------
export type RideSegment = "share" | "reserve" | "auto" | "parcel" | "school" | "women";

export interface FareBreakdown {
  baseFare: number;
  distanceCharge: number;
  waitingCharge: number;
  surcharges: { label: string; amount: number }[];
  flatCharges: { label: string; amount: number }[];
  fees: { label: string; amount: number }[];
  taxes: { label: string; amount: number }[];
  taxTotal: number;
  subtotal: number;
  perUnitFare: number;
  total: number;
  /** What `total` would be with aiMultiplier reset to 1 — lets the client
   *  show a "before AI pricing" comparison without computing it itself. */
  normalTotal: number;
  clampedByMinFare: boolean;
  clampedByMaxFare: boolean;
  /** >0 when a valid couponCode was supplied and already subtracted into `total`. */
  couponDiscount: number;
  /** Set when couponCode was supplied but didn't validate — `total` is unaffected. */
  couponError?: string;
}

const calculateFareInput = z.object({
  vehicleType: z.enum([
    "e-riksha", "auto-rickshaw", "car", "bike", "e-riksha-woman", "e-riksha-parcel", "bike-parcel", "e-riksha-school",
  ]),
  segment: z.enum(["share", "reserve", "auto", "parcel", "school", "women"]),
  distanceKm: z.number().nonnegative(),
  durationMin: z.number().nonnegative(),
  waitingMin: z.number().nonnegative().default(0),
  seats: z.number().int().min(1).max(6).default(1),
  isAirportPickup: z.boolean().default(false),
  isAirportDrop: z.boolean().default(false),
  tollAmount: z.number().nonnegative().default(0),
  parkingAmount: z.number().nonnegative().default(0),
  isRoundTrip: z.boolean().default(false),
  isOutstation: z.boolean().default(false),
  couponCode: z.string().trim().optional(),
  area: z.string().trim().optional(),
  isFirstRide: z.boolean().optional(),
  // Free-text pickup/drop labels used purely for zone-pricing keyword
  // matching (see api/zone-router.ts) — distinct from `area` above, which
  // only feeds coupon area restrictions.
  pickupText: z.string().trim().optional(),
  destinationText: z.string().trim().optional(),
  // The client-side "AI suggested pricing" flourish still lands here as an
  // input multiplier rather than mutating the charged total on its own —
  // the server is what actually applies it and returns the final number.
  aiMultiplier: z.number().positive().default(1),
  atTimestamp: z.number().default(() => Date.now()),
});

export async function calculateFare(input: z.infer<typeof calculateFareInput>): Promise<FareBreakdown> {
  const fareVehicleId = deriveFareVehicleId(input.vehicleType, input.segment);
  const [fareConfig, vehicleConfig, surgeSettings] = await Promise.all([
    getFareConfig(),
    getFareVehicleConfig(fareVehicleId),
    getSurgeSettings(),
  ]);

  // Base fare, included-distance-adjusted distance charge, waiting charge,
  // and (if the current time/weather fall inside this vehicle's configured
  // windows) night/peak/rain charges — every number the redesigned Fare
  // Configuration page controls. `isRaining` reuses the existing "Rain
  // Active" admin toggle (AdminSurgePricing.tsx) as the live weather signal.
  // Toll is computed separately below (kept in its original post-multiplier
  // slot) so it isn't double-counted here.
  const vehicleFare = computeVehicleFareBreakdown(vehicleConfig, {
    distanceKm: input.distanceKm,
    waitingMin: input.waitingMin,
    atTimestamp: input.atTimestamp,
    isRaining: surgeSettings.rainActive,
    tollAmount: 0,
  });

  const outstationCharge = input.isOutstation ? Math.round(fareConfig.outstationChargePerKm * input.distanceKm * 100) / 100 : 0;

  let running = vehicleFare.subtotalBeforeTax + outstationCharge;

  const surcharges: { label: string; amount: number }[] = [...vehicleFare.timeCharges];
  if (vehicleFare.weatherCharge) surcharges.push(vehicleFare.weatherCharge);
  if (outstationCharge > 0) surcharges.push({ label: "Outstation Charge", amount: outstationCharge });

  const addPercentSurcharge = (label: string, percent: number) => {
    // Zero is genuinely a no-op, but a negative percent is a real discount
    // (e.g. Long Distance Discount, a zone's percent-off rule) and must
    // still be itemized and applied.
    if (percent === 0) return;
    const amount = Math.round(running * (percent / 100) * 100) / 100;
    surcharges.push({ label, amount });
    running += amount;
  };

  // Emergency Override is a kill switch for every surge-style surcharge —
  // traffic/festival/demand — leaving only the flat, non-surge rules (round
  // trip, long-distance discount) in effect. Night/peak/rain above are
  // per-vehicle configured rules, not surge-gated, so they're unaffected by
  // this override — same as before.
  const surgeActive = surgeSettings.enabled && !surgeSettings.emergencyOverride;

  if (surgeActive && fareConfig.trafficChargePercent > 0) addPercentSurcharge("Traffic Charge", fareConfig.trafficChargePercent);
  if (surgeActive && surgeSettings.festivalActive && fareConfig.festivalMultiplier > 1) {
    addPercentSurcharge("Festival Surge", (fareConfig.festivalMultiplier - 1) * 100);
  }
  const demandSurgePercent = computeDemandSurgePercent(surgeSettings, getActiveRideCount());
  if (surgeActive && demandSurgePercent > 0) {
    const cappedDemand = Math.min(demandSurgePercent, surgeSettings.maxSurgePercent);
    addPercentSurcharge("Demand Surge", cappedDemand);
  }
  // Zone pricing — a trip can cross multiple zones (e.g. pickup at the
  // station, drop at the airport), so every matching enabled zone gets its
  // own itemized line.
  for (const zone of await matchingZones(input.pickupText ?? "", input.destinationText ?? "")) {
    if (zone.ruleType === "percent") {
      addPercentSurcharge(zone.name, zone.value);
    } else if (zone.value !== 0) {
      const amount = zone.value;
      surcharges.push({ label: zone.name, amount });
      running += amount;
    }
  }

  if (input.isRoundTrip && fareConfig.roundTripChargePercent > 0) addPercentSurcharge("Round Trip", fareConfig.roundTripChargePercent);
  if (input.distanceKm >= fareConfig.longDistanceThresholdKm && fareConfig.longDistanceDiscountPercent > 0) {
    addPercentSurcharge("Long Distance Discount", -fareConfig.longDistanceDiscountPercent);
  }

  // Segment multipliers (the old shareMultiplier/reserveMultiplier/etc.)
  // are gone — each of the 10 fare-config vehicle types now carries its own
  // fully independent base/distance/waiting/night/peak/rain rates instead
  // of one shared e-riksha rate multiplied per segment.
  // Kept before the AI multiplier so callers can show a "before AI pricing"
  // comparison figure without doing any arithmetic of their own client-side.
  const runningBeforeAi = running;
  // Admin's "AI Suggested Pricing" toggle is enforced here, not just hidden
  // client-side — otherwise a stale client (old bundle, or a tampered
  // request) could still send a boosted aiMultiplier and get charged more
  // even after this was turned off.
  const effectiveAiMultiplier = surgeSettings.aiPricingEnabled ? input.aiMultiplier : 1;
  if (effectiveAiMultiplier !== 1) {
    running = Math.round(running * effectiveAiMultiplier * 100) / 100;
  }

  const flatCharges: { label: string; amount: number }[] = [];
  let flatChargesSum = 0;
  const addFlatCharge = (label: string, amount: number) => {
    if (amount <= 0) return;
    flatCharges.push({ label, amount });
    flatChargesSum += amount;
  };
  if (input.isAirportPickup) addFlatCharge("Airport Pickup", fareConfig.airportPickupCharge);
  if (input.isAirportDrop) addFlatCharge("Airport Drop", fareConfig.airportDropCharge);
  if (vehicleConfig.tollEnabled) addFlatCharge("Toll Charges", input.tollAmount);
  if (fareConfig.parkingChargesEnabled) addFlatCharge("Parking Charges", input.parkingAmount);

  const fees: { label: string; amount: number }[] = [];
  let feesSum = 0;
  const addFee = (label: string, amount: number) => {
    if (amount <= 0) return;
    fees.push({ label, amount });
    feesSum += amount;
  };
  addFee("Booking Fee", fareConfig.bookingFee);
  addFee("Platform Fee", fareConfig.platformFee);
  addFee("Convenience Fee", fareConfig.convenienceFee);

  const finish = async (runningValue: number, applyCoupon: boolean) => {
    const subtotal = Math.round((runningValue + flatChargesSum + feesSum) * 100) / 100;

    // Taxes now come from this vehicle's own configured list (Section F)
    // instead of a single global GST percent — each enabled entry is its
    // own itemized line, computed against the full subtotal (base + distance
    // + waiting + time/weather surcharges + flat charges + fees), same spot
    // the old single GST line applied.
    const taxes: { label: string; amount: number }[] = [];
    let taxTotal = 0;
    for (const tax of vehicleConfig.taxes) {
      if (!tax.enabled) continue;
      const amount = tax.type === "percent" ? Math.round(subtotal * (tax.value / 100) * 100) / 100 : Math.round(tax.value * 100) / 100;
      taxes.push({ label: tax.name, amount });
      taxTotal += amount;
    }
    taxTotal = Math.round(taxTotal * 100) / 100;
    const perUnitFare = Math.round((subtotal + taxTotal) * 100) / 100;

    let total = perUnitFare * input.seats;

    let couponDiscount = 0;
    let couponError: string | undefined;
    if (applyCoupon && input.couponCode) {
      const result = await validateCouponForBooking({
        code: input.couponCode,
        bookingAmount: total,
        vehicleType: input.vehicleType,
        area: input.area,
        isFirstRide: input.isFirstRide,
      });
      if (result.ok) {
        couponDiscount = result.discount;
        total -= couponDiscount;
      } else {
        couponError = result.error;
      }
    }

    let clampedByMinFare = false;
    let clampedByMaxFare = false;
    if (total < fareConfig.minFare) {
      total = fareConfig.minFare;
      clampedByMinFare = true;
    } else if (surgeActive && total < surgeSettings.minFare) {
      total = surgeSettings.minFare;
      clampedByMinFare = true;
    }
    if (total > fareConfig.maxFare) {
      total = fareConfig.maxFare;
      clampedByMaxFare = true;
    }
    return { subtotal, taxes, taxTotal, perUnitFare, total: Math.round(total), clampedByMinFare, clampedByMaxFare, couponDiscount, couponError };
  };

  const withAi = await finish(running, true);
  const withoutAi = await finish(runningBeforeAi, false);

  return {
    baseFare: vehicleFare.baseFare,
    distanceCharge: vehicleFare.distanceCharge,
    waitingCharge: vehicleFare.waitingCharge,
    surcharges,
    flatCharges,
    fees,
    taxes: withAi.taxes,
    taxTotal: withAi.taxTotal,
    subtotal: withAi.subtotal,
    perUnitFare: withAi.perUnitFare,
    total: withAi.total,
    normalTotal: withoutAi.total,
    clampedByMinFare: withAi.clampedByMinFare,
    clampedByMaxFare: withAi.clampedByMaxFare,
    couponDiscount: withAi.couponDiscount,
    couponError: withAi.couponError,
  };
}

const fareVehicleTypeSchema = z.enum(fareVehicleTypeEnum);
const feeTypeSchema = z.enum(feeTypeEnum);
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const taxSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
  type: feeTypeSchema,
  value: z.number().min(0),
  enabled: z.boolean(),
});

const fareVehicleConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  baseFare: z.number().nonnegative().optional(),
  includedDistanceKm: z.number().nonnegative().optional(),
  perKmCharge: z.number().nonnegative().optional(),
  freeWaitingMin: z.number().int().nonnegative().optional(),
  waitingChargePerMin: z.number().nonnegative().optional(),
  nightChargeEnabled: z.boolean().optional(),
  nightChargeStart: hhmmSchema.optional(),
  nightChargeEnd: hhmmSchema.optional(),
  nightChargeType: feeTypeSchema.optional(),
  nightChargeValue: z.number().min(0).optional(),
  peakChargeEnabled: z.boolean().optional(),
  peakChargeStart: hhmmSchema.optional(),
  peakChargeEnd: hhmmSchema.optional(),
  peakChargeType: feeTypeSchema.optional(),
  peakChargeValue: z.number().min(0).optional(),
  rainChargeEnabled: z.boolean().optional(),
  rainChargeType: feeTypeSchema.optional(),
  rainChargeValue: z.number().min(0).optional(),
  taxes: z.array(taxSchema).optional(),
  tollEnabled: z.boolean().optional(),
  tollMode: z.enum(["manual", "auto"]).optional(),
});

export const fareRouter = createRouter({
  getConfig: publicQuery.query(() => getFareConfig()),

  updateConfig: publicQuery
    .input(z.record(z.string(), z.union([z.number(), z.boolean()])))
    .mutation(({ input }) => updateFareConfig(input as Partial<FareConfig>)),

  // Section A–G fare configuration, one row per vehicle type — backs the
  // redesigned Fare Configuration admin page.
  listVehicleFareConfigs: publicQuery.query(() => listFareVehicleConfigs()),

  getVehicleFareConfig: publicQuery
    .input(z.object({ id: fareVehicleTypeSchema }))
    .query(({ input }) => getFareVehicleConfig(input.id)),

  updateVehicleFareConfig: publicQuery
    .input(z.object({ id: fareVehicleTypeSchema, updates: fareVehicleConfigUpdateSchema }))
    .mutation(({ input }) => updateFareVehicleConfig(input.id, input.updates)),

  duplicateVehicleFareConfig: publicQuery
    .input(z.object({ fromId: fareVehicleTypeSchema, toId: fareVehicleTypeSchema }))
    .mutation(({ input }) => duplicateFareVehicleConfig(input.fromId, input.toId)),

  getSurge: publicQuery.query(() => getSurgeSettings()),

  updateSurge: publicQuery
    .input(z.record(z.string(), z.union([z.number(), z.boolean()])))
    .mutation(({ input }) => updateSurgeSettings(input as Partial<SurgeSettings>)),

  updateSurgeMode: publicQuery
    .input(z.object({ surgeMode: z.enum(["manual", "auto"]) }))
    .mutation(({ input }) => updateSurgeSettings({ surgeMode: input.surgeMode })),

  updateDemandTiers: publicQuery
    .input(z.array(z.object({ count: z.number().int().positive(), percent: z.number().min(0).max(200) })).min(1))
    .mutation(({ input }) => updateSurgeSettings({ demandTiers: input })),

  updatePeakWindows: publicQuery
    .input(z.array(z.object({ label: z.string().trim().min(1).max(40), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(0).max(23) })))
    .mutation(({ input }) => updateSurgeSettings({ peakWindows: input })),

  // Live view for the admin Surge Pricing page — what's actually driving
  // the surge multiplier right now, not just the configured rules.
  getSurgeStatus: publicQuery.query(async () => {
    const surgeSettings = await getSurgeSettings();
    const hour = new Date().getHours();
    const activeRideCount = getActiveRideCount();
    return {
      activeRideCount,
      isPeakNow: isWithinPeakWindow(surgeSettings, hour),
      effectiveDemandSurgePercent: computeDemandSurgePercent(surgeSettings, activeRideCount),
      surgeActive: surgeSettings.enabled && !surgeSettings.emergencyOverride,
    };
  }),

  // Real "is this rider's first ride" resolved from ctx.user here (same fix
  // as coupon-router.ts's validate/redeem) — this is the live fare-preview
  // path the booking sheet polls on every keystroke, so a firstRideOnly/
  // repeatUserOnly coupon's preview needs to agree with what actually gets
  // charged at booking time (ride-router.ts's `book`, fixed the same way).
  calculateFare: publicQuery.input(calculateFareInput).query(async ({ ctx, input }) => {
    const isFirstRide = ctx.user ? !(await hasCompletedRideBefore(ctx.user.id)) : input.isFirstRide;
    return calculateFare({ ...input, isFirstRide });
  }),

  // Called by the client at the two edges of a ride's lifecycle (booking
  // confirmed → searching begins, and ride ends/is cancelled) so
  // activeRideCount is a real live signal auto surge mode can react to.
  rideStarted: publicQuery.mutation(() => {
    notifyRideStarted();
    return { activeRideCount: getActiveRideCount() };
  }),
  rideEnded: publicQuery.mutation(() => {
    notifyRideEnded();
    return { activeRideCount: getActiveRideCount() };
  }),
});
