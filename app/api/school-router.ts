import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware";
import {
  listPlans,
  upsertPlan,
  createSubscription,
  updateSubscription,
  listMySubscriptions,
  listMyActiveSubscriptions,
  getSubscription,
  listAllSubscriptions,
  verifySubscription,
  assignDriver,
  activateBackupDriver,
  listAvailableDrivers,
  listMyAssignedStudents,
  getAssignedDriverLocation,
  getOrCreateTodayTrip,
  advanceTripStage,
  listTripHistory,
  verifyPin,
  listAttendance,
  requestTimingChange,
  listTimingRequests,
  resolveTimingChange,
  listCalendarEvents,
  publishCalendarEvent,
  removeCalendarEvent,
  requestSkipDay,
  listSkipRequests,
  listAllSkipRequests,
  cancelSkipRequest,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  setAutoRenew,
  upgradePlan,
  listRoutes,
  upsertRoute,
  removeRoute,
  seedSchoolPlansIfEmpty,
  type SubscriptionInput,
  type SchoolSubscription,
} from "./queries/school";
import { pauseRazorpaySubscription, resumeRazorpaySubscription, cancelRazorpaySubscription } from "./queries/schoolBilling";

export type {
  SubscriptionStatus, TripDirection, PaymentStatus, SchoolPlan, Coords, SchoolSubscription,
  SchoolTrip, CalendarEventType, SchoolCalendarEvent, TimingField, TimingChangeRequest, SchoolRoute,
} from "./queries/school";
export { MORNING_STAGES, EVENING_STAGES } from "./queries/school";

// Allows through when guardianUserId is null (legacy rows created before
// this router required auth) — blocks a stranger from touching another
// real user's real (guardianUserId-set) subscription without locking out
// pre-existing demo data.
function assertOwnsSubscription(sub: Pick<SchoolSubscription, "guardianUserId">, userId: number): void {
  if (sub.guardianUserId != null && sub.guardianUserId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this subscription." });
  }
}

async function requireOwnedSubscription(id: string, userId: number): Promise<SchoolSubscription> {
  const existing = await getSubscription(id);
  if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found." });
  assertOwnsSubscription(existing, userId);
  return existing;
}

void seedSchoolPlansIfEmpty();

const coordsSchema = z.object({ lat: z.number(), lng: z.number() });
const statusSchema = z.enum(["pending_review", "reupload_requested", "approved", "rejected", "suspended", "cancelled"]);
const directionSchema = z.enum(["morning", "evening"]);
const timingFieldSchema = z.enum(["morningPickupTime", "schoolReportingTime", "schoolEndTime", "returnPickupTime"]);

const subscriptionInput = z.object({
  guardianPhone: z.string().trim().min(1).max(20),
  guardianName: z.string().trim().min(1).max(80),
  guardianPhotoUrl: z.string().max(2_000_000).optional(),
  guardianEmail: z.string().trim().max(120).default(""),
  emergencyContact: z.string().trim().min(1).max(20),
  studentName: z.string().trim().min(1).max(80),
  studentPhotoUrl: z.string().max(2_000_000).optional(),
  studentIdPhotoUrl: z.string().max(2_000_000).optional(),
  schoolName: z.string().trim().min(1).max(120),
  schoolAddress: z.string().trim().min(1).max(200),
  schoolPhone: z.string().trim().max(20).default(""),
  className: z.string().trim().min(1).max(20),
  section: z.string().trim().max(10).default(""),
  rollNumber: z.string().trim().max(30).default(""),
  homeAddress: z.string().trim().min(1).max(200),
  pickupCoords: coordsSchema,
  dropCoords: coordsSchema,
  morningPickupTime: z.string().trim().min(1),
  schoolReportingTime: z.string().trim().min(1),
  schoolEndTime: z.string().trim().min(1),
  returnPickupTime: z.string().trim().min(1),
  medicalNotes: z.string().trim().max(500).default(""),
  allergies: z.string().trim().max(300).default(""),
  specialInstructions: z.string().trim().max(500).default(""),
  authorizedPickupPersons: z.array(z.string().trim().min(1)).default([]),
  planId: z.string(),
  consentAccepted: z.boolean(),
});

