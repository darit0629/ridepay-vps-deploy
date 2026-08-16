import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./connection";
import { creditCompanyRevenue } from "./wallets";
import { sendPushToGuardians } from "../notification-router";
import { getRazorpayClient, assertSubscriptionAuthorizationAllowed, RAZORPAY_KEY_SECRET } from "../lib/razorpayClient";
import { schoolSubscriptions, schoolPlans, schoolPaymentEvents, schoolBillingSettings, type SchoolBillingSettings } from "@db/schema";

function genEventId(): string {
  return `spe-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

// Razorpay's current_end/current_start are unix seconds — converted to a
// plain 'YYYY-MM-DD' string (same UTC-slice convention school.ts's
// todayStr() already uses), never passed onward as a JS Date. Only JS Date
// *objects* going into a drizzle query are at risk of the timezone
// mismatch documented in dispatchWorker.ts; a string value isn't.
function unixToDateStr(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

// ---- Billing settings (singleton, same convention as dispatchSettings) ----
const SETTINGS_ROW_ID = 1;
const SETTINGS_DEFAULTS = { gracePeriodDays: 3, totalBillingCycles: 60, nightlyGenerationHour: 20 };

export interface SchoolBillingSettingsView {
  gracePeriodDays: number;
  totalBillingCycles: number;
  nightlyGenerationHour: number;
}

function toSettingsView(row: SchoolBillingSettings): SchoolBillingSettingsView {
  return { gracePeriodDays: row.gracePeriodDays, totalBillingCycles: row.totalBillingCycles, nightlyGenerationHour: row.nightlyGenerationHour };
}

export async function getBillingSettings(): Promise<SchoolBillingSettingsView> {
  const db = getDb();
  await db
    .insert(schoolBillingSettings)
    .values({ id: SETTINGS_ROW_ID, ...SETTINGS_DEFAULTS })
    .onDuplicateKeyUpdate({ set: { id: sql`${schoolBillingSettings.id}` } });
  const row = await db.query.schoolBillingSettings.findFirst({ where: eq(schoolBillingSettings.id, SETTINGS_ROW_ID) });
  return toSettingsView(row!);
}

export async function updateBillingSettings(patch: Partial<SchoolBillingSettingsView>): Promise<SchoolBillingSettingsView> {
  const db = getDb();
  await getBillingSettings();
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) values[key] = value;
  await db.update(schoolBillingSettings).set(values).where(eq(schoolBillingSettings.id, SETTINGS_ROW_ID));
  return getBillingSettings();
}

// ---- Razorpay Plan (one per schoolPlans row, created lazily) --------------
export async function getOrCreateRazorpayPlan(schoolPlanId: string): Promise<string> {
  const db = getDb();
  const plan = await db.query.schoolPlans.findFirst({ where: eq(schoolPlans.id, schoolPlanId) });
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "School plan not found." });
  if (plan.razorpayPlanId) return plan.razorpayPlanId;

  const razorpayPlan = await getRazorpayClient().plans.create({
    item: { name: `RidePay School — ${plan.name}`, amount: Math.round(Number(plan.pricePerMonth) * 100), currency: "INR" },
    period: "monthly",
    interval: 1,
  });
  await db.update(schoolPlans).set({ razorpayPlanId: razorpayPlan.id }).where(eq(schoolPlans.id, schoolPlanId));
  return razorpayPlan.id;
}

// ---- Subscription checkout --------------------------------------------
export async function createSubscriptionCheckout(subscriptionId: string): Promise<{ razorpaySubscriptionId: string }> {
  // The one choke point — see api/lib/razorpayClient.ts. Everything below
  // this line can only run once real rzp_test_/rzp_live_-intentionally-
  // enabled keys are configured.
  assertSubscriptionAuthorizationAllowed();

  const db = getDb();
  const sub = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, subscriptionId) });
  if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found." });
  if (sub.razorpaySubscriptionId) return { razorpaySubscriptionId: sub.razorpaySubscriptionId };

  const settings = await getBillingSettings();
  const razorpayPlanId = await getOrCreateRazorpayPlan(sub.planId);
  const subscription = await getRazorpayClient().subscriptions.create({
    plan_id: razorpayPlanId,
    total_count: settings.totalBillingCycles,
    customer_notify: 1,
    notes: { subscriptionId: sub.id, studentName: sub.studentName, guardianPhone: sub.guardianPhone },
  });

  await db
    .update(schoolSubscriptions)
    .set({ razorpayPlanId, razorpaySubscriptionId: subscription.id, razorpaySubscriptionStatus: subscription.status })
    .where(eq(schoolSubscriptions.id, subscriptionId));

  return { razorpaySubscriptionId: subscription.id };
}

// Optimistic UI confirmation only — never mutates schoolSubscriptions. The
// webhook (handleWebhookEvent below) is the sole writer of billing state,
// since it's the only channel guaranteed to fire even if the client closes
// the tab mid-checkout. This uses Razorpay's subscription-checkout HMAC
// formula (payment_id|subscription_id), distinct from the Orders-flow one
// in razorpay-router.ts (order_id|payment_id).
export function verifySubscriptionCheckoutSignature(input: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }): boolean {
  if (!RAZORPAY_KEY_SECRET) return false;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${input.razorpay_payment_id}|${input.razorpay_subscription_id}`)
    .digest("hex");
  const expected = Buffer.from(expectedSignature, "hex");
  const provided = Buffer.from(input.razorpay_signature, "hex");
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

