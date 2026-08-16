import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { recordCommission } from "./commission-router";
import { clampToParcelBounds } from "./fare-router";
import {
  createParcelBooking,
  getParcelByTrackingId,
  advanceParcelStage,
  confirmParcelDelivery,
  submitParcelPayment,
  type ParcelBookInput,
} from "./queries/parcels";

export type { ParcelBooking, ParcelStage, ParcelPaymentStatus, ParcelPayer, ParcelPaymentMethod } from "./queries/parcels";

const coordsSchema = z.object({ lat: z.number(), lng: z.number() });
const stageSchema = z.enum(["assigned", "picked_up", "arrived", "delivered"]);

export const parcelRouter = createRouter({
  book: publicQuery
    .input(
      z.object({
        pickup: z.string().trim().min(1),
        destination: z.string().trim().min(1),
        pickupCoords: coordsSchema,
        destinationCoords: coordsSchema,
        category: z.string().trim().min(1),
        weightKg: z.number().nonnegative(),
        fragile: z.boolean(),
        notes: z.string().trim().max(300).default(""),
        cost: z.number().nonnegative(),
        paidBy: z.enum(["sender", "receiver"]),
      })
    )
    .mutation(async ({ input }) =>
      // A tampered devtools call could submit any cost — clamp it server-side
      // before it's ever used for the commission split at payment time.
      createParcelBooking({ ...input, cost: await clampToParcelBounds(input.cost) } as ParcelBookInput)
    ),

  getByTrackingId: publicQuery
    .input(z.object({ trackingId: z.string().trim().min(1) }))
    .query(({ input }) => getParcelByTrackingId(input.trackingId)),

  // Driven by the sender's own client as it simulates the courier's journey —
  // same "client drives the state machine, server just fans it out" pattern
  // used for ride stages, so a receiver polling by code sees the same progress live.
  advanceStage: publicQuery
    .input(z.object({ trackingId: z.string(), stage: stageSchema }))
    .mutation(({ input }) => advanceParcelStage(input.trackingId, input.stage)),

  confirmDelivery: publicQuery
    .input(z.object({ trackingId: z.string(), pin: z.string().trim() }))
    .mutation(({ input }) => confirmParcelDelivery(input.trackingId, input.pin)),

  // No separate driver-side app screen exists for parcels yet, so every
  // method settles immediately on submission (cash = handed over in person,
  // UPI = confirmed after completing it in the UPI app, wallet = instant
  // deduction) rather than waiting on a second party to confirm.
  submitPayment: publicQuery
    .input(z.object({ trackingId: z.string(), method: z.enum(["cash", "upi", "wallet"]) }))
    .mutation(async ({ input }) => {
      const booking = await submitParcelPayment(input.trackingId, input.method);
      if (!booking) return null;
      await recordCommission({
        source: "parcel",
        sourceId: booking.trackingId,
        total: booking.cost,
        driverName: booking.driverName,
        paymentMethod: input.method,
        // Parcels have no real driver/vehicle assignment yet (see the
        // comment on parcelRouter.book above) — "courier" is the honest
        // generic default rather than guessing e-riksha-parcel/bike-parcel.
        vehicleType: "courier",
      });
      return booking;
    }),
});
