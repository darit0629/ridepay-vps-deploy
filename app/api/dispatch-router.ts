import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { rides, users } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  getDispatchSettings,
  updateDispatchSettings,
  getPendingOfferForRide,
  listDispatchEvents,
  adminAssignDriver,
  type DispatchSettingsView,
} from "./queries/dispatch";
import { sendPushToDrivers } from "./notification-router";

export const dispatchRouter = createRouter({
  // Every ride still live in the dispatch pipeline, enriched with rider/
  // driver/current-offer info and a computed risk level — the operational
  // board admins actually watch. Follows the same refetchInterval-polling
  // convention every other admin operational page in this app already uses
  // (AdminScheduleDashboard.tsx, AdminTracking.tsx).
  adminBoard: adminQuery.query(async () => {
    const db = getDb();
    const settings = await getDispatchSettings();
    const activeRides = await db
      .select()
      .from(rides)
      .where(sql`${rides.status} IN ('searching', 'accepted', 'pickup', 'ongoing', 'waiting')`)
      .orderBy(desc(rides.createdAt))
      .limit(150);

    const now = Date.now();
    return Promise.all(
      activeRides.map(async (ride) => {
        const [rider, driver, pendingOffer] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, ride.userId) }),
          ride.driverId ? db.query.users.findFirst({ where: eq(users.id, ride.driverId) }) : null,
          getPendingOfferForRide(ride.id),
        ]);
        const offeredDriver = pendingOffer ? await db.query.users.findFirst({ where: eq(users.id, pendingOffer.driverId) }) : null;

        let risk: "low" | "medium" | "high" = "low";
        if (ride.status === "searching") {
          const elapsedSec = (now - ride.createdAt.getTime()) / 1000;
          if (ride.dispatchExhaustedAt || elapsedSec >= settings.riskHighAfterSec) risk = "high";
          else if (elapsedSec >= settings.riskMediumAfterSec) risk = "medium";
        }

        return {
          id: ride.id,
          status: ride.status,
          pickupAddress: ride.pickupAddress,
          dropAddress: ride.dropAddress,
          createdAt: ride.createdAt,
          dispatchRound: ride.dispatchRound,
          dispatchExhaustedAt: ride.dispatchExhaustedAt,
          riderName: rider?.name ?? null,
          riderPhone: rider?.phone ?? null,
          driverId: ride.driverId,
          driverName: driver?.name ?? null,
          driverPhone: driver?.phone ?? null,
          offeredDriverId: pendingOffer?.driverId ?? null,
          offeredDriverName: offeredDriver?.name ?? null,
          offerExpiresAt: pendingOffer?.expiresAt ?? null,
          risk,
        };
      })
    );
  }),

  getEvents: adminQuery.input(z.object({ rideId: z.number() })).query(({ input }) => listDispatchEvents(input.rideId)),

  forceAssign: adminQuery
    .input(z.object({ rideId: z.number(), driverId: z.number(), force: z.boolean().default(false), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await adminAssignDriver(input.rideId, input.driverId, { actorUserId: ctx.user.id, force: input.force, reason: input.reason });
      if (result.success) {
        void sendPushToDrivers([input.driverId], { title: "New ride assigned", message: "An admin has assigned you a ride — open the app to view it.", url: "/driver/dashboard" });
      }
      return result;
    }),

  reassign: adminQuery
    .input(z.object({ rideId: z.number(), driverId: z.number(), force: z.boolean().default(false), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Ride not found." });
      const previousDriverId = existing.driverId;
      const result = await adminAssignDriver(input.rideId, input.driverId, { actorUserId: ctx.user.id, force: input.force, reason: input.reason });
      if (result.success) {
        const targets = previousDriverId ? [previousDriverId, input.driverId] : [input.driverId];
        void sendPushToDrivers(targets, { title: "Ride reassigned", message: "This ride's driver was changed by an admin.", url: "/driver/dashboard" });
      }
      return result;
    }),

  getSettings: adminQuery.query(() => getDispatchSettings()),

  updateSettings: adminQuery
    .input(
      z.object({
        baseRadiusKm: z.number().positive().optional(),
        radiusExpansionKm: z.number().nonnegative().optional(),
        offerTimeoutSec: z.number().int().positive().optional(),
        maxOfferRounds: z.number().int().positive().optional(),
        firstOfferDelaySec: z.number().int().nonnegative().optional(),
        reservationBufferMin: z.number().int().nonnegative().optional(),
        waitAndReturnMaxWaitMin: z.number().int().nonnegative().optional(),
        riskMediumAfterSec: z.number().int().positive().optional(),
        riskHighAfterSec: z.number().int().positive().optional(),
      }) satisfies z.ZodType<Partial<DispatchSettingsView>>
    )
    .mutation(({ input }) => updateDispatchSettings(input)),
});
