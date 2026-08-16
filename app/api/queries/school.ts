import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { isDriverFreeForSchoolSubscription } from "./driverAvailability";
import { getDispatchSettings } from "./dispatch";
import { sendPushToGuardians, sendPushToDrivers } from "../notification-router";
import {
  schoolPlans,
  schoolSubscriptions,
  schoolTrips,
  schoolCalendarEvents,
  schoolTimingRequests,
  schoolSkipRequests,
  schoolRoutes,
  driverProfiles,
  users,
  type SchoolSubscriptionRow,
  type SchoolTripRow,
  type SchoolSkipRequestRow,
  type SchoolRouteRow,
} from "@db/schema";

export type SubscriptionStatus = "pending_review" | "reupload_requested" | "approved" | "rejected" | "suspended" | "cancelled";
export type TripDirection = "morning" | "evening";
export type PaymentStatus = "unpaid" | "paid" | "overdue";

export interface SchoolPlan {
  id: string;
  name: string;
  pricePerMonth: number;
  description: string;
  active: boolean;
}

export interface Coords {
  lat: number;
  lng: number;
}

export interface SchoolSubscription {
  id: string;
  guardianPhone: string;
  guardianName: string;
  guardianPhotoUrl?: string;
  guardianEmail: string;
  emergencyContact: string;
  studentName: string;
  studentPhotoUrl?: string;
  studentIdPhotoUrl?: string;
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  className: string;
  section: string;
  rollNumber: string;
  homeAddress: string;
  pickupCoords: Coords;
  dropCoords: Coords;
  morningPickupTime: string;
  schoolReportingTime: string;
  schoolEndTime: string;
  returnPickupTime: string;
  medicalNotes: string;
  allergies: string;
  specialInstructions: string;
  authorizedPickupPersons: string[];
  planId: string;
  consentAccepted: boolean;
  status: SubscriptionStatus;
  adminNote?: string;
  createdAt: number;
  verifiedAt?: number;
  assignedDriverName?: string;
  assignedVehicle?: string;
  assignedDriverId?: number;
  // Not a stored column — resolved live from users.phone via assignedDriverId
  // whenever a single subscription is fetched (see getSubscription), so a
  // reassigned driver's real number always shows without a data-migration.
  assignedDriverPhone?: string;
  pickupPin: string;
  dropPin: string;
  paymentStatus: PaymentStatus;
  validTill: string;
  autoRenew: boolean;
  // Real account (users.id), server-derived only — see createSubscription.
  guardianUserId?: number;
  routeId?: string;
  // Razorpay Subscriptions billing — see api/queries/schoolBilling.ts.
  razorpayPlanId?: string;
  razorpaySubscriptionId?: string;
  razorpaySubscriptionStatus?: string;
  paymentFailedAt?: number;
  graceEndsAt?: string;
  suspendedReason?: "admin" | "nonpayment";
  backupDriverId?: number;
  backupDriverName?: string;
  backupVehicle?: string;
}

export const MORNING_STAGES = [
  "driver_assigned", "driver_started", "near_pickup", "arrived_pickup",
  "student_boarded", "pickup_confirmed", "left_pickup", "reached_school",
  "student_dropped", "trip_completed",
] as const;
export const EVENING_STAGES = [
  "driver_assigned", "driver_started", "reached_school", "student_boarded",
  "left_school", "near_home", "reached_home", "student_dropped", "trip_completed",
] as const;

export interface SchoolTrip {
  id: string;
  subscriptionId: string;
  date: string;
  direction: TripDirection;
  stageIndex: number;
  stageHistory: { stage: string; timestamp: number }[];
  driverName: string;
  vehicle: string;
  pickupPinVerified: boolean;
  dropPinVerified: boolean;
  skipped: boolean;
  createdAt: number;
}

export type CalendarEventType = "holiday" | "exam" | "half_day" | "event" | "transport_closed";
export interface SchoolCalendarEvent {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
}

export type TimingField = "morningPickupTime" | "schoolReportingTime" | "schoolEndTime" | "returnPickupTime";
export interface TimingChangeRequest {
  id: string;
  subscriptionId: string;
  field: TimingField;
  requestedValue: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}
function genPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function toSubView(row: SchoolSubscriptionRow): SchoolSubscription {
  return {
    id: row.id,
    guardianPhone: row.guardianPhone,
    guardianName: row.guardianName,
    guardianPhotoUrl: row.guardianPhotoUrl ?? undefined,
    guardianEmail: row.guardianEmail,
    emergencyContact: row.emergencyContact,
    studentName: row.studentName,
    studentPhotoUrl: row.studentPhotoUrl ?? undefined,
    studentIdPhotoUrl: row.studentIdPhotoUrl ?? undefined,
    schoolName: row.schoolName,
    schoolAddress: row.schoolAddress,
    schoolPhone: row.schoolPhone,
    className: row.className,
    section: row.section,
    rollNumber: row.rollNumber,
    homeAddress: row.homeAddress,
    pickupCoords: row.pickupCoords,
    dropCoords: row.dropCoords,
    morningPickupTime: row.morningPickupTime,
    schoolReportingTime: row.schoolReportingTime,
    schoolEndTime: row.schoolEndTime,
    returnPickupTime: row.returnPickupTime,
    medicalNotes: row.medicalNotes,
    allergies: row.allergies,
    specialInstructions: row.specialInstructions,
    authorizedPickupPersons: row.authorizedPickupPersons,
    planId: row.planId,
    consentAccepted: row.consentAccepted,
    status: row.status,
    adminNote: row.adminNote ?? undefined,
    createdAt: row.createdAt.getTime(),
    verifiedAt: row.verifiedAt?.getTime(),
    assignedDriverName: row.assignedDriverName ?? undefined,
    assignedVehicle: row.assignedVehicle ?? undefined,
    assignedDriverId: row.assignedDriverId ?? undefined,
    pickupPin: row.pickupPin,
    dropPin: row.dropPin,
    paymentStatus: row.paymentStatus,
    validTill: row.validTill,
    autoRenew: row.autoRenew,
    guardianUserId: row.guardianUserId ?? undefined,
    routeId: row.routeId ?? undefined,
    razorpayPlanId: row.razorpayPlanId ?? undefined,
    razorpaySubscriptionId: row.razorpaySubscriptionId ?? undefined,
    razorpaySubscriptionStatus: row.razorpaySubscriptionStatus ?? undefined,
    paymentFailedAt: row.paymentFailedAt?.getTime(),
    graceEndsAt: row.graceEndsAt ?? undefined,
    suspendedReason: row.suspendedReason ?? undefined,
    backupDriverId: row.backupDriverId ?? undefined,
    backupDriverName: row.backupDriverName ?? undefined,
    backupVehicle: row.backupVehicle ?? undefined,
  };
}

export interface SchoolRoute {
  id: string;
  name: string;
  vehicleLabel: string;
  stops: string[];
  primaryDriverId?: number;
  backupDriverId?: number;
  monthlyFee: number;
  createdAt: number;
}

function toRouteView(row: SchoolRouteRow): SchoolRoute {
  return {
    id: row.id,
    name: row.name,
    vehicleLabel: row.vehicleLabel,
    stops: row.stops,
    primaryDriverId: row.primaryDriverId ?? undefined,
    backupDriverId: row.backupDriverId ?? undefined,
    monthlyFee: Number(row.monthlyFee),
    createdAt: row.createdAt.getTime(),
  };
}

function toTripView(row: SchoolTripRow): SchoolTrip {
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    date: row.date,
    direction: row.direction,
    stageIndex: row.stageIndex,
    stageHistory: row.stageHistory,
    driverName: row.driverName,
    vehicle: row.vehicle,
    pickupPinVerified: row.pickupPinVerified,
    dropPinVerified: row.dropPinVerified,
    skipped: row.skipped,
    createdAt: row.createdAt.getTime(),
  };
}