// ---- Pause / resume / cancel, synced to Razorpay where possible -----------
export interface RazorpaySyncResult {
  ok: true;
  razorpaySynced: boolean;
  warning?: string;
}

export async function pauseRazorpaySubscription(subscriptionId: string): Promise<RazorpaySyncResult> {
  const sub = await getDb().query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, subscriptionId) });
  if (!sub?.razorpaySubscriptionId) return { ok: true, razorpaySynced: false };
  try {
    await getRazorpayClient().subscriptions.pause(sub.razorpaySubscriptionId, { pause_at: "now" });
    return { ok: true, razorpaySynced: true };
  } catch (error) {
    console.error("[schoolBilling] pause failed:", error);
    return { ok: true, razorpaySynced: false, warning: "Razorpay didn't confirm the pause for this payment method — the next billing cycle may still be charged." };
  }
}

export async function resumeRazorpaySubscription(subscriptionId: string): Promise<RazorpaySyncResult> {
  const sub = await getDb().query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, subscriptionId) });
  if (!sub?.razorpaySubscriptionId) return { ok: true, razorpaySynced: false };
  try {
    await getRazorpayClient().subscriptions.resume(sub.razorpaySubscriptionId, { resume_at: "now" });
    return { ok: true, razorpaySynced: true };
  } catch (error) {
    console.error("[schoolBilling] resume failed:", error);
    return { ok: true, razorpaySynced: false, warning: "Razorpay didn't confirm the resume — billing state may be out of sync until the next webhook." };
  }
}

export async function cancelRazorpaySubscription(subscriptionId: string, cancelAtCycleEnd: boolean): Promise<RazorpaySyncResult> {
  const sub = await getDb().query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, subscriptionId) });
  if (!sub?.razorpaySubscriptionId) return { ok: true, razorpaySynced: false };
  try {
    await getRazorpayClient().subscriptions.cancel(sub.razorpaySubscriptionId, cancelAtCycleEnd);
    return { ok: true, razorpaySynced: true };
  } catch (error) {
    console.error("[schoolBilling] cancel failed:", error);
    return { ok: true, razorpaySynced: false, warning: "Razorpay didn't confirm the cancellation — please verify in the admin billing panel." };
  }
}

// ---- Webhook state machine --------------------------------------------
// Shape mirrors Razorpay's documented subscription webhook payload closely
// enough for the fields this app actually reads — not the full official
// type (the razorpay npm package ships REST client types only, no webhook
// payload types).
export interface RazorpayWebhookPayload {
  subscription?: { entity: { id: string; status: string; current_start?: number | null; current_end?: number | null } };
  payment?: { entity: { id: string; amount: number | string; invoice_id?: string | null; error_description?: string | null; created_at?: number } };
}

