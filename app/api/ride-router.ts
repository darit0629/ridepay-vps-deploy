import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, driverQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { rides, driverProfiles, payments, users } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { createRazorpayOrderRecord } from "./razorpay-router";
import { recordCommission } from "./commission-router";
import { completeReferralsFor } from "./referral-router";
import { calculateFare } from "./fare-router";
import { hasCompletedRideBefore } from "./queries/coupons";
import { deriveFareVehicleId, type FareVehicleTypeId } from "./queries/fareVehicleConfig";
import { getCommissionVehicleConfig, computeVehicleCommission } from "./queries/commissionVehicleConfig";
import { computeDriverCancellationOutcome } from "./cancellation-router";
import { insertCancellationRecord } from "./queries/cancellation";
import { chargeDriverCancellationPenalty, collectDuesFromBalance, debitWallet, creditWallet } from "./queries/wallets";
import { sendPushToDrivers } from "./notification-router";
import { findRentalPackage, type RentalVehicleType } from "./queries/hourlyRental";
import { claimRideForDriver, getPendingOfferForRide, respondToOwnOffer, logDispatchEvent } from "./queries/dispatch";
import { calculateDistance, calculateTime } from "./lib/geo";

const RENTAL_VEHICLE_TYPES: RentalVehicleType[] = ["e-riksha", "auto-rickshaw", "car", "bike"];

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Rides booked before the fareVehicleType column existed have no value —
// falls back to a real, data-derived guess (rideType is never null) rather
// than an arbitrary default.
function resolveFareVehicleType(ride: { fareVehicleType: string | null; rideType: "share" | "reserve" }): FareVehicleTypeId {
  if (ride.fareVehicleType) return ride.fareVehicleType as FareVehicleTypeId;
  return ride.rideType === "share" ? "e-riksha-share" : "e-riksha-reserve";
}

// Multi Stop: sums each consecutive leg (pickup→stop1→stop2→...→drop)
// instead of the direct pickup→drop distance a normal ride uses.
function calculateMultiLegDistance(points: { lat: number; lng: number }[]) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return Number(total.toFixed(2));
}

// Same 5km radius / online-driver criteria as getNearbyDrivers below, reused
// here to decide who actually gets woken up by a real phone notification
// the moment a ride starts searching, instead of relying purely on their
// 2-second poll of listNearbySearching to notice it.
async function notifyNearbyDriversOfNewRide(
  pickupLat: string,
  pickupLng: string,
  pickupAddress: string,
  fareTotal: number
): Promise<void> {
  try {
    const db = getDb();
    const onlineDrivers = await db.select().from(driverProfiles).where(eq(driverProfiles.isOnline, true));
    const nearbyDriverUserIds = onlineDrivers
      .filter((d) => d.currentLat && d.currentLng)
      .filter(
        (d) =>
          calculateDistance(parseFloat(pickupLat), parseFloat(pickupLng), parseFloat(d.currentLat!), parseFloat(d.currentLng!)) <= 5
      )
      .map((d) => d.userId);

    if (nearbyDriverUserIds.length === 0) return;
    await sendPushToDrivers(nearbyDriverUserIds, {
      title: "New ride request nearby!",
      message: `Pickup at ${pickupAddress} — ₹${fareTotal} fare. Open Ridepay to accept before another driver does.`,
    });
  } catch {
    // Best-effort — a push failure must never affect the ride booking itself.
  }
}

async function enrichRide(ride: typeof rides.$inferSelect) {
  const db = getDb();
  const [rider, driver, driverProfile] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, ride.userId) }),
    ride.driverId ? db.query.users.findFirst({ where: eq(users.id, ride.driverId) }) : null,
    ride.driverId ? db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, ride.driverId) }) : null,
  ]);
  return {
    ...ride,
    riderName: rider?.name ?? null,
    riderPhone: rider?.phone ?? null,
    driverName: driver?.name ?? null,
    driverPhone: driver?.phone ?? null,
    driverAvatar: driver?.avatar ?? null,
    driverRating: driverProfile?.rating ?? null,
    vehicleModel: driverProfile?.vehicleModel ?? null,
    vehicleNumber: driverProfile?.vehicleNumber ?? null,
    // Real, live GPS — driver-router.ts's toggleOnline/updateLocation keep
    // this current while the driver's app is open. Lets the rider's map show
    // the captain's actual position instead of a scripted animation.
    driverLat: driverProfile?.currentLat ?? null,
    driverLng: driverProfile?.currentLng ?? null,
  };
}