// ---- Plans -------------------------------------------------------------
const DEFAULT_PLANS: SchoolPlan[] = [
  { id: "plan-basic", name: "Basic", pricePerMonth: 1200, description: "Standard shared e-rickshaw, one pickup point", active: true },
  { id: "plan-plus", name: "Plus", pricePerMonth: 1800, description: "Priority seating, SMS + WhatsApp alerts", active: true },
  { id: "plan-premium", name: "Premium", pricePerMonth: 2500, description: "Dedicated small vehicle, door-to-door", active: true },
];

export async function seedSchoolPlansIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schoolPlans);
  if (Number(count) > 0) return;
  await db.insert(schoolPlans).values(DEFAULT_PLANS.map((p) => ({ ...p, pricePerMonth: String(p.pricePerMonth) })));
}

export async function listPlans(): Promise<SchoolPlan[]> {
  const rows = await getDb().select().from(schoolPlans);
  return rows.map((r) => ({ id: r.id, name: r.name, pricePerMonth: Number(r.pricePerMonth), description: r.description, active: r.active }));
}

export async function upsertPlan(input: { id?: string; name: string; pricePerMonth: number; description: string; active: boolean }): Promise<SchoolPlan[]> {
  const db = getDb();
  if (input.id) {
    await db.update(schoolPlans).set({ name: input.name, pricePerMonth: String(input.pricePerMonth), description: input.description, active: input.active }).where(eq(schoolPlans.id, input.id));
  } else {
    await db.insert(schoolPlans).values({ id: genId("plan"), name: input.name, pricePerMonth: String(input.pricePerMonth), description: input.description, active: input.active });
  }
  return listPlans();
}

// ---- Subscriptions -------------------------------------------------------
// guardianUserId/routeId/razorpay*/paymentFailedAt/graceEndsAt/
// suspendedReason/backup* are all server- or admin-set (never client input)
// — omitted here alongside the pre-existing server-defaulted fields.
export type SubscriptionInput = Omit<
  SchoolSubscription,
  | "id" | "status" | "createdAt" | "pickupPin" | "dropPin" | "paymentStatus" | "validTill" | "autoRenew" | "verifiedAt" | "assignedDriverName" | "assignedVehicle" | "adminNote"
  | "guardianUserId" | "routeId" | "razorpayPlanId" | "razorpaySubscriptionId" | "razorpaySubscriptionStatus" | "paymentFailedAt" | "graceEndsAt" | "suspendedReason"
  | "backupDriverId" | "backupDriverName" | "backupVehicle"
>;

export async function createSubscription(input: SubscriptionInput, guardianUserId: number): Promise<SchoolSubscription> {
  const db = getDb();
  const id = genId("sub");
  await db.insert(schoolSubscriptions).values({
    ...input,
    id,
    guardianUserId,
    status: "pending_review",
    pickupPin: genPin(),
    dropPin: genPin(),
    paymentStatus: "unpaid",
    validTill: todayStr(),
    autoRenew: true,
  });
  const row = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  return toSubView(row!);
}

export async function updateSubscription(id: string, updates: Partial<SubscriptionInput>): Promise<SchoolSubscription | null> {
  const db = getDb();
  const existing = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  if (!existing) return null;
  // Editing details after a reupload request puts it back in the queue.
  const values: Record<string, unknown> = { ...updates };
  if (existing.status === "reupload_requested") values.status = "pending_review";
  await db.update(schoolSubscriptions).set(values).where(eq(schoolSubscriptions.id, id));
  const row = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  return toSubView(row!);
}

export async function listMySubscriptions(guardianPhone: string): Promise<SchoolSubscription[]> {
  const rows = await getDb().select().from(schoolSubscriptions).where(eq(schoolSubscriptions.guardianPhone, guardianPhone));
  return rows.map(toSubView);
}

// Real-identity lookup — keyed by guardianUserId (server-derived from
// ctx.user.id) rather than a client-supplied guardianPhone string. This is
// the primary lookup for nav/dashboard purposes now; listMySubscriptions
// above stays only for legacy display of pre-auth rows.
export async function listMyActiveSubscriptions(guardianUserId: number): Promise<SchoolSubscription[]> {
  const rows = await getDb().select().from(schoolSubscriptions).where(eq(schoolSubscriptions.guardianUserId, guardianUserId));
  return rows.map(toSubView);
}

