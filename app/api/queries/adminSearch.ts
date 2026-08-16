import { and, eq, like, or, desc } from "drizzle-orm";
import { getDb } from "./connection";
import { users, driverProfiles, rides, coupons, appComplaints } from "@db/schema";

const RESULT_LIMIT = 6;

export interface AdminSearchResult {
  riders: { id: number; name: string; phone: string; email: string | null }[];
  drivers: { id: number; name: string; phone: string; vehicleNumber: string; status: string }[];
  rides: { id: number; pickupAddress: string; dropAddress: string; status: string; totalFare: string; riderName: string }[];
  coupons: { code: string; description: string; discountType: string; discountValue: string; isActive: boolean }[];
  complaints: { id: string; subject: string; reporterName: string; status: string }[];
}

const EMPTY_RESULT: AdminSearchResult = { riders: [], drivers: [], rides: [], coupons: [], complaints: [] };

// Real, purpose-built LIKE queries per entity — deliberately NOT reusing
// admin-router.ts's listCustomers/listDrivers/listRides (those fetch the
// entire table unfiltered, fine for a one-time page load but wasteful for a
// search-as-you-type call fired on every keystroke).
export async function globalSearch(rawQuery: string): Promise<AdminSearchResult> {
  const query = rawQuery.trim();
  if (query.length < 2) return EMPTY_RESULT;

  const db = getDb();
  const like_ = `%${query}%`;
  const asRideId = /^\d+$/.test(query) ? Number(query) : null;

  const [riderRows, driverRows, rideRows, couponRows, complaintRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, phone: users.phone, email: users.email })
      .from(users)
      .where(and(eq(users.role, "user"), or(like(users.name, like_), like(users.phone, like_), like(users.email, like_))))
      .orderBy(desc(users.createdAt))
      .limit(RESULT_LIMIT),

    db
      .select({
        id: driverProfiles.id,
        name: users.name,
        phone: users.phone,
        vehicleNumber: driverProfiles.vehicleNumber,
        status: driverProfiles.status,
      })
      .from(driverProfiles)
      .leftJoin(users, eq(driverProfiles.userId, users.id))
      .where(or(like(users.name, like_), like(users.phone, like_), like(driverProfiles.vehicleNumber, like_), like(driverProfiles.licenseNumber, like_)))
      .orderBy(desc(driverProfiles.createdAt))
      .limit(RESULT_LIMIT),

    db
      .select({
        id: rides.id,
        pickupAddress: rides.pickupAddress,
        dropAddress: rides.dropAddress,
        status: rides.status,
        totalFare: rides.totalFare,
        riderName: users.name,
      })
      .from(rides)
      .leftJoin(users, eq(rides.userId, users.id))
      .where(
        asRideId !== null
          ? eq(rides.id, asRideId)
          : or(like(rides.pickupAddress, like_), like(rides.dropAddress, like_), like(users.name, like_))
      )
      .orderBy(desc(rides.createdAt))
      .limit(RESULT_LIMIT),

    db
      .select({
        code: coupons.code,
        description: coupons.description,
        discountType: coupons.discountType,
        discountValue: coupons.discountValue,
        isActive: coupons.isActive,
      })
      .from(coupons)
      .where(or(like(coupons.code, like_), like(coupons.description, like_)))
      .limit(RESULT_LIMIT),

    db
      .select({ id: appComplaints.id, subject: appComplaints.subject, reporterName: appComplaints.reporterName, status: appComplaints.status })
      .from(appComplaints)
      .where(or(like(appComplaints.id, like_), like(appComplaints.subject, like_), like(appComplaints.reporterName, like_), like(appComplaints.reporterPhone, like_)))
      .orderBy(desc(appComplaints.createdAt))
      .limit(RESULT_LIMIT),
  ]);

  return {
    riders: riderRows.map((r) => ({ ...r, name: r.name ?? "Rider", phone: r.phone ?? "" })),
    drivers: driverRows.map((d) => ({ ...d, name: d.name ?? "Driver", phone: d.phone ?? "" })),
    rides: rideRows.map((r) => ({ ...r, riderName: r.riderName ?? "Rider", totalFare: String(r.totalFare) })),
    coupons: couponRows.map((c) => ({ ...c, discountValue: String(c.discountValue) })),
    complaints: complaintRows,
  };
}
