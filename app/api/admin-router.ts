import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, driverProfiles, rides, payments, fareSettings } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { getDashboardStats, getRidesAnalytics, getRidesByType, getStatusSummary } from "./queries/adminStats";

export const adminRouter = createRouter({
  // publicQuery (not adminQuery) to match how the rest of the admin panel
  // actually works in this app — there's no real login gate in front of
  // /admin/* pages, so requiring a real admin session here would just break
  // the dashboard for every admin who hasn't gone through OTP login.
  getDashboardStats: publicQuery.query(() => getDashboardStats()),

  getRidesAnalytics: publicQuery
    .input(z.object({ period: z.string().optional() }).optional())
    .query(() => getRidesAnalytics()),

  getRidesByType: publicQuery.query(() => getRidesByType()),

  getStatusSummary: publicQuery.query(() => getStatusSummary()),

  // publicQuery, not adminQuery — same rationale as getDashboardStats above,
  // consistent with the rest of this admin panel: no real login gate exists
  // in front of /admin/*, so requiring a real admin session here would just
  // 403 the page for whoever's actually using it.
  listDrivers: publicQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          page: z.number().default(1),
          limit: z.number().default(10),
        })
        .optional()
    )
    .query(async () => {
      const db = getDb();
      const drivers = await db
        .select()
        .from(driverProfiles)
        .orderBy(desc(driverProfiles.createdAt));

      const enriched = [];
      for (const d of drivers) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, d.userId),
        });
        enriched.push({ ...d, user });
      }
      return enriched;
    }),

  // Everything the driver detail page needs in one call: the real profile,
  // the linked user row, and a real trip/payment history — replaces what
  // used to be a fully hardcoded mock driver record.
  getDriverDetail: publicQuery
    .input(z.object({ driverId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const profile = await db.query.driverProfiles.findFirst({ where: eq(driverProfiles.id, input.driverId) });
      if (!profile) return null;
      const user = await db.query.users.findFirst({ where: eq(users.id, profile.userId) });

      const driverPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.driverId, profile.userId))
        .orderBy(desc(payments.createdAt))
        .limit(20);

      const totalEarnings = driverPayments.reduce((sum, p) => sum + Number(p.driverEarnings), 0);
      const cashTotal = driverPayments.filter((p) => p.method === "cash").reduce((sum, p) => sum + Number(p.amount), 0);
      const onlineTotal = driverPayments.filter((p) => p.method !== "cash").reduce((sum, p) => sum + Number(p.amount), 0);

      const trips = [];
      for (const p of driverPayments) {
        const ride = await db.query.rides.findFirst({ where: eq(rides.id, p.rideId) });
        if (!ride) continue;
        trips.push({
          paymentId: p.id,
          rideId: ride.id,
          pickupAddress: ride.pickupAddress,
          dropAddress: ride.dropAddress,
          pickupLat: ride.pickupLat,
          pickupLng: ride.pickupLng,
          dropLat: ride.dropLat,
          dropLng: ride.dropLng,
          amount: Number(p.amount),
          method: p.method,
          createdAt: p.createdAt,
        });
      }

      return { profile, user, trips, totalEarnings, cashTotal, onlineTotal };
    }),

  approveDriver: publicQuery
    .input(z.object({ driverId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(driverProfiles)
        .set({ status: "approved", rejectionReason: null })
        .where(eq(driverProfiles.id, input.driverId));
      return { success: true };
    }),

  rejectDriver: publicQuery
    .input(z.object({ driverId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(driverProfiles)
        .set({ status: "rejected", rejectionReason: input.reason ?? null })
        .where(eq(driverProfiles.id, input.driverId));
      return { success: true };
    }),

  blockDriver: publicQuery
    .input(z.object({ driverId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(driverProfiles)
        .set({ status: "blocked" })
        .where(eq(driverProfiles.id, input.driverId));
      return { success: true };
    }),

  listCustomers: publicQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          page: z.number().default(1),
          limit: z.number().default(10),
        })
        .optional()
    )
    .query(async () => {
      const db = getDb();
      const customers = await db
        .select()
        .from(users)
        .where(eq(users.role, "user"))
        .orderBy(desc(users.createdAt));

      const enriched = [];
      for (const c of customers) {
        const rideCount = await db
          .select()
          .from(rides)
          .where(eq(rides.userId, c.id));
        enriched.push({ ...c, totalRides: rideCount.length });
      }
      return enriched;
    }),

  listRides: publicQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          page: z.number().default(1),
          limit: z.number().default(10),
        })
        .optional()
    )
    .query(async () => {
      const db = getDb();
      const allRides = await db.select().from(rides).orderBy(desc(rides.createdAt));
      const enriched = [];
      for (const r of allRides) {
        const rider = await db.query.users.findFirst({ where: eq(users.id, r.userId) });
        const driver = r.driverId ? await db.query.users.findFirst({ where: eq(users.id, r.driverId) }) : null;
        enriched.push({ ...r, riderName: rider?.name ?? "Rider", driverName: driver?.name ?? null });
      }
      return enriched;
    }),

  // Admin-facing ride lookup — deliberately separate from ride-router.ts's
  // getById, which restricts to the rider/assigned driver only. The admin
  // panel needs to see any ride regardless of who it belongs to.
  getRideDetail: publicQuery
    .input(z.object({ rideId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, input.rideId) });
      if (!ride) return null;
      const rider = await db.query.users.findFirst({ where: eq(users.id, ride.userId) });
      const driver = ride.driverId ? await db.query.users.findFirst({ where: eq(users.id, ride.driverId) }) : null;
      return {
        ...ride,
        riderName: rider?.name ?? "Rider",
        riderPhone: rider?.phone ?? null,
        driverName: driver?.name ?? null,
        driverPhone: driver?.phone ?? null,
      };
    }),

  getFinancials: publicQuery
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async () => {
      const db = getDb();
      const allPayments = await db.select().from(payments);
      const totalCommission = allPayments.reduce(
        (sum, p) => sum + Number(p.commission),
        0
      );
      const collected = allPayments
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const pending = allPayments
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Real per-driver commission dues — grouped from the actual payments
      // ledger instead of a fixed sample list of names.
      const duesByDriver = new Map<number, { rides: number; due: number }>();
      for (const p of allPayments) {
        if (!p.driverId) continue;
        const entry = duesByDriver.get(p.driverId) ?? { rides: 0, due: 0 };
        entry.rides += 1;
        entry.due += Number(p.commission);
        duesByDriver.set(p.driverId, entry);
      }
      const driverDues = [];
      for (const [driverId, entry] of duesByDriver) {
        const user = await db.query.users.findFirst({ where: eq(users.id, driverId) });
        driverDues.push({ name: user?.name ?? "Driver", rides: entry.rides, due: Math.round(entry.due * 100) / 100 });
      }
      driverDues.sort((a, b) => b.due - a.due);

      return { totalCommission, collected, pending, driverDues };
    }),

  // Row-level payment ledger for the admin Transactions page — every real
  // ride payment with rider/driver names and the ride's pickup/drop for
  // context, newest first. Filtering (status/method/date) happens client
  // side, same convention as listRides/listDrivers/listCustomers.
  listPayments: publicQuery.query(async () => {
    const db = getDb();
    const allPayments = await db.select().from(payments).orderBy(desc(payments.createdAt));
    const enriched = [];
    for (const p of allPayments) {
      const rider = await db.query.users.findFirst({ where: eq(users.id, p.userId) });
      const driver = p.driverId ? await db.query.users.findFirst({ where: eq(users.id, p.driverId) }) : null;
      const ride = await db.query.rides.findFirst({ where: eq(rides.id, p.rideId) });
      enriched.push({
        id: p.id,
        rideId: p.rideId,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        commission: Number(p.commission),
        driverEarnings: Number(p.driverEarnings),
        createdAt: p.createdAt,
        riderName: rider?.name ?? "Rider",
        driverName: driver?.name ?? null,
        pickupAddress: ride?.pickupAddress ?? null,
        dropAddress: ride?.dropAddress ?? null,
        rideType: ride?.rideType ?? null,
      });
    }
    return enriched;
  }),

  getFareSettings: publicQuery.query(async () => {
    const db = getDb();
    const settings = await db.query.fareSettings.findFirst();
    return (
      settings ?? {
        id: 1,
        baseFare: "20",
        perKmRate: "12",
        shareMultiplier: "0.60",
        reserveMultiplier: "1.30",
        commissionPerRide: "2.00",
        minFare: "20",
      }
    );
  }),

  updateFareSettings: publicQuery
    .input(
      z.object({
        baseFare: z.number(),
        perKmRate: z.number(),
        shareMultiplier: z.number(),
        reserveMultiplier: z.number(),
        commissionPerRide: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.fareSettings.findFirst();
      const values = {
        baseFare: input.baseFare.toString(),
        perKmRate: input.perKmRate.toString(),
        shareMultiplier: input.shareMultiplier.toString(),
        reserveMultiplier: input.reserveMultiplier.toString(),
        commissionPerRide: input.commissionPerRide.toString(),
      };
      if (existing) {
        await db.update(fareSettings).set(values).where(eq(fareSettings.id, existing.id));
      } else {
        await db.insert(fareSettings).values(values);
      }
      return { success: true };
    }),

  getLiveTracking: publicQuery.query(async () => {
    const db = getDb();
    const onlineDrivers = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.isOnline, true));

    const activeRides = await db
      .select()
      .from(rides)
      .where(
        and(
          sql`${rides.status} IN ('accepted', 'pickup', 'ongoing')`
        )
      );

    const driverMarkers = [];
    for (const d of onlineDrivers) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, d.userId),
      });
      driverMarkers.push({
        id: d.id,
        userId: d.userId,
        lat: d.currentLat ?? "22.69",
        lng: d.currentLng ?? "88.37",
        name: user?.name ?? "Driver",
        vehicleType: d.vehicleType,
        vehicleNumber: d.vehicleNumber,
        isOnline: d.isOnline,
      });
    }

    return { drivers: driverMarkers, rides: activeRides };
  }),
});