export async function getSubscription(id: string): Promise<SchoolSubscription | null> {
  const row = await getDb().query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  if (!row) return null;
  const sub = toSubView(row);
  if (row.assignedDriverId) {
    const driver = await getDb().query.users.findFirst({ where: eq(users.id, row.assignedDriverId) });
    sub.assignedDriverPhone = driver?.phone ?? undefined;
  }
  return sub;
}

export async function listAllSubscriptions(status?: SubscriptionStatus): Promise<SchoolSubscription[]> {
  const rows = await getDb().select().from(schoolSubscriptions).where(status ? eq(schoolSubscriptions.status, status) : undefined);
  return rows.map(toSubView);
}

export async function verifySubscription(
  id: string,
  action: "approve" | "reject" | "reupload" | "suspend" | "reactivate",
  note?: string,
  // DI, same convention paySubscription below uses for creditCompanyRevenue
  // — keeps this queries/school.ts file free of a direct import from
  // queries/schoolBilling.ts. Passed by the router (which already imports
  // schoolBilling.ts for the pause/resume/cancel sync calls).
  cancelRazorpay?: (subscriptionId: string, cancelAtCycleEnd: boolean) => Promise<unknown>
): Promise<SchoolSubscription | null> {
  const db = getDb();
  const existing = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  if (!existing) return null;
  const nextStatus: Record<typeof action, SubscriptionStatus> = {
    approve: "approved", reject: "rejected", reupload: "reupload_requested", suspend: "suspended", reactivate: "approved",
  };
  const values: Record<string, unknown> = { status: nextStatus[action], adminNote: note };
  if (action === "approve" || action === "reactivate") {
    values.verifiedAt = new Date();
    if (existing.validTill <= todayStr()) values.validTill = addMonths(todayStr(), 1);
  }
  // A rejected child must never be billed — cancel immediately, not at
  // cycle end, since there's no "cycle" to honor for something never approved.
  if (action === "reject" && existing.razorpaySubscriptionId && cancelRazorpay) {
    await cancelRazorpay(id, false);
  }
  await db.update(schoolSubscriptions).set(values).where(eq(schoolSubscriptions.id, id));
  const row = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  return toSubView(row!);
}

// ---- Daily driver assignment ---------------------------------------------
// Real approved drivers only — replaces the old fixed 5-name mock roster,
// which could never match a real logged-in driver's account, so School Duty
// Mode's "my assigned students" query could never actually return anything
// for a real driver.
export async function listAvailableDrivers(): Promise<{ id: number; name: string; vehicle: string }[]> {
  const rows = await getDb()
    .select({ userId: driverProfiles.userId, name: users.name, vehicleModel: driverProfiles.vehicleModel, vehicleNumber: driverProfiles.vehicleNumber })
    .from(driverProfiles)
    .innerJoin(users, eq(driverProfiles.userId, users.id))
    .where(eq(driverProfiles.status, "approved"));
  return rows.map((r) => ({ id: r.userId, name: r.name ?? `Driver #${r.userId}`, vehicle: [r.vehicleModel, r.vehicleNumber].filter(Boolean).join(" · ") }));
}

