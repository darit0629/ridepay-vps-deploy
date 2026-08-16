import type { Context } from "hono";
import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { razorpayWebhookEvents } from "@db/schema";
import { RAZORPAY_WEBHOOK_SECRET } from "../lib/razorpayClient";
import { handleWebhookEvent, type RazorpayWebhookPayload } from "../queries/schoolBilling";

function timingSafeEqualHex(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(providedHex, "hex");
  } catch {
    return false;
  }
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

// Plain Hono handler, not a tRPC procedure — signature verification needs
// the exact raw request body, which tRPC's JSON body parsing would already
// have consumed/reserialized. Mirrors createOAuthCallbackHandler's pattern
// (api/kimi/auth.ts) for a non-tRPC route registered directly in boot.ts.
//
// No live webhook can actually be registered against this dev box (no
// public URL — see the Dispatch Engine's own infra-fragility notes on the
// cloudflared tunnel), so this is exercised via a synthetic
// HMAC-signed curl payload during development, not a real Razorpay
// delivery. The endpoint itself is fully real and production-ready.
export function createRazorpayWebhookHandler() {
  return async (c: Context) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-razorpay-signature") ?? "";

    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.error("[razorpayWebhook] RAZORPAY_WEBHOOK_SECRET is not configured — rejecting.");
      return c.json({ error: "Webhook not configured" }, 500);
    }

    const expectedSignature = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
    if (!timingSafeEqualHex(expectedSignature, signature)) {
      return c.json({ error: "Invalid signature" }, 400);
    }

    let body: { event?: string; payload?: RazorpayWebhookPayload };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const eventType = body.event ?? "unknown";
    const payload = body.payload ?? {};

    // Idempotency: id = sha256(rawBody). Razorpay retries an identical
    // payload on any non-2xx response, so hashing the raw body IS the
    // dedupe key — no reliance on a Razorpay-supplied event id.
    const id = crypto.createHash("sha256").update(rawBody).digest("hex");
    const db = getDb();
    try {
      await db.insert(razorpayWebhookEvents).values({
        id,
        eventType,
        subscriptionId: payload.subscription?.entity.id,
        payload: rawBody,
      });
    } catch {
      // Duplicate-key failure means this exact payload was already logged —
      // Razorpay retried an already-processed delivery. Ack without
      // reprocessing (reprocessing would otherwise double-record a charge
      // via schoolBilling's insert-only payment events).
      return c.json({ ok: true, duplicate: true }, 200);
    }

    try {
      await handleWebhookEvent(eventType, payload);
      await db.update(razorpayWebhookEvents).set({ processedAt: sql`NOW()` }).where(eq(razorpayWebhookEvents.id, id));
    } catch (error) {
      // Row stays with processedAt=null — visible in the admin billing page
      // for follow-up. Still ack 200: Razorpay retrying would just re-log
      // (and fail to reprocess) the identical already-seen payload.
      console.error("[razorpayWebhook] processing failed:", error);
    }

    return c.json({ ok: true }, 200);
  };
}
