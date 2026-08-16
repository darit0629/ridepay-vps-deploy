import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { scheduledRides, users, type ScheduledRide } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendPushToDrivers } from "./notification-router";

const vehicleTypeSchema = z.enum([
  "e-riksha", "auto-rickshaw", "car", "bike", "e-riksha-woman", "e-riksha-parcel", "bike-parcel", "e-riksha-school",
]);
const segmentSchema = z.enum(["share", "reserve", "auto", "parcel", "school", "women"]);
const frequencySchema = z.enum(["once", "weekly", "monthly"]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM");

const scheduleFieldsSchema = z.object({
  label: z.string().max(60).optional(),
  pickupLat: z.string(),
  pickupLng: z.string(),
  pickupAddress: z.string().min(1),
  dropLat: z.string(),
  dropLng: z.string(),
  dropAddress: z.string().min(1),
  vehicleType: vehicleTypeSchema,
  segment: segmentSchema,
  scheduledTime: timeSchema,
  frequency: frequencySchema,
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  reminderMinutesBefore: z.number().min(1).max(180).optional(),
  // Set by UserRoundTrip.tsx to tag this as a round trip's return leg,
  // matched against the outbound ride's own roundTripGroupId.
  roundTripGroupId: z.string().max(40).optional(),
});

// Combines a "YYYY-MM-DD" date column value with an "HH:MM" time into a
// real Date, in server-local time — same convention the rest of this app
// already uses for day-boundary comparisons (see driver-router.ts's
// getDashboard "today" cutoff).
function combineDateTime(dateStr: string, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

// Cross-field validation create/update share: frequency-specific required
// fields, plus rejecting a "once" schedule whose date+time has already
// passed — root-causes the old UI's missing future-date check.
function validateScheduleFields(input: {
  frequency: "once" | "weekly" | "monthly";
  scheduledDate?: string | null;
  scheduledTime: string;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
}) {
  if (input.frequency === "once") {
    if (!input.scheduledDate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A one-time schedule needs a date." });
    }
    if (combineDateTime(input.scheduledDate, input.scheduledTime).getTime() <= Date.now()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Scheduled time must be in the future." });
    }
  } else if (input.frequency === "weekly") {
    if (!input.daysOfWeek || input.daysOfWeek.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Pick at least one day of the week." });
    }
  } else if (input.frequency === "monthly") {
    if (!input.dayOfMonth) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a day of the month." });
    }
  }
}

// The next real-world timestamp this schedule should fire at, or null if
// it has none left (a "once" schedule whose date has passed).
function computeNextOccurrenceMs(row: ScheduledRide, now: Date): number | null {
  const [h, m] = row.scheduledTime.split(":").map(Number);

  if (row.frequency === "once") {
    if (!row.scheduledDate) return null;
    return combineDateTime(String(row.scheduledDate), row.scheduledTime).getTime();
  }

  if (row.frequency === "weekly") {
    const days = row.daysOfWeek ?? [];
    if (days.length === 0) return null;
    for (let offset = 0; offset < 8; offset++) {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      d.setHours(h, m, 0, 0);
      if (days.includes(d.getDay()) && d.getTime() >= now.getTime() - 5 * 60 * 1000) return d.getTime();
    }
    return null;
  }

  // monthly
  if (!row.dayOfMonth) return null;
  const d = new Date(now.getFullYear(), now.getMonth(), row.dayOfMonth, h, m, 0, 0);
  if (d.getTime() < now.getTime() - 5 * 60 * 1000) d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

// Lazily recomputed on every read — there's no cron in this environment, so
// "expired"/"active" transitions happen the same way the rest of this app
// derives day-boundary/lifecycle state opportunistically rather than via a
// background job.
function deriveStatus(row: ScheduledRide, now: Date): ScheduledRide["status"] {
  if (row.status === "cancelled") return "cancelled";
  if (row.frequency === "once") {
    if (row.linkedRideId) return "completed";
    const target = row.scheduledDate ? combineDateTime(String(row.scheduledDate), row.scheduledTime) : null;
    const graceMs = 60 * 60 * 1000; // 1hr past scheduled time before calling it missed
    if (target && now.getTime() > target.getTime() + graceMs) return "expired";
    return "upcoming";
  }
  // Recurring (weekly/monthly): "active" once it has fired at least once,
  // "upcoming" before its first occurrence. No natural "completed" state
  // without an end-date field, which this table intentionally doesn't have
  // yet — recurring schedules only leave "active" via cancellation.
  return row.lastTriggeredAt ? "active" : "upcoming";
}

async function recomputeAndPersist(row: ScheduledRide): Promise<ScheduledRide> {
  const status = deriveStatus(row, new Date());
  if (status === row.status) return row;
  const db = getDb();
  await db.update(scheduledRides).set({ status }).where(eq(scheduledRides.id, row.id));
  return { ...row, status };
}

export const scheduleRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(scheduledRides)
      .where(eq(scheduledRides.userId, ctx.user.id))
      .orderBy(desc(scheduledRides.createdAt));
    return Promise.all(rows.map(recomputeAndPersist));
  }),

  getById: authedQuery.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = getDb();
    const row = await db.query.scheduledRides.findFirst({ where: eq(scheduledRides.id, input.id) });
    if (!row || row.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found." });
    return recomputeAndPersist(row);
  }),

  create: authedQuery.input(scheduleFieldsSchema).mutation(async ({ ctx, input }) => {
    validateScheduleFields(input);
    const db = getDb();
    const [result] = await db.insert(scheduledRides).values({
      userId: ctx.user.id,
      label: input.label,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      pickupAddress: input.pickupAddress,
      dropLat: input.dropLat,
      dropLng: input.dropLng,
      dropAddress: input.dropAddress,
      vehicleType: input.vehicleType,
      segment: input.segment,
      scheduledTime: input.scheduledTime,
      frequency: input.frequency,
      scheduledDate: input.frequency === "once" ? input.scheduledDate : null,
      daysOfWeek: input.frequency === "weekly" ? input.daysOfWeek : null,
      dayOfMonth: input.frequency === "monthly" ? input.dayOfMonth : null,
      reminderMinutesBefore: input.reminderMinutesBefore ?? 15,
      roundTripGroupId: input.roundTripGroupId,
    }).$returningId();
    const row = await db.query.scheduledRides.findFirst({ where: eq(scheduledRides.id, result.id) });
    return row!;
  }),

  update: authedQuery
    .input(scheduleFieldsSchema.partial().extend({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.query.scheduledRides.findFirst({ where: eq(scheduledRides.id, input.id) });
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found." });
      }
      const { id, ...patch } = input;
      const merged = { ...existing, ...patch };
      validateScheduleFields(merged);
      await db
        .update(scheduledRides)
        .set({
          ...patch,
          scheduledDate: merged.frequency === "once" ? (merged.scheduledDate ?? null) : null,
          daysOfWeek: merged.frequency === "weekly" ? (merged.daysOfWeek ?? null) : null,
          dayOfMonth: merged.frequency === "monthly" ? (merged.dayOfMonth ?? null) : null,
          // Editing a schedule re-arms it — an edited "expired"/"active" one
          // should be reconsidered fresh against the new date/time/recurrence.
          status: "upcoming",
          lastTriggeredAt: null,
        })
        .where(eq(scheduledRides.id, id));
      const row = await db.query.scheduledRides.findFirst({ where: eq(scheduledRides.id, id) });
      return row!;
    }),

  cancel: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const existing = await db.query.scheduledRides.findFirst({ where: eq(scheduledRides.id, input.id) });
    if (!existing || existing.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found." });
    await db.update(scheduledRides).set({ status: "cancelled" }).where(eq(scheduledRides.id, input.id));
    return { success: true };
  }),

  duplicate: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const existing = await db.query.scheduledRides.findFirst({ where: eq(scheduledRides.id, input.id) });
    if (!existing || existing.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found." });
    const [result] = await db.insert(scheduledRides).values({
      userId: ctx.user.id,
      label: existing.label ? `${existing.label} (copy)` : null,
      pickupLat: existing.pickupLat,
      pickupLng: existing.pickupLng,
      pickupAddress: existing.pickupAddress,
      dropLat: existing.dropLat,
      dropLng: existing.dropLng,
      dropAddress: existing.dropAddress,
      vehicleType: existing.vehicleType,
      segment: existing.segment,
      scheduledTime: existing.scheduledTime,
      frequency: existing.frequency,
      scheduledDate: existing.scheduledDate,
      daysOfWeek: existing.daysOfWeek,
      dayOfMonth: existing.dayOfMonth,
      reminderMinutesBefore: existing.reminderMinutesBefore,
    }).$returningId();
    const row = await db.query.scheduledRides.findFirst({ where: eq(scheduledRides.id, result.id) });
    return row!;
  }),

  delete: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const existing = await db.query.scheduledRides.findFirst({ where: eq(scheduledRides.id, input.id) });
    if (!existing || existing.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found." });
    await db.delete(scheduledRides).where(eq(scheduledRides.id, input.id));
    return { success: true };
  }),

  // Polled client-side (NotificationsContext) while the rider's app is open
  // — fires a real push for any of the caller's schedules whose next
  // occurrence has entered its reminder window, deep-linking into a
  // pre-filled booking screen rather than auto-booking (no cron exists here
  // to safely do that unattended, and pricing/driver availability can shift
  // between schedule-time and now).
  checkDue: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(scheduledRides)
      .where(and(eq(scheduledRides.userId, ctx.user.id), eq(scheduledRides.status, "upcoming")));
    const now = new Date();
    let fired = 0;
    for (const row of rows) {
      const nextMs = computeNextOccurrenceMs(row, now);
      if (nextMs === null) continue;
      const withinWindow = nextMs - now.getTime() <= row.reminderMinutesBefore * 60 * 1000 && nextMs - now.getTime() > -60 * 60 * 1000;
      if (!withinWindow) continue;
      const dedupWindowMs = 12 * 60 * 60 * 1000;
      if (row.lastTriggeredAt && now.getTime() - row.lastTriggeredAt.getTime() < dedupWindowMs) continue;

      await sendPushToDrivers([ctx.user.id], {
        title: "Upcoming ride reminder",
        message: `Your scheduled ride to ${row.dropAddress} is coming up at ${row.scheduledTime}. Tap to confirm.`,
        url: `/user/home?scheduleId=${row.id}`,
      });
      // "active" only means something for recurring schedules (deriveStatus
      // ignores it for "once" ones, which stay "upcoming" until booked or
      // expired) — leaving a one-time schedule's status alone here avoids a
      // pointless write that the next recompute would just undo anyway.
      await db
        .update(scheduledRides)
        .set(row.frequency === "once" ? { lastTriggeredAt: now } : { lastTriggeredAt: now, status: "active" })
        .where(eq(scheduledRides.id, row.id));
      fired++;
    }
    return { fired };
  }),

  // Admin operational view — reuses the same recompute so statuses shown
  // match what riders see, no separate/duplicated status logic.
  adminList: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(scheduledRides).orderBy(desc(scheduledRides.createdAt));
    const recomputed = await Promise.all(rows.map(recomputeAndPersist));
    return Promise.all(
      recomputed.map(async (row) => {
        const rider = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
        return { ...row, riderName: rider?.name ?? null, riderPhone: rider?.phone ?? null };
      })
    );
  }),
});