export async function assignDriver(
  id: string,
  driverId: number,
  driverName: string,
  vehicle: string,
  // undefined = leave backup untouched; null = clear it; object = set it.
  // Backup is informational/reporting only (see activateBackupDriver for
  // the actual takeover) so it isn't itself conflict-checked here.
  backup?: { driverId: number; driverName: string; vehicle: string } | null
): Promise<{ ok: true; subscription: SchoolSubscription; changed: boolean } | { ok: false; error: string }> {
  const db = getDb();
  const existing = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  if (!existing) return { ok: false, error: "Subscription not found." };

  // Dispatch engine: a school driver's recurring morning/evening windows
  // can't overlap another student already assigned to them — checked
  // against every OTHER approved subscription this driver already has.
  const settings = await getDispatchSettings();
  const availability = await isDriverFreeForSchoolSubscription(driverId, existing, settings.reservationBufferMin, id);
  if (!availability.free) {
    return { ok: false, error: `This driver already has a conflicting school run (${availability.conflict.reason}).` };
  }

  const changed = !!existing.assignedDriverId && existing.assignedDriverId !== driverId;
  const values: Record<string, unknown> = { assignedDriverId: driverId, assignedDriverName: driverName, assignedVehicle: vehicle };
  if (backup !== undefined) {
    values.backupDriverId = backup?.driverId ?? null;
    values.backupDriverName = backup?.driverName ?? null;
    values.backupVehicle = backup?.vehicle ?? null;
  }
  await db.update(schoolSubscriptions).set(values).where(eq(schoolSubscriptions.id, id));
  const row = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  return { ok: true, subscription: toSubView(row!), changed };
}

// Swaps primary <-> backup — the old primary becomes the new backup, so a
// "swap back" is always possible. Re-runs the same conflict check the
// original assignment used, for the incoming primary.
export async function activateBackupDriver(id: string): Promise<{ ok: true; subscription: SchoolSubscription } | { ok: false; error: string }> {
  const db = getDb();
  const existing = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  if (!existing) return { ok: false, error: "Subscription not found." };
  if (!existing.backupDriverId || !existing.backupDriverName) return { ok: false, error: "No backup driver set for this subscription." };

  const settings = await getDispatchSettings();
  const availability = await isDriverFreeForSchoolSubscription(existing.backupDriverId, existing, settings.reservationBufferMin, id);
  if (!availability.free) {
    return { ok: false, error: `Backup driver already has a conflicting school run (${availability.conflict.reason}).` };
  }

  await db
    .update(schoolSubscriptions)
    .set({
      assignedDriverId: existing.backupDriverId,
      assignedDriverName: existing.backupDriverName,
      assignedVehicle: existing.backupVehicle ?? "",
      backupDriverId: existing.assignedDriverId,
      backupDriverName: existing.assignedDriverName,
      backupVehicle: existing.assignedVehicle,
    })
    .where(eq(schoolSubscriptions.id, id));

  if (existing.guardianUserId) {
    await sendPushToGuardians([existing.guardianUserId], {
      title: "Driver changed",
      message: `${existing.backupDriverName} is now ${existing.studentName}'s school transport driver.`,
    });
  }
  await sendPushToDrivers([existing.backupDriverId], {
    title: "School run assigned",
    message: `You've been activated as the driver for ${existing.studentName}'s school transport.`,
  });

  const row = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, id) });
  return { ok: true, subscription: toSubView(row!) };
}

export async function listMyAssignedStudents(driverId: number): Promise<SchoolSubscription[]> {
  const rows = await getDb().select().from(schoolSubscriptions).where(and(eq(schoolSubscriptions.status, "approved"), eq(schoolSubscriptions.assignedDriverId, driverId)));
  return rows.map(toSubView);
}

// ---- Live driver location (school context) --------------------------------
export async function getAssignedDriverLocation(subscriptionId: string): Promise<{ lat: number; lng: number } | null> {
  const db = getDb();
  const sub = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, subscriptionId) });
  if (!sub?.assignedDriverId) return null;
  const profile = await db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, sub.assignedDriverId) });
  if (!profile?.currentLat || !profile?.currentLng) return null;
  return { lat: Number(profile.currentLat), lng: Number(profile.currentLng) };
}

