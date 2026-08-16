import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { schoolSubscriptions, schoolCalendarEvents, schoolSkipRequests } from "@db/schema";
import { getOrCreateTripForDate } from "../queries/school";
import { getBillingSettings, type SchoolBillingSettingsView } from "../queries/schoolBilling";
import { sendPushToGuardians, sendPushToDrivers } from "../notification-router";

const TICK_MS = 15 * 60 * 1000;

// Same globalThis singleton-guard pattern as api/lib/dispatchWorker.ts —
// Vite's dev-server SSR module runner can re-evaluate this file's module
// graph independently of the actual Node process lifetime, and a plain
// module-level `let` would reset on that, risking a second live
// setInterval stacked on top of the first with no way to clear it.
let ticking = false;
const g = globalThis as typeof globalThis & { __schoolNightlyWorkerStarted?: boolean };

export function startSchoolNightlyWorker(): void {
  if (g.__schoolNightlyWorkerStarted) return;
  g.__schoolNightlyWorkerStarted = true;
  setInterval(() => {
    void tick();
  }, TICK_MS);
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const settings = await getBillingSettings();
    await generateTomorrowTrips(settings);
    await sweepGracePeriod();
  } catch (error) {
    console.error("[schoolNightlyWorker] tick failed:", error);
  } finally {
    ticking = false;
  }
}

// 'YYYY-MM-DD' string for a value, not a query filter — same convention
// school.ts's todayStr()/addMonths() already use. Only JS Date *objects*
// passed into a query as comparison/insert parameters are at risk of the
// timezone mismatch documented in dispatchWorker.ts; a derived string isn't.
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Pre-generates tomorrow's schoolTrips rows (instead of waiting for the
// lazy on-read path) and fires the "tomorrow's ride" reminder — this must
// run server-side since neither the parent's nor the driver's app can be
// relied on to be open. Gated to settings.nightlyGenerationHour via a
// MySQL-native HOUR(NOW()) comparison (not a JS Date check), self-healing
// on any later tick if a restart missed the exact window.
async function generateTomorrowTrips(settings: SchoolBillingSettingsView): Promise<void> {
  const db = getDb();
  const tomorrow = tomorrowStr();

  const closure = await db.query.schoolCalendarEvents.findFirst({
    where: and(eq(schoolCalendarEvents.date, tomorrow), or(eq(schoolCalendarEvents.type, "holiday"), eq(schoolCalendarEvents.type, "transport_closed"))),
  });
  if (closure) return; // Transport-wide day off — nothing to generate.

  const eligible = await db
    .select()
    .from(schoolSubscriptions)
    .where(and(eq(schoolSubscriptions.status, "approved"), eq(schoolSubscriptions.paymentStatus, "paid"), sql`HOUR(NOW()) >= ${settings.nightlyGenerationHour}`));

  for (const sub of eligible) {
    const skip = await db.query.schoolSkipRequests.findFirst({
      where: and(eq(schoolSkipRequests.subscriptionId, sub.id), eq(schoolSkipRequests.date, tomorrow)),
    });
    if (skip) continue;

    // Idempotent via getOrCreateTripForDate's own existing-row check — safe
    // to re-run every 15 minutes; `created` only flips true on the tick
    // that actually inserts the row, so the reminder fires exactly once.
    const { created: morningCreated } = await getOrCreateTripForDate(sub.id, tomorrow, "morning");
    const { created: eveningCreated } = await getOrCreateTripForDate(sub.id, tomorrow, "evening");
    if (!morningCreated && !eveningCreated) continue;

    if (sub.guardianUserId) {
      await sendPushToGuardians([sub.guardianUserId], {
        title: "Tomorrow's School Ride",
        message: `Pickup at ${sub.morningPickupTime} for ${sub.studentName} is scheduled for tomorrow.`,
      });
    }
    if (sub.assignedDriverId) {
      await sendPushToDrivers([sub.assignedDriverId], {
        title: "Tomorrow's school pickups",
        message: `You have a school run tomorrow for ${sub.studentName} at ${sub.morningPickupTime}.`,
      });
    }
  }
}

// Owns the actual suspend decision for both subscription.pending and
// subscription.halted webhook outcomes (see schoolBilling.ts's
// handleWebhookEvent) — kept as one place rather than split across the
// webhook handler and this worker.
async function sweepGracePeriod(): Promise<void> {
  const db = getDb();
  const affected = await db
    .select({ id: schoolSubscriptions.id, guardianUserId: schoolSubscriptions.guardianUserId })
    .from(schoolSubscriptions)
    .where(
      and(
        eq(schoolSubscriptions.status, "approved"),
        eq(schoolSubscriptions.paymentStatus, "overdue"),
        sql`${schoolSubscriptions.graceEndsAt} IS NOT NULL AND ${schoolSubscriptions.graceEndsAt} < CURDATE()`
      )
    );

  for (const sub of affected) {
    await db.update(schoolSubscriptions).set({ status: "suspended", suspendedReason: "nonpayment" }).where(eq(schoolSubscriptions.id, sub.id));
    if (sub.guardianUserId) {
      await sendPushToGuardians([sub.guardianUserId], {
        title: "School Ride suspended",
        message: "Your subscription was suspended after a failed payment. Update your payment method to resume service.",
      });
    }
  }
}