export async function handleWebhookEvent(eventType: string, payload: RazorpayWebhookPayload): Promise<void> {
  const razorpaySubscriptionId = payload.subscription?.entity.id;
  if (!razorpaySubscriptionId) return;

  const db = getDb();
  const sub = await db.query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.razorpaySubscriptionId, razorpaySubscriptionId) });
  if (!sub) return; // Unknown to this app (e.g. a stray test event) — nothing to sync.

  const settings = await getBillingSettings();
  const currentEnd = payload.subscription?.entity.current_end;
  const guardianIds = sub.guardianUserId ? [sub.guardianUserId] : [];

  switch (eventType) {
    case "subscription.authenticated":
      await db.update(schoolSubscriptions).set({ razorpaySubscriptionStatus: "authenticated" }).where(eq(schoolSubscriptions.id, sub.id));
      break;

    case "subscription.activated":
      await db
        .update(schoolSubscriptions)
        .set({
          razorpaySubscriptionStatus: "active",
          paymentStatus: "paid",
          validTill: currentEnd ? unixToDateStr(currentEnd) : sub.validTill,
          paymentFailedAt: null,
          graceEndsAt: null,
          suspendedReason: null,
        })
        .where(eq(schoolSubscriptions.id, sub.id));
      await sendPushToGuardians(guardianIds, {
        title: "School Ride activated",
        message: `${sub.studentName}'s School Ride subscription is now active.`,
      });
      break;

    case "subscription.charged": {
      const amount = payload.payment?.entity.amount != null ? Number(payload.payment.entity.amount) / 100 : 0;
      await db.insert(schoolPaymentEvents).values({
        id: genEventId(),
        subscriptionId: sub.id,
        razorpayPaymentId: payload.payment?.entity.id,
        razorpayInvoiceId: payload.payment?.entity.invoice_id ?? undefined,
        amount: String(amount),
        status: "captured",
        occurredAt: payload.payment?.entity.created_at ?? Math.floor(Date.now() / 1000),
      });
      await db
        .update(schoolSubscriptions)
        .set({
          razorpaySubscriptionStatus: "active",
          paymentStatus: "paid",
          validTill: currentEnd ? unixToDateStr(currentEnd) : sub.validTill,
          paymentFailedAt: null,
          graceEndsAt: null,
          suspendedReason: null,
        })
        .where(eq(schoolSubscriptions.id, sub.id));
      await creditCompanyRevenue(amount, `School subscription — ${sub.studentName} (Razorpay charge)`, sub.id);
      await sendPushToGuardians(guardianIds, { title: "Payment received", message: `Your School Ride payment of ₹${amount} was successful.` });
      break;
    }

    case "subscription.pending":
      // COALESCE keeps the first failure timestamp across repeated `pending`
      // retries — computed entirely in MySQL, never a JS Date round-tripped
      // through a query (see the note in dispatchWorker.ts).
      await db
        .update(schoolSubscriptions)
        .set({
          razorpaySubscriptionStatus: "pending",
          paymentStatus: "overdue",
          paymentFailedAt: sql`COALESCE(${schoolSubscriptions.paymentFailedAt}, NOW())`,
          graceEndsAt: sql`CURDATE() + INTERVAL ${settings.gracePeriodDays} DAY`,
        })
        .where(eq(schoolSubscriptions.id, sub.id));
      await sendPushToGuardians(guardianIds, {
        title: "School Ride payment failed",
        message: `We couldn't process your payment. Update your payment method within ${settings.gracePeriodDays} days to avoid interruption.`,
      });
      break;

    case "subscription.halted":
      // No extra action here — the nightly worker's grace-period sweep owns
      // the actual suspend decision uniformly for both pending and halted,
      // so it isn't split across two code paths.
      await db.update(schoolSubscriptions).set({ razorpaySubscriptionStatus: "halted", paymentStatus: "overdue" }).where(eq(schoolSubscriptions.id, sub.id));
      break;

    case "subscription.cancelled":
      await db
        .update(schoolSubscriptions)
        .set({ razorpaySubscriptionStatus: "cancelled", status: "cancelled", autoRenew: false })
        .where(eq(schoolSubscriptions.id, sub.id));
      await sendPushToGuardians(guardianIds, { title: "School Ride cancelled", message: "Your School Ride subscription has been cancelled." });
      break;

    case "subscription.completed":
      await db.update(schoolSubscriptions).set({ razorpaySubscriptionStatus: "completed", status: "cancelled" }).where(eq(schoolSubscriptions.id, sub.id));
      await sendPushToGuardians(guardianIds, {
        title: "School Ride subscription completed",
        message: `${sub.studentName}'s School Ride billing cycles have run their course. Renew from the School dashboard to continue.`,
      });
      break;

    case "payment.failed": {
      await db.insert(schoolPaymentEvents).values({
        id: genEventId(),
        subscriptionId: sub.id,
        razorpayPaymentId: payload.payment?.entity.id,
        amount: payload.payment?.entity.amount != null ? String(Number(payload.payment.entity.amount) / 100) : "0",
        status: "failed",
        failureReason: payload.payment?.entity.error_description ?? undefined,
        occurredAt: Math.floor(Date.now() / 1000),
      });
      break;
    }

    // Redundant with subscription.charged for subscription-linked payments
    // (Razorpay fires both for the same charge) — subscription.charged
    // already records the invoice above, so this stays a no-op to avoid a
    // duplicate schoolPaymentEvents row for one real charge.
    case "payment.captured":
      break;

    default:
      break;
  }
}

