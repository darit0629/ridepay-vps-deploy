import Razorpay from "razorpay";
import { TRPCError } from "@trpc/server";

// Keys are read directly from process.env here (not via api/lib/env.ts) —
// same pattern GEMINI_API_KEY uses in ai-router.ts: a third-party
// integration secret scoped to the routers that need it, rather than a core
// piece of app infra every request depends on.
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

let client: Razorpay | null = null;
export function getRazorpayClient(): Razorpay {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Razorpay is not configured on this server (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)." });
  }
  client ??= new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return client;
}

// This .env's keys are LIVE — a completed checkout charges a real card. That
// is fine for the existing one-time Orders flow (a rider explicitly pays for
// a ride and sees exactly what they're charged), but subscription
// authorization opens a recurring mandate a real payment method can approve
// with no further confirmation for months — too easy to trigger by accident
// while developing/testing this feature. Until real rzp_test_ keys are
// configured, this is the one choke point that keeps that call structurally
// impossible: nothing downstream can ever acquire a real
// razorpaySubscriptionId while this throws, so no other guard is needed.
export const isLiveRazorpayKey = RAZORPAY_KEY_ID.startsWith("rzp_live_");

export function assertSubscriptionAuthorizationAllowed(): void {
  if (isLiveRazorpayKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Real subscription billing is disabled in this environment — only LIVE Razorpay keys are configured. Set RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET to rzp_test_ keys to enable subscription creation.",
    });
  }
}