// ---- Trips / timeline -----------------------------------------------------
// Ensures a subscription+date+direction trip exists, creating it (with a
// driver_assigned first stage) if this is the first time it's been
// requested — lazy per-day trip generation, no cron needed for the common
// "guardian/driver opens the app" path. Shared with the nightly worker
// (schoolNightlyWorker.ts), which calls this ahead of time for tomorrow so
// trips (and their first-creation reminder push) exist before anyone opens
// the app — naturally idempotent either way via the `existing` check below.
export async function getOrCreateTripForDate(subscriptionId: string, date: string, direction: TripDirection): Promise<{ trip: SchoolTrip; created: boolean }> {
  const db = getDb();
  const key = `${subscriptionId}:${date}:${direction}`;
  const existing = await db.query.schoolTrips.findFirst({ where: eq(schoolTrips.id, key) });
  if (existing) return { trip: toTripView(existing), created: false };

  const sub = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, subscriptionId) });
  const skip = await db.query.schoolSkipRequests.findFirst({
    where: and(eq(schoolSkipRequests.subscriptionId, subscriptionId), eq(schoolSkipRequests.date, date)),
  });
  await db.insert(schoolTrips).values({
    id: key,
    subscriptionId,
    date,
    direction,
    stageIndex: sub?.assignedDriverName ? 0 : -1,
    stageHistory: sub?.assignedDriverName ? [{ stage: "driver_assigned", timestamp: Date.now() }] : [],
    driverName: sub?.assignedDriverName ?? "",
    vehicle: sub?.assignedVehicle ?? "",
    skipped: !!skip,
  });
  const row = await db.query.schoolTrips.findFirst({ where: eq(schoolTrips.id, key) });
  return { trip: toTripView(row!), created: true };
}

export async function getOrCreateTodayTrip(subscriptionId: string, direction: TripDirection): Promise<SchoolTrip> {
  const { trip } = await getOrCreateTripForDate(subscriptionId, todayStr(), direction);
  return trip;
}

// ---- Guardian day-off / pause requests -------------------------------------
export async function requestSkipDay(subscriptionId: string, date: string, reason: string): Promise<SchoolSkipRequestRow> {
  const db = getDb();
  const existing = await db.query.schoolSkipRequests.findFirst({
    where: and(eq(schoolSkipRequests.subscriptionId, subscriptionId), eq(schoolSkipRequests.date, date)),
  });
  if (existing) return existing;
  const id = genId("skip");
  await db.insert(schoolSkipRequests).values({ id, subscriptionId, date, reason });
  return (await db.query.schoolSkipRequests.findFirst({ where: eq(schoolSkipRequests.id, id) }))!;
}

export async function listSkipRequests(subscriptionId: string): Promise<SchoolSkipRequestRow[]> {
  return getDb()
    .select()
    .from(schoolSkipRequests)
    .where(eq(schoolSkipRequests.subscriptionId, subscriptionId))
    .orderBy(sql`${schoolSkipRequests.date} DESC`);
}

export async function cancelSkipRequest(id: string): Promise<void> {
  await getDb().delete(schoolSkipRequests).where(eq(schoolSkipRequests.id, id));
}

// Admin visibility across every subscription — listSkipRequests above is
// scoped to one subscription (the parent dashboard's own view).
export async function listAllSkipRequests(limit: number) {
  const rows = await getDb()
    .select({
      id: schoolSkipRequests.id,
      subscriptionId: schoolSkipRequests.subscriptionId,
      date: schoolSkipRequests.date,
      reason: schoolSkipRequests.reason,
      createdAt: schoolSkipRequests.createdAt,
      studentName: schoolSubscriptions.studentName,
    })
    .from(schoolSkipRequests)
    .leftJoin(schoolSubscriptions, eq(schoolSkipRequests.subscriptionId, schoolSubscriptions.id))
    .orderBy(sql`${schoolSkipRequests.date} DESC`)
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }));
}

export async function advanceTripStage(tripId: string): Promise<SchoolTrip | null> {
  const db = getDb();
  const trip = await db.query.schoolTrips.findFirst({ where: eq(schoolTrips.id, tripId) });
  if (!trip) return null;
  const stages = trip.direction === "morning" ? MORNING_STAGES : EVENING_STAGES;
  if (trip.stageIndex >= stages.length - 1) return toTripView(trip);
  const nextIndex = trip.stageIndex + 1;
  const nextHistory = [...trip.stageHistory, { stage: stages[nextIndex], timestamp: Date.now() }];
  await db.update(schoolTrips).set({ stageIndex: nextIndex, stageHistory: nextHistory }).where(eq(schoolTrips.id, tripId));
  const row = await db.query.schoolTrips.findFirst({ where: eq(schoolTrips.id, tripId) });
  return toTripView(row!);
}

