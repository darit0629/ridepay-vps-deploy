import fs from "node:fs";
import path from "node:path";
import twilio from "twilio";

// Twilio Account SID/Auth Token are read directly from process.env here
// (not via api/lib/env.ts) — same pattern GEMINI_API_KEY uses: a third-party
// integration secret scoped to the one module that needs it.
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";

let client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    throw new Error("Twilio is not configured (missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN).");
  }
  client ??= twilio(ACCOUNT_SID, AUTH_TOKEN);
  return client;
}

// Writes the newly-created Verify Service SID back into .env so it's only
// created once — without this, every server restart would spin up a new
// Twilio Verify Service instead of reusing the same one.
function persistServiceSid(sid: string) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const content = fs.readFileSync(envPath, "utf8");
    const updated = content.includes("TWILIO_VERIFY_SERVICE_SID=")
      ? content.replace(/TWILIO_VERIFY_SERVICE_SID=.*/g, `TWILIO_VERIFY_SERVICE_SID=${sid}`)
      : `${content.trimEnd()}\nTWILIO_VERIFY_SERVICE_SID=${sid}\n`;
    fs.writeFileSync(envPath, updated);
  } catch (error) {
    console.warn("[twilioVerify] Could not persist TWILIO_VERIFY_SERVICE_SID to .env:", error);
  }
}

let verifyServiceSidPromise: Promise<string> | null = null;

async function getVerifyServiceSid(): Promise<string> {
  const existing = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (existing) return existing;

  verifyServiceSidPromise ??= getClient()
    .verify.v2.services.create({ friendlyName: "Ridepay", codeLength: 4 })
    .then((service) => {
      process.env.TWILIO_VERIFY_SERVICE_SID = service.sid;
      persistServiceSid(service.sid);
      return service.sid;
    });
  return verifyServiceSidPromise;
}

export type OtpChannel = "sms" | "whatsapp";

// Sends a real OTP via Twilio Verify (SMS or WhatsApp) — Twilio owns code
// generation, expiry, and rate limiting, so nothing about the code itself
// is stored on this server. WhatsApp delivery requires a WhatsApp sender
// configured on this Twilio account (the Sandbox for testing, or an
// approved WhatsApp Business sender for production) — see api/auth-router.ts.
export async function sendOtp(phoneE164: string, channel: OtpChannel = "sms"): Promise<void> {
  const serviceSid = await getVerifyServiceSid();
  await getClient().verify.v2.services(serviceSid).verifications.create({ to: phoneE164, channel });
}

export async function checkOtp(phoneE164: string, code: string): Promise<boolean> {
  const serviceSid = await getVerifyServiceSid();
  const result = await getClient().verify.v2.services(serviceSid).verificationChecks.create({ to: phoneE164, code });
  return result.status === "approved";
}