// ---- Admin: failed payments across every subscription ---------------------
export async function listFailedPayments(limit = 100) {
  const rows = await getDb()
    .select({
      id: schoolPaymentEvents.id,
      subscriptionId: schoolPaymentEvents.subscriptionId,
      amount: schoolPaymentEvents.amount,
      failureReason: schoolPaymentEvents.failureReason,
      createdAt: schoolPaymentEvents.createdAt,
      studentName: schoolSubscriptions.studentName,
      guardianPhone: schoolSubscriptions.guardianPhone,
    })
    .from(schoolPaymentEvents)
    .leftJoin(schoolSubscriptions, eq(schoolPaymentEvents.subscriptionId, schoolSubscriptions.id))
    .where(eq(schoolPaymentEvents.status, "failed"))
    .orderBy(sql`${schoolPaymentEvents.createdAt} DESC`)
    .limit(limit);
  return rows.map((r) => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.getTime() }));
}

// ---- Invoices (real ledger — replaces school.ts's walletTransactions scan) ----
export async function listInvoices(subscriptionId: string) {
  const rows = await getDb()
    .select()
    .from(schoolPaymentEvents)
    .where(eq(schoolPaymentEvents.subscriptionId, subscriptionId))
    .orderBy(sql`${schoolPaymentEvents.createdAt} DESC`);
  return rows.map((r) => ({
    id: r.id,
    razorpayPaymentId: r.razorpayPaymentId ?? undefined,
    razorpayInvoiceId: r.razorpayInvoiceId ?? undefined,
    amount: Number(r.amount),
    status: r.status,
    failureReason: r.failureReason ?? undefined,
    occurredAt: r.occurredAt ?? undefined,
    createdAt: r.createdAt.getTime(),
  }));
}

// ---- Ops/debug aid: since real webhook delivery can't reach this dev box
// (no public URL), this re-derives state directly from Razorpay's own
// fetch(), replaying it through the same state machine as a real webhook —
// keeps exactly one source of truth for "what does this status mean."
export async function resyncSubscriptionFromRazorpay(subscriptionId: string): Promise<{ ok: true; razorpayStatus: string } | { ok: false; error: string }> {
  const sub = await getDb().query.schoolSubscriptions.findFirst({ where: eq(schoolSubscriptions.id, subscriptionId) });
  if (!sub?.razorpaySubscriptionId) return { ok: false, error: "This subscription has no Razorpay subscription yet." };

  const razorpaySub = await getRazorpayClient().subscriptions.fetch(sub.razorpaySubscriptionId);
  const statusToEvent: Record<string, string> = {
    authenticated: "subscription.authenticated",
    active: "subscription.activated",
    pending: "subscription.pending",
    halted: "subscription.halted",
    cancelled: "subscription.cancelled",
    completed: "subscription.completed",
  };
  const eventType = statusToEvent[razorpaySub.status];
  if (eventType) {
    await handleWebhookEvent(eventType, {
      subscription: { entity: { id: razorpaySub.id, status: razorpaySub.status, current_start: razorpaySub.current_start, current_end: razorpaySub.current_end } },
    });
  }
  return { ok: true, razorpayStatus: razorpaySub.status };
}