export async function listTripHistory(subscriptionId: string, limit: number): Promise<SchoolTrip[]> {
  const rows = await getDb()
    .select()
    .from(schoolTrips)
    .where(eq(schoolTrips.subscriptionId, subscriptionId))
    .orderBy(sql`${schoolTrips.createdAt} DESC`)
    .limit(limit);
  return rows.map(toTripView);
}

// ---- PIN pickup/drop verification -----------------------------------------
export async function verifyPin(tripId: string, pin: string, kind: "pickup" | "drop"): Promise<{ ok: true; trip: SchoolTrip } | { ok: false; error: string }> {
  const db = getDb();
  const trip = await db.query.schoolTrips.findFirst({ where: eq(schoolTrips.id, tripId) });
  if (!trip) return { ok: false, error: "Trip not found" };
  const sub = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, trip.subscriptionId) });
  if (!sub) return { ok: false, error: "Subscription not found" };
  const expectedPin = kind === "pickup" ? sub.pickupPin : sub.dropPin;
  if (expectedPin !== pin) return { ok: false, error: "Incorrect PIN" };
  await db.update(schoolTrips).set(kind === "pickup" ? { pickupPinVerified: true } : { dropPinVerified: true }).where(eq(schoolTrips.id, tripId));
  const row = await db.query.schoolTrips.findFirst({ where: eq(schoolTrips.id, tripId) });
  return { ok: true, trip: toTripView(row!) };
}

// ---- Attendance (derived from trip PIN verification) -----------------------
export async function listAttendance(subscriptionId: string, limit: number) {
  const trips = await listTripHistory(subscriptionId, limit);
  return trips.map((t) => ({
    date: t.date,
    direction: t.direction,
    pickupPinVerified: t.pickupPinVerified,
    dropPinVerified: t.dropPinVerified,
    completed: t.stageIndex >= (t.direction === "morning" ? MORNING_STAGES.length : EVENING_STAGES.length) - 1,
  }));
}

// ---- Timing change requests ------------------------------------------------
export async function requestTimingChange(input: { subscriptionId: string; field: TimingField; requestedValue: string }): Promise<TimingChangeRequest> {
  const id = genId("timing");
  await getDb().insert(schoolTimingRequests).values({ id, ...input });
  const row = await getDb().query.schoolTimingRequests.findFirst({ where: eq(schoolTimingRequests.id, id) });
  return { id: row!.id, subscriptionId: row!.subscriptionId, field: row!.field, requestedValue: row!.requestedValue, status: row!.status, createdAt: row!.createdAt.getTime() };
}

export async function listTimingRequests(filter: { subscriptionId?: string; status?: "pending" | "approved" | "rejected" }): Promise<TimingChangeRequest[]> {
  const db = getDb();
  const conditions = [];
  if (filter.subscriptionId) conditions.push(eq(schoolTimingRequests.subscriptionId, filter.subscriptionId));
  if (filter.status) conditions.push(eq(schoolTimingRequests.status, filter.status));
  const rows = await db.select().from(schoolTimingRequests).where(conditions.length ? and(...conditions) : undefined);
  return rows.map((r) => ({ id: r.id, subscriptionId: r.subscriptionId, field: r.field, requestedValue: r.requestedValue, status: r.status, createdAt: r.createdAt.getTime() }));
}

export async function resolveTimingChange(id: string, approve: boolean): Promise<{ ok: true; request: TimingChangeRequest } | { ok: false; error: string }> {
  const db = getDb();
  const request = await db.query.schoolTimingRequests.findFirst({ where: eq(schoolTimingRequests.id, id) });
  if (!request) return { ok: false, error: "Request not found" };
  await db.update(schoolTimingRequests).set({ status: approve ? "approved" : "rejected" }).where(eq(schoolTimingRequests.id, id));
  if (approve) {
    await db.update(schoolSubscriptions).set({ [request.field]: request.requestedValue }).where(eq(schoolSubscriptions.id, request.subscriptionId));
  }
  const row = await db.query.schoolTimingRequests.findFirst({ where: eq(schoolTimingRequests.id, id) });
  return { ok: true, request: { id: row!.id, subscriptionId: row!.subscriptionId, field: row!.field, requestedValue: row!.requestedValue, status: row!.status, createdAt: row!.createdAt.getTime() } };
}