export const rideRouter = createRouter({
  // Books a real ride using the SAME fare engine (api/fare-router.ts's
  // calculateFare) that quotes the rider on the fare sheet — so what gets
  // charged always matches what was shown, computed server-side from real
  // admin config rather than trusting a client-supplied total.
  book: authedQuery
    .input(
      z.object({
        pickupLat: z.string(),
        pickupLng: z.string(),
        pickupAddress: z.string(),
        // Optional: Hourly Rental has no fixed destination — defaults to the
        // pickup point + a descriptive placeholder label when omitted.
        dropLat: z.string().optional(),
        dropLng: z.string().optional(),
        dropAddress: z.string().optional(),
        vehicleType: z.enum([
          "e-riksha", "auto-rickshaw", "car", "bike", "e-riksha-woman", "e-riksha-parcel", "bike-parcel", "e-riksha-school",
        ]),
        segment: z.enum(["share", "reserve", "auto", "parcel", "school", "women"]),
        seats: z.number().optional(),
        aiMultiplier: z.number().positive().default(1),
        couponCode: z.string().optional(),
        // Chosen up front on the vehicle-selection sheet — prefills the
        // post-ride Payment screen instead of always defaulting to cash.
        // Still just a preference: confirmPayment is what actually settles it.
        preferredPaymentMethod: z.enum(["cash", "upi", "wallet"]).optional(),
        // Round Trip booking (UserRoundTrip.tsx): the outbound leg passes
        // both of these so the fare engine applies its existing round-trip
        // surcharge and this row can be matched up with its return-leg
        // schedule entry later.
        isRoundTrip: z.boolean().optional().default(false),
        roundTripGroupId: z.string().max(40).optional(),
        // Wait & Return (UserWaitReturn.tsx): the same driver waits at the
        // destination and drives the rider back — see startWaiting/
        // startReturn below for the rest of the lifecycle.
        isWaitAndReturn: z.boolean().optional().default(false),
        // Hourly Rental (UserHourlyRental.tsx): package-priced instead of
        // distance-priced — see completeHourlyRental below.
        isHourlyRental: z.boolean().optional().default(false),
        rentalHours: z.number().int().positive().optional(),
        // Multi Stop (UserMultiStop.tsx): intermediate waypoints between
        // pickup and dropLat/Lng — fare is priced off the summed distance
        // across every leg, not the direct pickup→drop distance.
        stops: z.array(z.object({ lat: z.string(), lng: z.string(), address: z.string() })).max(5).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      if (input.isHourlyRental) {
        if (!input.rentalHours) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a rental duration." });
        if (!RENTAL_VEHICLE_TYPES.includes(input.vehicleType as RentalVehicleType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That vehicle type isn't available for hourly rental." });
        }
        const pkg = await findRentalPackage(input.vehicleType as RentalVehicleType, input.rentalHours);
        if (!pkg) throw new TRPCError({ code: "BAD_REQUEST", message: "That rental package isn't available." });

        const otp = generateOtp();
        const fareVehicleType = deriveFareVehicleId(input.vehicleType, input.segment);
        const [ride] = await db
          .insert(rides)
          .values({
            userId: ctx.user.id,
            pickupLat: input.pickupLat,
            pickupLng: input.pickupLng,
            pickupAddress: input.pickupAddress,
            dropLat: input.pickupLat,
            dropLng: input.pickupLng,
            dropAddress: "Flexible drop-off (Hourly Rental)",
            rideType: "reserve",
            fareVehicleType,
            vehicleType: input.vehicleType,
            segment: input.segment,
            seats: input.seats ?? 1,
            distance: "0",
            estimatedTime: input.rentalHours * 60,
            baseFare: pkg.basePrice,
            totalFare: pkg.basePrice,
            otp,
            status: "searching",
            paymentMethod: input.preferredPaymentMethod,
            isHourlyRental: true,
            rentalHours: input.rentalHours,
            rentalPackagePrice: pkg.basePrice,
            rentalExtraHourRate: pkg.extraHourRate,
          })
          .$returningId();

        void notifyNearbyDriversOfNewRide(input.pickupLat, input.pickupLng, input.pickupAddress, Number(pkg.basePrice));

        return {
          id: ride.id,
          otp,
          distance: 0,
          estimatedTime: input.rentalHours * 60,
          totalFare: Number(pkg.basePrice),
          couponDiscount: 0,
          status: "searching" as const,
        };
      }

      if (!input.dropLat || !input.dropLng || !input.dropAddress) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A destination is required." });
      }

      const distance = input.stops?.length
        ? calculateMultiLegDistance([
            { lat: parseFloat(input.pickupLat), lng: parseFloat(input.pickupLng) },
            ...input.stops.map((s) => ({ lat: parseFloat(s.lat), lng: parseFloat(s.lng) })),
            { lat: parseFloat(input.dropLat), lng: parseFloat(input.dropLng) },
          ])
        : calculateDistance(
            parseFloat(input.pickupLat),
            parseFloat(input.pickupLng),
            parseFloat(input.dropLat),
            parseFloat(input.dropLng)
          );
      const estimatedTime = calculateTime(distance);

      // Real "is this rider's first ride" check — same fix as fare-router.ts's
      // calculateFare procedure and coupon-router.ts's validate/redeem, so a
      // firstRideOnly/repeatUserOnly coupon is enforced consistently through
      // preview → actual booking, instead of silently never being enforced.
      const isFirstRide = !(await hasCompletedRideBefore(ctx.user.id));
      const fare = await calculateFare({
        vehicleType: input.vehicleType,
        segment: input.segment,
        distanceKm: distance,
        durationMin: estimatedTime,
        waitingMin: 0,
        seats: input.seats ?? 1,
        isAirportPickup: false,
        isAirportDrop: false,
        tollAmount: 0,
        parkingAmount: 0,
        isRoundTrip: input.isRoundTrip,
        isOutstation: false,
        couponCode: input.couponCode,
        isFirstRide,
        pickupText: input.pickupAddress,
        destinationText: input.dropAddress,
        aiMultiplier: input.aiMultiplier,
        atTimestamp: Date.now(),
      });

      const otp = generateOtp();
      // The rides table's own rideType column predates the richer
      // vehicleType/segment fare model — it's only used elsewhere for
      // display, so "share" maps through and every other segment (reserve/
      // auto/women/school) collapses to "reserve" (a private single-vehicle
      // trip), which is what they all actually are.
      const rideTypeForDb: "share" | "reserve" = input.segment === "share" ? "share" : "reserve";
      // The real vehicle-type/segment pair actually booked, for per-vehicle
      // commission (commission-router.ts) to key off later — rideType above
      // can't reconstruct this (auto/car/bike/women/school all collapse to
      // "reserve").
      const fareVehicleType = deriveFareVehicleId(input.vehicleType, input.segment);

      const [ride] = await db
        .insert(rides)
        .values({
          userId: ctx.user.id,
          pickupLat: input.pickupLat,
          pickupLng: input.pickupLng,
          pickupAddress: input.pickupAddress,
          dropLat: input.dropLat,
          dropLng: input.dropLng,
          dropAddress: input.dropAddress,
          rideType: rideTypeForDb,
          fareVehicleType,
          vehicleType: input.vehicleType,
          segment: input.segment,
          seats: input.seats ?? 1,
          distance: distance.toString(),
          estimatedTime,
          baseFare: fare.baseFare.toString(),
          totalFare: fare.total.toString(),
          discount: fare.couponDiscount.toString(),
          couponCode: input.couponCode,
          otp,
          status: "searching",
          paymentMethod: input.preferredPaymentMethod,
          roundTripGroupId: input.roundTripGroupId,
          isWaitAndReturn: input.isWaitAndReturn,
          stops: input.stops,
        })
        .$returningId();

      // Real OS-level push (not just the in-app matching feed) to whichever
      // online drivers are actually near this pickup — targeted by userId so
      // it doesn't blast every driver in the system for every ride booked
      // anywhere. Fire-and-forget: a slow/failed push must never hold up or
      // fail the booking itself.
      void notifyNearbyDriversOfNewRide(input.pickupLat, input.pickupLng, input.pickupAddress, fare.total);

      return {
        id: ride.id,
        otp,
        distance,
        estimatedTime,
        totalFare: fare.total,
        couponDiscount: fare.couponDiscount,
        status: "searching" as const,
      };
    }),

  // Enriches a bare ride row with the real counterpart's display info — the
  // rider needs to see their driver's name/phone/vehicle, and vice versa,
  // instead of the hardcoded ASSIGNED_DRIVER/passenger mocks this replaces.
  // Also used by a driver's own dashboard to resume an active ride it's
  // already been assigned — without this, a driver who accepted a ride but
  // ended up back on the dashboard (app restart, a bounced navigation, etc.)
  // had no way back into the ride short of guessing the right URL.
  getCurrent: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const ride =
      ctx.user.role === "driver"
        ? await db
            .select()
            .from(rides)
            .where(
              and(
                eq(rides.driverId, ctx.user.id),
                sql`${rides.status} IN ('accepted', 'pickup', 'ongoing', 'waiting')`
              )
            )
            .orderBy(desc(rides.createdAt))
            .limit(1)
        : await db
            .select()
            .from(rides)
            .where(
              and(
                eq(rides.userId, ctx.user.id),
                sql`${rides.status} IN ('searching', 'accepted', 'pickup', 'ongoing', 'waiting')`
              )
            )
            .orderBy(desc(rides.createdAt))
            .limit(1);

    return ride[0] ? await enrichRide(ride[0]) : null;
  }),

  // Only the rider who booked it, the driver assigned to it, or (while it's
  // still unassigned) any driver previewing it from the matching feed can
  // see a ride's details — otherwise this would let any logged-in user
  // enumerate ride ids to read other people's pickup/drop addresses, phone
  // numbers, and OTPs.
  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({
        where: eq(rides.id, input.id),
      });
      if (!ride) return null;
      const isOwner = ride.userId === ctx.user.id;
      const isAssignedDriver = ride.driverId === ctx.user.id;
      const isPreviewableByDriver = ride.status === "searching" && ctx.user.role === "driver";
      if (!isOwner && !isAssignedDriver && !isPreviewableByDriver) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      }
      return enrichRide(ride);
    }),

  cancel: authedQuery
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.id) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      await db
        .update(rides)
        .set({ status: "cancelled" })
        .where(eq(rides.id, input.id));
      return { success: true };
    }),

  // Driver-initiated cancellation — no client anywhere previously exposed
  // this even though "driver_cancelled" has always been a valid ride
  // status; Cancellation Rules Section B (free window + fixed/percentage/
  // warning penalty) needed a real action to attach to. Only allowed before
  // the OTP is verified (status "accepted"/"pickup") — once the ride is
  // "ongoing" the rider is already in the vehicle, which isn't a
  // cancellation anymore.
  driverCancel: driverQuery
    .input(z.object({ rideId: z.number(), reason: z.string().trim().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.driverId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      if (ride.status !== "accepted" && ride.status !== "pickup") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This ride can no longer be cancelled." });
      }

      const fareVehicleType = resolveFareVehicleType(ride);
      const [driver, rider] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, ctx.user.id) }),
        db.query.users.findFirst({ where: eq(users.id, ride.userId) }),
      ]);
      const driverName = driver?.name ?? "Driver";

      // No dedicated "accepted at" timestamp column exists — updatedAt is a
      // reasonable proxy since accepting a ride is the last thing that
      // touches this row before a cancellation this soon after.
      const outcome = await computeDriverCancellationOutcome({
        fareVehicleType,
        fareAmount: Number(ride.totalFare),
        acceptedAtMs: ride.updatedAt.getTime(),
        driverName,
      });

      await db.update(rides).set({ status: "driver_cancelled" }).where(eq(rides.id, input.rideId));

      // Wallet-first, defer-to-next-ride: debits whatever the driver's
      // available balance covers now; any shortfall is recorded as dues and
      // collected off the top of their next ride's earnings
      // (creditWalletsFromCommission in queries/wallets.ts).
      if (outcome.penalty > 0) {
        await chargeDriverCancellationPenalty(driverName, outcome.penalty, `Cancellation penalty — cancelled after accepting a ${fareVehicleType} ride`);
      }

      await insertCancellationRecord({
        fareVehicleType,
        stage: "matched",
        initiator: "driver",
        reason: input.reason,
        riderName: rider?.name ?? "Rider",
        driverName,
        fareAmount: Number(ride.totalFare),
        feeCharged: 0,
        feeWaived: outcome.isFree,
        waiveReason: outcome.isFree ? outcome.explanation : undefined,
        driverCompensation: 0,
        driverPenalty: outcome.penalty,
      });

      return { success: true, penalty: outcome.penalty, penaltyType: outcome.penaltyType, message: outcome.explanation };
    }),

  rate: authedQuery
    .input(
      z.object({
        id: z.number(),
        rating: z.number().min(1).max(5),
        review: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.id) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });

      await db
        .update(rides)
        .set({ rating: input.rating, review: input.review })
        .where(eq(rides.id, input.id));

      // Recomputes this driver's aggregate rating from every rated ride they've
      // driven, rather than leaving driverProfiles.rating stuck at its "5.0" default.
      if (ride.driverId) {
        const rated = await db
          .select({ rating: rides.rating })
          .from(rides)
          .where(and(eq(rides.driverId, ride.driverId), sql`${rides.rating} IS NOT NULL`));
        const scores = rated.map((r) => r.rating ?? 0).filter((r) => r > 0);
        if (scores.length > 0) {
          const avg = scores.reduce((sum, r) => sum + r, 0) / scores.length;
          await db
            .update(driverProfiles)
            .set({ rating: avg.toFixed(1) })
            .where(eq(driverProfiles.userId, ride.driverId));
        }
      }

      return { success: true };
    }),

  verifyOtp: driverQuery
    .input(z.object({ rideId: z.number(), otp: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({
        where: eq(rides.id, input.rideId),
      });
      if (!ride) return { success: false, message: "Ride not found" };
      if (ride.driverId !== ctx.user.id) return { success: false, message: "Not your ride" };
      if (ride.otp !== input.otp) return { success: false, message: "Invalid OTP" };

      await db
        .update(rides)
        .set({ status: "ongoing", rentalStartedAt: ride.isHourlyRental ? new Date() : undefined })
        .where(eq(rides.id, input.rideId));
      return { success: true };
    }),

  // Either the rider or the driver can end an Hourly Rental — there's no
  // fixed destination for the other one to "arrive" at, so this
  // deliberately skips the geofence check updateStatus applies to a normal
  // ride's "completed" transition. Recomputes the real final fare (locked-in
  // package price + real overage, rounded up to the next full hour like a
  // normal car-rental billing convention).
  completeHourlyRental: authedQuery
    .input(z.object({ rideId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.userId !== ctx.user.id && ride.driverId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      }
      if (!ride.isHourlyRental || ride.status !== "ongoing" || !ride.rentalStartedAt || !ride.rentalHours) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This ride isn't an active hourly rental." });
      }

      const elapsedMs = Date.now() - ride.rentalStartedAt.getTime();
      const packageMs = ride.rentalHours * 60 * 60 * 1000;
      const extraHours = Math.max(0, Math.ceil((elapsedMs - packageMs) / (60 * 60 * 1000)));
      const extraCharge = extraHours * Number(ride.rentalExtraHourRate ?? 0);
      const finalFare = Number(ride.rentalPackagePrice ?? ride.totalFare) + extraCharge;

      await db
        .update(rides)
        .set({ status: "completed", totalFare: finalFare.toString() })
        .where(eq(rides.id, input.rideId));
      return { success: true, extraHours, finalFare };
    }),

  // Accepting a ride goes through the dedicated, race-guarded `accept`
  // mutation above (WHERE status='searching') — this one is only for a
  // driver already assigned to a ride progressing it further, so it
  // requires that assignment rather than letting any driver flip any ride's
  // status (or steal it by setting driverId themselves).
  updateStatus: driverQuery
    .input(
      z.object({
        rideId: z.number(),
        status: z.enum(["pickup", "ongoing", "completed", "cancelled", "driver_cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.driverId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });

      // Mirrors the client-side arrival gate on DriverDropoff.tsx (which
      // disables the button that leads here) — enforced again server-side
      // since this endpoint is reachable directly, e.g. by navigating to
      // /driver/end-ride?rideId=X without ever passing through that gate.
      // Threshold is more generous than the client's (300m vs 120m) since
      // the driver's stored position can lag a few seconds behind reality.
      // On a Wait & Return's return leg the real destination is back at the
      // original pickup point, not dropLat/dropLng — DriverDropoff.tsx swaps
      // the same way for its own map/geofence.
      const isReturnLeg = ride.isWaitAndReturn && !!ride.returnStartedAt;
      if (input.status === "completed") {
        const driverProfile = await db.query.driverProfiles.findFirst({
          where: eq(driverProfiles.userId, ctx.user.id),
        });
        if (driverProfile?.currentLat && driverProfile?.currentLng) {
          const targetLat = isReturnLeg ? ride.pickupLat : ride.dropLat;
          const targetLng = isReturnLeg ? ride.pickupLng : ride.dropLng;
          const distanceKm = calculateDistance(
            parseFloat(driverProfile.currentLat),
            parseFloat(driverProfile.currentLng),
            parseFloat(targetLat),
            parseFloat(targetLng)
          );
          if (distanceKm > 0.3) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: isReturnLeg
                ? "You need to get back to the original pickup point before ending this trip."
                : "You need to reach the drop-off point before ending this trip.",
            });
          }
        }
      }

      // Wait & Return's fare was only ever computed for the outbound leg at
      // booking time (waitingMin: 0, since no one had waited yet) — now that
      // the real wait time and the return leg both actually happened,
      // recompute the true total before closing the ride out. Approximates
      // the return leg's distance/duration as equal to the outbound leg's
      // (same physical route, just reversed) rather than re-querying Google
      // Directions server-side.
      if (input.status === "completed" && isReturnLeg && ride.vehicleType && ride.segment) {
        const finalFare = await calculateFare({
          vehicleType: ride.vehicleType,
          segment: ride.segment,
          distanceKm: Number(ride.distance) * 2,
          durationMin: ride.estimatedTime * 2,
          waitingMin: ride.actualWaitingMin ?? 0,
          seats: ride.seats,
          isAirportPickup: false,
          isAirportDrop: false,
          tollAmount: 0,
          parkingAmount: 0,
          isRoundTrip: true,
          isOutstation: false,
          couponCode: ride.couponCode ?? undefined,
          pickupText: ride.pickupAddress,
          destinationText: ride.dropAddress,
          aiMultiplier: 1,
          atTimestamp: Date.now(),
        });
        await db
          .update(rides)
          .set({ status: input.status, baseFare: finalFare.baseFare.toString(), totalFare: finalFare.total.toString() })
          .where(eq(rides.id, input.rideId));
        return { success: true };
      }

      await db.update(rides).set({ status: input.status }).where(eq(rides.id, input.rideId));
      // Payment settlement (the real payments row, commission split, driver's
      // totalRides count) is handled separately by confirmPayment/
      // confirmCashPayment once the fare is actually paid — "completed" here
      // just means the trip itself is over, which can happen before cash
      // changes hands.
      return { success: true };
    }),

  // Multi Stop: driver has reached the current waypoint — advances the
  // pointer so DriverDropoff.tsx's next "destination" becomes either the
  // next stop or, once stops are exhausted, the real final drop point. No
  // fare recompute here — the total multi-leg distance was already priced
  // in at booking time.
  advanceStop: driverQuery
    .input(z.object({ rideId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.driverId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      if (ride.status !== "ongoing") throw new TRPCError({ code: "BAD_REQUEST", message: "Ride isn't in progress." });
      const stopCount = ride.stops?.length ?? 0;
      if (ride.currentStopIndex >= stopCount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No stops remaining." });
      }
      await db
        .update(rides)
        .set({ currentStopIndex: ride.currentStopIndex + 1 })
        .where(eq(rides.id, input.rideId));
      return { success: true };
    }),

  // Driver has reached the destination and the rider chose Wait & Return —
  // parks the ride in "waiting" instead of ending it. Real per-minute
  // billing starts accruing from here (see startReturn/updateStatus above).
  startWaiting: driverQuery
    .input(z.object({ rideId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.driverId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      if (!ride.isWaitAndReturn) throw new TRPCError({ code: "BAD_REQUEST", message: "This ride isn't a Wait & Return booking." });
      if (ride.status !== "ongoing") throw new TRPCError({ code: "BAD_REQUEST", message: "Ride isn't in progress." });

      const now = new Date();
      await db.update(rides).set({ status: "waiting", waitStartedAt: now }).where(eq(rides.id, input.rideId));
      void sendPushToDrivers([ride.userId], {
        title: "Your driver has arrived",
        message: "Your driver is waiting for you at the destination — start the return trip whenever you're ready.",
      });
      return { success: true };
    }),

  // Rider-initiated: "I'm ready, take me back." Locks in the real elapsed
  // wait time for billing and hands the driver straight back into the
  // return leg — no fresh OTP, since the driver never left.
  startReturn: authedQuery
    .input(z.object({ rideId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      if (ride.status !== "waiting" || !ride.waitStartedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This ride isn't waiting for a return trip." });
      }

      const now = new Date();
      const actualWaitingMin = Math.max(0, Math.round((now.getTime() - ride.waitStartedAt.getTime()) / 60000));
      await db
        .update(rides)
        .set({ status: "ongoing", returnStartedAt: now, actualWaitingMin })
        .where(eq(rides.id, input.rideId));

      if (ride.driverId) {
        void sendPushToDrivers([ride.driverId], {
          title: "Your rider is ready",
          message: "Head back now — the return trip has started.",
        });
      }
      return { success: true, actualWaitingMin };
    }),

  getNearbyDrivers: publicQuery
    .input(
      z.object({
        lat: z.string(),
        lng: z.string(),
        radius: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const allOnline = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.isOnline, true));

      const drivers = [];
      for (const d of allOnline) {
        if (d.currentLat && d.currentLng) {
          const dist = calculateDistance(
            parseFloat(input.lat),
            parseFloat(input.lng),
            parseFloat(d.currentLat),
            parseFloat(d.currentLng)
          );
          if (dist <= (input.radius ?? 5)) {
            const user = await db.query.users.findFirst({
              where: eq(users.id, d.userId),
            });
            drivers.push({ ...d, name: user?.name ?? "Driver" });
          }
        }
      }
      return drivers;
    }),

  // Delegates to the dispatch engine's shared claimRideForDriver
  // (api/queries/dispatch.ts) — the same atomic `status='searching'` guard
  // this mutation always used, now also checking availability (no
  // conflicting reservation elsewhere) and offer-exclusivity (no other
  // driver currently holding a live sequential offer on this ride).
  accept: driverQuery
    .input(z.object({ rideId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const result = await claimRideForDriver(input.rideId, ctx.user.id);
      if (!result.success) return { success: false as const, error: result.error };
      return { success: true as const, ride: result.ride };
    }),

  // Marks this driver's own live sequential offer (if any) as rejected so
  // the dispatch worker advances to the next round on its very next tick
  // instead of waiting out the full offer timeout.
  reject: driverQuery
    .input(z.object({ rideId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const offer = await getPendingOfferForRide(input.rideId);
      if (offer && offer.driverId === ctx.user.id) {
        await respondToOwnOffer(input.rideId, ctx.user.id, "rejected");
        await logDispatchEvent({ rideId: input.rideId, eventType: "offer_rejected", driverId: ctx.user.id, round: offer.round, actor: "driver", actorUserId: ctx.user.id });
      }
      return { success: true };
    }),

  // Driver-facing matching feed — every ride still in "searching" within
  // range of THIS driver's own last-known location, nearest first. Replaces
  // the old fixed-timeout fake ride-request redirect.
  listNearbySearching: driverQuery
    .input(z.object({ radius: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const driverProfile = await db.query.driverProfiles.findFirst({
        where: eq(driverProfiles.userId, ctx.user.id),
      });
      if (!driverProfile?.currentLat || !driverProfile?.currentLng) return [];

      const searchingRides = await db
        .select()
        .from(rides)
        .where(eq(rides.status, "searching"))
        .orderBy(desc(rides.createdAt));

      const radius = input?.radius ?? 5;
      const withDistance = searchingRides
        .map((ride) => ({
          ride,
          distance: calculateDistance(
            parseFloat(driverProfile.currentLat!),
            parseFloat(driverProfile.currentLng!),
            parseFloat(ride.pickupLat),
            parseFloat(ride.pickupLng)
          ),
        }))
        .sort((a, b) => a.distance - b.distance);

      // Prefer nearby rides, but never leave a driver with nothing just
      // because supply is thin in their area right now — if none fall
      // within the normal radius, fall back to the nearest searching
      // ride(s) regardless of distance so they still get notified.
      const withinRadius = withDistance.filter((r) => r.distance <= radius);
      const candidates = withinRadius.length > 0 ? withinRadius : withDistance.slice(0, 1);

      return Promise.all(
        candidates.map(async ({ ride, distance }) => ({ ...(await enrichRide(ride)), distanceKm: distance }))
      );
    }),

  // Either side of the ride can poll this to see whether/how it's been paid —
  // null until the rider picks a method, "pending" for cash awaiting the
  // driver's confirmation, "completed" once money has actually moved.
  getPayment: authedQuery
    .input(z.object({ rideId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) return null;
      if (ride.userId !== ctx.user.id && ride.driverId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      }
      const payment = await db.query.payments.findFirst({ where: eq(payments.rideId, input.rideId) });
      return payment ?? null;
    }),

  // Tip Captain — a simple wallet-to-wallet transfer on top of the fare
  // itself, shown on the post-trip completed screen. Wallet-only (no
  // cash/UPI tip flow): if the rider's wallet can't cover it, they see a
  // clean "insufficient balance" error rather than a silent partial charge.
  tipDriver: authedQuery
    .input(z.object({ rideId: z.number(), amount: z.number().positive().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      if (!ride.driverId) throw new TRPCError({ code: "BAD_REQUEST", message: "No driver assigned to this ride." });

      const [rider, driver] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, ctx.user.id) }),
        db.query.users.findFirst({ where: eq(users.id, ride.driverId) }),
      ]);
      const riderName = rider?.name ?? "Rider";
      const driverName = driver?.name ?? "Driver";

      const debit = await debitWallet("customer", riderName, input.amount, "debit", `Tip — Ride #${input.rideId}`);
      if (!debit.ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient wallet balance for a tip." });

      await creditWallet("driver", driverName, input.amount, "bonus", `Tip received — Ride #${input.rideId}`);
      return { success: true };
    }),

  // STEP 1 of ride payment — a real Razorpay order sized from the ride's
  // actual fare (never client-supplied), so there's no way to pay less than
  // what's really owed.
  createPaymentOrder: authedQuery
    .input(z.object({ rideId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });

      const existingPayment = await db.query.payments.findFirst({ where: eq(payments.rideId, input.rideId) });
      if (existingPayment) throw new TRPCError({ code: "BAD_REQUEST", message: "This ride has already been paid for." });

      // ride.totalFare is already net of any coupon discount (calculateFare
      // subtracts it before storing) — `discount` on the row is informational only.
      const amount = Number(ride.totalFare);
      return createRazorpayOrderRecord({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `ride-${input.rideId}`,
      });
    }),

  // STEP 2 — records the real payment. Wallet and Razorpay-verified UPI/card
  // settle immediately; cash stays "pending" until the driver physically
  // confirms via confirmCashPayment (that's the only side that actually
  // knows the money changed hands).
  confirmPayment: authedQuery
    .input(
      z.object({
        rideId: z.number(),
        method: z.enum(["cash", "upi", "wallet"]),
        razorpayPaymentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });
      if (!ride.driverId) throw new TRPCError({ code: "BAD_REQUEST", message: "No driver assigned to this ride yet." });

      const existingPayment = await db.query.payments.findFirst({ where: eq(payments.rideId, input.rideId) });
      if (existingPayment) return { status: existingPayment.status, amount: Number(existingPayment.amount) };

      if (input.method === "upi" && !input.razorpayPaymentId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Missing Razorpay payment confirmation." });
      }

      // ride.totalFare is already net of any coupon discount.
      const amount = Number(ride.totalFare);
      const fareVehicleType = resolveFareVehicleType(ride);
      const vehicleCommissionConfig = await getCommissionVehicleConfig(fareVehicleType);
      const vehicleCommission = computeVehicleCommission(vehicleCommissionConfig, amount, input.method);
      const settledNow = input.method !== "cash";

      await db.update(rides).set({ paymentMethod: input.method }).where(eq(rides.id, input.rideId));
      await db.insert(payments).values({
        rideId: input.rideId,
        userId: ride.userId,
        driverId: ride.driverId,
        amount: amount.toFixed(2),
        method: input.method,
        status: settledNow ? "completed" : "pending",
        commission: vehicleCommission.platformCommission.toFixed(2),
        driverEarnings: vehicleCommission.driverEarnings.toFixed(2),
      });
      await db
        .update(driverProfiles)
        .set({ totalRides: sql`totalRides + 1` })
        .where(eq(driverProfiles.userId, ride.driverId));

      if (settledNow) {
        const [rider, driver] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, ride.userId) }),
          db.query.users.findFirst({ where: eq(users.id, ride.driverId) }),
        ]);
        await recordCommission({
          source: "ride",
          sourceId: String(input.rideId),
          total: amount,
          driverName: driver?.name ?? "Driver",
          paymentMethod: input.method,
          vehicleType: fareVehicleType,
        });
        if (rider) await completeReferralsFor(rider.id);
        if (driver) await completeReferralsFor(driver.id);

        // Wallet-first, defer-to-next-ride: retry any outstanding
        // cancellation-fee dues against whatever wallet balance the rider
        // has now that this ride's payment has settled.
        if (rider?.name) {
          await collectDuesFromBalance("customer", rider.name, `Outstanding cancellation fee cleared at ride #${input.rideId}`);
        }
      }

      return { status: settledNow ? ("completed" as const) : ("pending" as const), amount };
    }),

  // Driver taps "Cash Received" — settles a pending cash payment and only
  // then credits the commission split / referral completions, since those
  // represent money that has actually moved.
  confirmCashPayment: driverQuery
    .input(z.object({ rideId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      if (ride.driverId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your ride." });

      const payment = await db.query.payments.findFirst({ where: eq(payments.rideId, input.rideId) });
      if (!payment) throw new TRPCError({ code: "BAD_REQUEST", message: "No payment recorded for this ride yet." });
      if (payment.status === "completed") return { alreadyConfirmed: true as const };

      await db.update(payments).set({ status: "completed" }).where(eq(payments.id, payment.id));

      const [rider, driver] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, ride.userId) }),
        db.query.users.findFirst({ where: eq(users.id, ctx.user.id) }),
      ]);
      await recordCommission({
        source: "ride",
        sourceId: String(input.rideId),
        total: Number(payment.amount),
        driverName: driver?.name ?? "Driver",
        paymentMethod: payment.method,
        vehicleType: resolveFareVehicleType(ride),
      });
      if (rider) await completeReferralsFor(rider.id);
      if (driver) await completeReferralsFor(driver.id);

      // Wallet-first, defer-to-next-ride: retry any outstanding
      // cancellation-fee dues now that this ride's cash payment has settled.
      if (rider?.name) {
        await collectDuesFromBalance("customer", rider.name, `Outstanding cancellation fee cleared at ride #${input.rideId}`);
      }

      return { alreadyConfirmed: false as const };
    }),

  // publicQuery, no auth — this is the one procedure meant to be reachable
  // by whoever a rider shares their live-trip link with (family, friends),
  // who won't have a Ridepay session. Deliberately returns only what's
  // needed to track the trip and reach the driver, not the OTP or fare.
  getShareInfo: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.id) });
      if (!ride) return null;

      const rider = await db.query.users.findFirst({ where: eq(users.id, ride.userId) });
      const driver = ride.driverId ? await db.query.users.findFirst({ where: eq(users.id, ride.driverId) }) : null;
      const driverProfile = ride.driverId
        ? await db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, ride.driverId) })
        : null;

      return {
        status: ride.status,
        riderName: rider?.name ?? "Rider",
        driverName: driver?.name ?? null,
        driverPhone: driver?.phone ?? null,
        driverAvatar: driver?.avatar ?? null,
        vehicleModel: driverProfile?.vehicleModel ?? null,
        vehicleNumber: driverProfile?.vehicleNumber ?? null,
        driverLat: driverProfile?.currentLat ?? null,
        driverLng: driverProfile?.currentLng ?? null,
        pickupAddress: ride.pickupAddress,
        dropAddress: ride.dropAddress,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        dropLat: ride.dropLat,
        dropLng: ride.dropLng,
      };
    }),
});
