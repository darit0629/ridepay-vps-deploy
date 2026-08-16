import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { commissionRecords, cancellationRecords, driverProfiles, users } from "@db/schema";

function startOfDay(offsetDays: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function pctChange(today: number, yesterday: number): string {
  if (yesterday === 0) return today > 0 ? "+100%" : "0%";
  const pct = ((today - yesterday) / yesterday) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

// Every stat here is derived from the app's real ledgers (commission_records
// for settled ride/parcel payments, cancellation_records, driver_profiles,
// users) — there's no separate persisted "ride" entity in this app (booking
// state lives client-side until a payment settles), so "rides today" means
// settled ride payments today, and "ongoing rides" has no real backing and
// is reported as 0 rather than fabricated.
export async function getDashboardStats() {
  const db = getDb();
  const todayStart = startOfDay(0);
  const yesterdayStart = startOfDay(-1);

  const [todayRideRows, yesterdayRideRows, activeDriverRows, customerRows, customersAsOfYesterdayRows, todayRevenueRows, yesterdayRevenueRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(commissionRecords).where(and(eq(commissionRecords.source, "ride"), gte(commissionRecords.createdAt, todayStart))),
    db.select({ count: sql<number>`count(*)` }).from(commissionRecords).where(and(eq(commissionRecords.source, "ride"), gte(commissionRecords.createdAt, yesterdayStart), lt(commissionRecords.createdAt, todayStart))),
    db.select({ count: sql<number>`count(*)` }).from(driverProfiles).where(eq(driverProfiles.isOnline, true)),
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "user")),
    db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "user"), lt(users.createdAt, todayStart))),
    db.select({ total: sql<string>`coalesce(sum(${commissionRecords.total}), 0)` }).from(commissionRecords).where(gte(commissionRecords.createdAt, todayStart)),
    db.select({ total: sql<string>`coalesce(sum(${commissionRecords.total}), 0)` }).from(commissionRecords).where(and(gte(commissionRecords.createdAt, yesterdayStart), lt(commissionRecords.createdAt, todayStart))),
  ]);

  const totalRidesToday = Number(todayRideRows[0].count);
  const totalRidesYesterday = Number(yesterdayRideRows[0].count);
  const activeDrivers = Number(activeDriverRows[0].count);
  const registeredCustomers = Number(customerRows[0].count);
  const customersAsOfYesterday = Number(customersAsOfYesterdayRows[0].count);
  const revenueToday = Number(todayRevenueRows[0].total);
  const revenueYesterday = Number(yesterdayRevenueRows[0].total);

  return {
    totalRidesToday,
    activeDrivers,
    registeredCustomers,
    revenue: Math.round(revenueToday),
    trends: {
      rides: pctChange(totalRidesToday, totalRidesYesterday),
      customers: pctChange(registeredCustomers, customersAsOfYesterday),
      revenue: pctChange(revenueToday, revenueYesterday),
    },
  };
}

// Hourly bars for "today" — real counts/revenue bucketed by the settlement
// timestamp on commission_records, not a simulated random walk.
export async function getRidesAnalytics() {
  const db = getDb();
  const todayStart = startOfDay(0);
  const rows = await db
    .select()
    .from(commissionRecords)
    .where(and(eq(commissionRecords.source, "ride"), gte(commissionRecords.createdAt, todayStart)));

  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const inHour = rows.filter((r) => r.createdAt.getHours() === hour);
    return {
      hour: `${hour}:00`,
      rides: inHour.length,
      revenue: Math.round(inHour.reduce((sum, r) => sum + Number(r.total), 0)),
    };
  });

  return { ridesByHour: byHour, revenueByHour: byHour };
}

// Split by settlement source (ride vs parcel) rather than share/reserve —
// this app doesn't persist ride segment on the commission ledger, so this
// is the real breakdown actually available rather than a fabricated one.
export async function getRidesByType() {
  const db = getDb();
  const todayStart = startOfDay(0);
  const rows = await db.select({ source: commissionRecords.source, count: sql<number>`count(*)` }).from(commissionRecords).where(gte(commissionRecords.createdAt, todayStart)).groupBy(commissionRecords.source);

  const rides = Number(rows.find((r) => r.source === "ride")?.count ?? 0);
  const parcels = Number(rows.find((r) => r.source === "parcel")?.count ?? 0);
  const total = rides + parcels || 1;

  return {
    rides,
    parcels,
    percentages: {
      rides: Math.round((rides / total) * 100),
      parcels: Math.round((parcels / total) * 100),
    },
  };
}

export async function getStatusSummary() {
  const db = getDb();
  const todayStart = startOfDay(0);

  const [completedRows, driverCancelledRows, customerCancelledRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(commissionRecords).where(and(eq(commissionRecords.source, "ride"), gte(commissionRecords.createdAt, todayStart))),
    db.select({ count: sql<number>`count(*)` }).from(cancellationRecords).where(and(eq(cancellationRecords.initiator, "driver"), gte(cancellationRecords.createdAt, todayStart))),
    db.select({ count: sql<number>`count(*)` }).from(cancellationRecords).where(and(eq(cancellationRecords.initiator, "rider"), gte(cancellationRecords.createdAt, todayStart))),
  ]);

  const driverCancelled = Number(driverCancelledRows[0].count);
  const customerCancelled = Number(customerCancelledRows[0].count);

  return {
    completed: Number(completedRows[0].count),
    cancelled: driverCancelled + customerCancelled,
    // No persisted "ride in progress" entity exists yet (see module comment)
    // — reported honestly as 0 rather than simulated.
    ongoing: 0,
    driverCancelled,
    customerCancelled,
  };
}