// ---- School calendar ---------------------------------------------------
export async function listCalendarEvents(): Promise<SchoolCalendarEvent[]> {
  const rows = await getDb().select().from(schoolCalendarEvents).orderBy(schoolCalendarEvents.date);
  return rows;
}

export async function publishCalendarEvent(input: { date: string; type: CalendarEventType; title: string }): Promise<SchoolCalendarEvent[]> {
  await getDb().insert(schoolCalendarEvents).values({ id: genId("cal"), ...input });
  return listCalendarEvents();
}

export async function removeCalendarEvent(id: string): Promise<void> {
  await getDb().delete(schoolCalendarEvents).where(eq(schoolCalendarEvents.id, id));
}

// ---- Subscription management + payment ----------------------------------
export async function pauseSubscription(id: string): Promise<SchoolSubscription | null> {
  await getDb().update(schoolSubscriptions).set({ status: "suspended" }).where(eq(schoolSubscriptions.id, id));
  return getSubscription(id);
}

export async function resumeSubscription(id: string): Promise<SchoolSubscription | null> {
  await getDb().update(schoolSubscriptions).set({ status: "approved" }).where(eq(schoolSubscriptions.id, id));
  return getSubscription(id);
}

export async function cancelSubscription(id: string, cancelAtCycleEnd: boolean): Promise<SchoolSubscription | null> {
  const values: Record<string, unknown> = { autoRenew: false };
  // Immediate cancellation takes effect synchronously — no reason to wait
  // for a webhook that, in this dev environment, structurally can never
  // arrive (no public URL to register with Razorpay). At-cycle-end
  // cancellation, by contrast, stays "approved" until the real
  // subscription.cancelled webhook confirms the cycle actually ended —
  // handleWebhookEvent (schoolBilling.ts) is the source of truth for that.
  if (!cancelAtCycleEnd) values.status = "cancelled";
  await getDb().update(schoolSubscriptions).set(values).where(eq(schoolSubscriptions.id, id));
  return getSubscription(id);
}

export async function setAutoRenew(id: string, autoRenew: boolean): Promise<SchoolSubscription | null> {
  await getDb().update(schoolSubscriptions).set({ autoRenew }).where(eq(schoolSubscriptions.id, id));
  return getSubscription(id);
}

export async function upgradePlan(id: string, planId: string): Promise<SchoolSubscription | null> {
  await getDb().update(schoolSubscriptions).set({ planId }).where(eq(schoolSubscriptions.id, id));
  return getSubscription(id);
}

// ---- Routes (real replacement for AdminSchoolTransport.tsx's mock arrays) ----
export async function listRoutes(): Promise<SchoolRoute[]> {
  const rows = await getDb().select().from(schoolRoutes).orderBy(schoolRoutes.name);
  return rows.map(toRouteView);
}

export async function upsertRoute(input: {
  id?: string;
  name: string;
  vehicleLabel: string;
  stops: string[];
  primaryDriverId?: number;
  backupDriverId?: number;
  monthlyFee: number;
}): Promise<SchoolRoute[]> {
  const db = getDb();
  const values = {
    name: input.name,
    vehicleLabel: input.vehicleLabel,
    stops: input.stops,
    primaryDriverId: input.primaryDriverId ?? null,
    backupDriverId: input.backupDriverId ?? null,
    monthlyFee: String(input.monthlyFee),
  };
  if (input.id) {
    await db.update(schoolRoutes).set(values).where(eq(schoolRoutes.id, input.id));
  } else {
    await db.insert(schoolRoutes).values({ id: genId("route"), ...values });
  }
  return listRoutes();
}

export async function removeRoute(id: string): Promise<void> {
  await getDb().delete(schoolRoutes).where(eq(schoolRoutes.id, id));
}