export const schoolRouter = createRouter({
  // ---- Plans -------------------------------------------------------------
  listPlans: publicQuery.query(() => listPlans()),

  upsertPlan: publicQuery
    .input(z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(60), pricePerMonth: z.number().positive(), description: z.string().trim().max(200), active: z.boolean() }))
    .mutation(({ input }) => upsertPlan(input)),

  // ---- Subscriptions -------------------------------------------------------
  createSubscription: authedQuery.input(subscriptionInput).mutation(({ ctx, input }) => createSubscription(input as SubscriptionInput, ctx.user.id)),

  updateSubscription: authedQuery
    .input(z.object({ id: z.string(), updates: subscriptionInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedSubscription(input.id, ctx.user.id);
      return updateSubscription(input.id, input.updates);
    }),

  // Legacy display path — guardianPhone string match, kept only for
  // pre-auth rows. listMyActiveSubscriptions below is the real-identity path.
  listMySubscriptions: publicQuery.input(z.object({ guardianPhone: z.string() })).query(({ input }) => listMySubscriptions(input.guardianPhone)),

  listMyActiveSubscriptions: authedQuery.query(({ ctx }) => listMyActiveSubscriptions(ctx.user.id)),

  getSubscription: publicQuery.input(z.object({ id: z.string() })).query(({ input }) => getSubscription(input.id)),

  listAllSubscriptions: publicQuery
    .input(z.object({ status: statusSchema.optional() }).optional())
    .query(({ input }) => listAllSubscriptions(input?.status)),

  // Admin verification actions: approve / reject / request re-upload / suspend / reactivate.
  verifySubscription: publicQuery
    .input(z.object({ id: z.string(), action: z.enum(["approve", "reject", "reupload", "suspend", "reactivate"]), note: z.string().trim().max(300).optional() }))
    .mutation(({ input }) => verifySubscription(input.id, input.action, input.note, cancelRazorpaySubscription)),

  // ---- Daily driver assignment ---------------------------------------------
  assignDriver: publicQuery
    .input(
      z.object({
        id: z.string(),
        driverId: z.number(),
        driverName: z.string().trim().min(1),
        vehicle: z.string().trim().min(1),
        backup: z.object({ driverId: z.number(), driverName: z.string().trim().min(1), vehicle: z.string().trim().min(1) }).nullable().optional(),
      })
    )
    .mutation(({ input }) => assignDriver(input.id, input.driverId, input.driverName, input.vehicle, input.backup)),

  // Swaps primary <-> backup when the primary becomes unavailable — the
  // conflict check re-runs for the incoming primary (see queries/school.ts).
  activateBackupDriver: adminQuery.input(z.object({ id: z.string() })).mutation(({ input }) => activateBackupDriver(input.id)),

  // Real onboarded + approved drivers only — see queries/school.ts.
  listAvailableDrivers: publicQuery.query(() => listAvailableDrivers()),

  // Every approved student currently assigned to this driver — the roster
  // the Driver App's School Duty Mode is built from.
  listMyAssignedStudents: authedQuery.query(({ ctx }) => listMyAssignedStudents(ctx.user.id)),

  // ---- Live driver location (school context) --------------------------------
  getAssignedDriverLocation: authedQuery
    .input(z.object({ subscriptionId: z.string() }))
    .query(({ input }) => getAssignedDriverLocation(input.subscriptionId)),

  // ---- Trips / timeline -----------------------------------------------------
  getTodayTrip: publicQuery
    .input(z.object({ subscriptionId: z.string(), direction: directionSchema }))
    .query(({ input }) => getOrCreateTodayTrip(input.subscriptionId, input.direction)),

  advanceTripStage: publicQuery.input(z.object({ tripId: z.string() })).mutation(({ input }) => advanceTripStage(input.tripId)),

  listTripHistory: publicQuery
    .input(z.object({ subscriptionId: z.string(), limit: z.number().int().positive().max(200).default(60) }))
    .query(({ input }) => listTripHistory(input.subscriptionId, input.limit)),

  // ---- PIN pickup/drop verification -----------------------------------------
  verifyPin: publicQuery
    .input(z.object({ tripId: z.string(), pin: z.string().trim(), kind: z.enum(["pickup", "drop"]) }))
    .mutation(({ input }) => verifyPin(input.tripId, input.pin, input.kind)),

  // ---- Attendance (derived from trip PIN verification) -----------------------
  listAttendance: publicQuery
    .input(z.object({ subscriptionId: z.string(), limit: z.number().int().positive().max(200).default(60) }))
    .query(({ input }) => listAttendance(input.subscriptionId, input.limit)),

  // ---- Timing change requests ------------------------------------------------
  requestTimingChange: publicQuery
    .input(z.object({ subscriptionId: z.string(), field: timingFieldSchema, requestedValue: z.string().trim().min(1) }))
    .mutation(({ input }) => requestTimingChange(input)),

  listTimingRequests: publicQuery
    .input(z.object({ subscriptionId: z.string().optional(), status: z.enum(["pending", "approved", "rejected"]).optional() }).optional())
    .query(({ input }) => listTimingRequests({ subscriptionId: input?.subscriptionId, status: input?.status })),

  resolveTimingChange: publicQuery
    .input(z.object({ id: z.string(), approve: z.boolean() }))
    .mutation(({ input }) => resolveTimingChange(input.id, input.approve)),

  // ---- School calendar ---------------------------------------------------
  listCalendarEvents: publicQuery.query(() => listCalendarEvents()),

  publishCalendarEvent: publicQuery
    .input(z.object({ date: z.string(), type: z.enum(["holiday", "exam", "half_day", "event", "transport_closed"]), title: z.string().trim().min(1).max(100) }))
    .mutation(({ input }) => publishCalendarEvent(input)),

  removeCalendarEvent: publicQuery.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await removeCalendarEvent(input.id);
    return { ok: true };
  }),

  // ---- Guardian day-off / pause requests -------------------------------------
  // Distinct from pauseSubscription below (pauses the whole plan) — this
  // skips a single date without touching billing or the subscription status.
  requestSkipDay: authedQuery
    .input(z.object({ subscriptionId: z.string(), date: z.string(), reason: z.string().trim().max(300).default("") }))
    .mutation(({ input }) => requestSkipDay(input.subscriptionId, input.date, input.reason)),

  listSkipRequests: publicQuery.input(z.object({ subscriptionId: z.string() })).query(({ input }) => listSkipRequests(input.subscriptionId)),

  listAllSkipRequests: adminQuery
    .input(z.object({ limit: z.number().int().positive().max(200).default(50) }).optional())
    .query(({ input }) => listAllSkipRequests(input?.limit ?? 50)),

  cancelSkipRequest: authedQuery.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await cancelSkipRequest(input.id);
    return { ok: true };
  }),

  // ---- Subscription management (ownership-checked; synced to Razorpay
  // where a real razorpaySubscriptionId exists — see queries/schoolBilling.ts) ----
  pauseSubscription: authedQuery.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await requireOwnedSubscription(input.id, ctx.user.id);
    const sync = await pauseRazorpaySubscription(input.id);
    const subscription = await pauseSubscription(input.id);
    return { ...sync, subscription };
  }),

  resumeSubscription: authedQuery.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await requireOwnedSubscription(input.id, ctx.user.id);
    const sync = await resumeRazorpaySubscription(input.id);
    const subscription = await resumeSubscription(input.id);
    return { ...sync, subscription };
  }),

  cancelSubscription: authedQuery
    .input(z.object({ id: z.string(), cancelAtCycleEnd: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedSubscription(input.id, ctx.user.id);
      const sync = await cancelRazorpaySubscription(input.id, input.cancelAtCycleEnd);
      const subscription = await cancelSubscription(input.id, input.cancelAtCycleEnd);
      return { ...sync, subscription };
    }),

  setAutoRenew: authedQuery
    .input(z.object({ id: z.string(), autoRenew: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedSubscription(input.id, ctx.user.id);
      return setAutoRenew(input.id, input.autoRenew);
    }),

  upgradePlan: authedQuery
    .input(z.object({ id: z.string(), planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedSubscription(input.id, ctx.user.id);
      return upgradePlan(input.id, input.planId);
    }),

  // ---- Routes (real replacement for AdminSchoolTransport.tsx's mock arrays) ----
  listRoutes: adminQuery.query(() => listRoutes()),

  upsertRoute: adminQuery
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(80),
        vehicleLabel: z.string().trim().max(120).default(""),
        stops: z.array(z.string().trim().min(1)).default([]),
        primaryDriverId: z.number().optional(),
        backupDriverId: z.number().optional(),
        monthlyFee: z.number().nonnegative().default(0),
      })
    )
    .mutation(({ input }) => upsertRoute(input)),

  removeRoute: adminQuery.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await removeRoute(input.id);
    return { ok: true };
  }),
});
