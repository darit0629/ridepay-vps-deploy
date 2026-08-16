import { z } from "zod";
import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { env } from "./lib/env";
import { signSessionToken } from "./kimi/session";
import { sendOtp as sendOtpTwilio, checkOtp as checkOtpTwilio, type OtpChannel } from "./lib/twilioVerify";
import { sendOtp as sendOtpTwoFactor, checkOtp as checkOtpTwoFactor } from "./lib/twoFactor";
import { findUserByUnionId, findAdminByEmail, upsertUser } from "./queries/users";
import { verifyPassword } from "./lib/password";

// SMS always uses 2Factor now (see api/lib/twoFactor.ts) — no Twilio
// fallback for SMS by request. WhatsApp still stays on Twilio for now — no
// WhatsApp Business number/template set up anywhere else yet. Verifying
// must route the same way sending did, since each provider only knows
// about the codes it itself issued — see verifyOtp's `channel` input.
function sendOtp(phoneE164: string, channel: OtpChannel): Promise<void> {
  return channel === "sms" ? sendOtpTwoFactor(phoneE164) : sendOtpTwilio(phoneE164, channel);
}
function checkOtp(phoneE164: string, code: string, channel: OtpChannel): Promise<boolean> {
  return channel === "sms" ? checkOtpTwoFactor(phoneE164, code) : checkOtpTwilio(phoneE164, code);
}

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Enter a 10-digit mobile number");
// "admin" deliberately excluded — the phone+OTP flow used to accept
// role: "admin" straight from the client with no server-side check at all,
// meaning anyone who could receive an SMS on any phone number could make
// themselves an admin just by picking the Admin card on the role picker.
// Real admin access is now only ever granted via adminLogin below (a
// pre-provisioned email+password account) — this schema change is what
// actually closes that hole, not just the UI no longer linking to it.
const roleSchema = z.enum(["user", "driver"]);

function toE164(phone: string): string {
  return `+91${phone}`;
}

// Identity key shared with the Kimi-OAuth path's users.unionId column — a
// phone login just uses a differently-shaped union ID ("phone:+91...")
// instead of Kimi's own union ID, so both paths flow through the exact same
// users table, session JWT, and requireAuth/ctx.user machinery.
function unionIdForPhone(phoneE164: string): string {
  return `phone:${phoneE164}`;
}

// Shared by verifyOtp and adminLogin — both issue the exact same kind of
// session (same signSessionToken shape, same cookie), just reached via a
// different credential check beforehand.
function setSessionCookie(ctx: { req: { headers: Headers }; resHeaders: Headers }, token: string) {
  const cookieOpts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: cookieOpts.httpOnly,
      path: cookieOpts.path,
      sameSite: cookieOpts.sameSite?.toLowerCase() as "lax" | "none",
      secure: cookieOpts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  sendOtp: publicQuery
    .input(z.object({ phone: phoneSchema, channel: z.enum(["sms", "whatsapp"]).default("sms") }))
    .mutation(async ({ input }) => {
      try {
        await sendOtp(toE164(input.phone), input.channel as OtpChannel);
        return { success: true };
      } catch (error) {
        const provider = input.channel === "sms" ? "2Factor" : "Twilio";
        console.error(`Error sending OTP via ${provider} (${input.channel}):`, error);
        // Surfaced as-is when it's a real provider config problem (e.g. no
        // WhatsApp sender set up on Twilio) — that's actionable for whoever's
        // testing, unlike a generic message.
        const providerMessage = error instanceof Error ? error.message : undefined;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: providerMessage ? `Couldn't send the OTP: ${providerMessage}` : "Couldn't send the OTP — please try again.",
        });
      }
    }),

  verifyOtp: publicQuery
    .input(z.object({
      phone: phoneSchema,
      code: z.string().trim().length(4, "Enter the 4-digit code"),
      role: roleSchema,
      // Must match whichever channel sendOtp actually used — MSG91 and
      // Twilio each only know about the codes they themselves issued.
      channel: z.enum(["sms", "whatsapp"]).default("sms"),
    }))
    .mutation(async ({ ctx, input }) => {
      const phoneE164 = toE164(input.phone);
      let approved: boolean;
      try {
        approved = await checkOtp(phoneE164, input.code, input.channel as OtpChannel);
      } catch (error) {
        const provider = input.channel === "sms" ? "2Factor" : "Twilio";
        console.error(`Error verifying OTP via ${provider}:`, error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't verify the OTP — please try again." });
      }
      if (!approved) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That code is incorrect or has expired." });
      }

      const unionId = unionIdForPhone(phoneE164);
      const existing = await findUserByUnionId(unionId);
      // Registration is "done" once a name has been saved — a fresh
      // phone-verified user row exists (so ctx.user resolves) but still
      // needs the Register.tsx form before landing on a real dashboard.
      const isNewUser = !existing?.name;

      await upsertUser({
        unionId,
        phone: phoneE164,
        role: input.role,
        isVerified: true,
        ...(existing ? {} : { name: null }),
      });

      const token = await signSessionToken({ unionId, clientId: env.appId || "ridepay" });
      setSessionCookie(ctx, token);

      // Web ignores this extra field and relies on the cookie above; native
      // clients (no cookie jar) persist this token and send it back as
      // `Authorization: Bearer <token>` — see authenticateRequest.
      return { success: true, isNewUser, role: input.role, token };
    }),

  // Real email+password admin login — the only way to actually reach
  // role: "admin" now that verifyOtp can no longer grant it (see roleSchema
  // above). Deliberately returns the exact same generic error whether the
  // email doesn't exist, isn't an admin, or the password is wrong, so this
  // can't be used to enumerate which admin emails exist.
  adminLogin: publicQuery
    .input(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const genericError = new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password." });
      const admin = await findAdminByEmail(input.email);
      if (!admin || !admin.passwordHash) throw genericError;

      const valid = await verifyPassword(input.password, admin.passwordHash);
      if (!valid) throw genericError;

      const token = await signSessionToken({ unionId: admin.unionId, clientId: env.appId || "ridepay" });
      setSessionCookie(ctx, token);

      return { success: true, token };
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
