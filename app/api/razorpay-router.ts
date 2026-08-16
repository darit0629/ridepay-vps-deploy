import crypto from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { razorpayOrders } from "@db/schema";
import { getRazorpayClient as getClient, RAZORPAY_KEY_SECRET } from "./lib/razorpayClient";

const MIN_AMOUNT_PAISE = 100;

// Shared by the razorpay router's own createOrder (client-supplied amount,
// used for wallet top-ups) and by other routers that need a Razorpay order
// for a server-computed amount (e.g. ride-router's createPaymentOrder).
// Persisted to a real table (not an in-memory Map) so a server restart
// between order creation and checkout completion doesn't strand an
// otherwise-legitimate payment with an "unknown order" verification failure.
export async function createRazorpayOrderRecord(input: { amount: number; currency: string; receipt: string }) {
  const db = getDb();
  try {
    const order = await getClient().orders.create({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
    });

    await db.insert(razorpayOrders).values({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      receipt: input.receipt,
    });

    return { order_id: order.id, amount: Number(order.amount), currency: order.currency };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 401) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Razorpay rejected the API keys — check RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET." });
    }
    console.error("Error creating Razorpay order:", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create Razorpay order." });
  }
}

export const razorpayRouter = createRouter({
  // STEP 1 — create an order server-side (KEY_SECRET never leaves the
  // server). The frontend only ever sees the returned order_id.
  createOrder: publicQuery
    .input(
      z.object({
        amount: z.number().int().min(MIN_AMOUNT_PAISE, `Amount must be at least ${MIN_AMOUNT_PAISE} paise (₹1).`),
        currency: z.string().trim().min(1).max(10).default("INR"),
        // Razorpay's Orders API caps receipt at 40 characters.
        receipt: z.string().trim().min(1).max(40),
      })
    )
    .mutation(({ input }) => createRazorpayOrderRecord(input)),

  // STEP 3 — verify the checkout callback's signature server-side. Only a
  // match proves the payment actually came from Razorpay and wasn't forged
  // by a tampered client call straight to a "mark as paid" endpoint.
  verifyPayment: publicQuery
    .input(
      z.object({
        razorpay_order_id: z.string().trim().min(1),
        razorpay_payment_id: z.string().trim().min(1),
        razorpay_signature: z.string().trim().min(1),
      })
    )
    .mutation(async ({ input }) => {
      if (!RAZORPAY_KEY_SECRET) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Razorpay is not configured on this server." });
      }

      const db = getDb();
      const order = await db.query.razorpayOrders.findFirst({ where: eq(razorpayOrders.orderId, input.razorpay_order_id) });
      if (!order) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown Razorpay order — it wasn't created by this server." });
      }

      const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
        .digest("hex");

      // Constant-time comparison — a plain === leaks how many leading
      // characters matched via response timing, letting an attacker brute
      // force the signature byte-by-byte.
      const expected = Buffer.from(expectedSignature, "hex");
      const provided = Buffer.from(input.razorpay_signature, "hex");
      const verified = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
      if (!verified) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payment signature verification failed." });
      }

      await db
        .update(razorpayOrders)
        .set({ verifiedPaymentId: input.razorpay_payment_id, verifiedAt: new Date() })
        .where(eq(razorpayOrders.orderId, order.orderId));

      return {
        verified: true as const,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        paymentId: input.razorpay_payment_id,
      };
    }),
});
