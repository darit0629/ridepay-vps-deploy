// 2Factor.in SMS OTP — the SMS OTP provider for this app (WhatsApp stays on
// Twilio for now — see api/lib/twilioVerify.ts). Verified working
// end-to-end against a real phone during setup.
//
// The code is generated *here*, not by 2Factor's AUTOGEN — AUTOGEN picks
// its own 6-digit code, but this app's OTP screen (Login.tsx) is a 4-box
// UI matching Twilio Verify's codeLength:4 convention. Generating our own
// 4-digit code and sending it through 2Factor's custom-OTP endpoint (with
// our approved "RidePay OTP Login" template, DLT Sender ID RIDEPY) keeps
// the code length consistent regardless of which provider is behind the
// "sms" channel. Since we own the code value, verifying it is a plain
// in-memory comparison — no round trip to 2Factor's own VERIFY endpoint
// needed.
const API_KEY = process.env.TWOFACTOR_API_KEY ?? "";
const TEMPLATE_NAME = "RidePay OTP Login";
const OTP_TTL_MS = 5 * 60 * 1000;

export function isConfigured(): boolean {
  return !!API_KEY;
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new Error("2Factor is not configured (missing TWOFACTOR_API_KEY).");
  }
}

// 2Factor wants the mobile number without a leading "+" (e.g.
// "916294011684"), while the rest of this app works in E.164
// ("+916294011684") — see toE164 in api/auth-router.ts.
function toTwoFactorMobile(phoneE164: string): string {
  return phoneE164.replace(/^\+/, "");
}

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

interface TwoFactorResponse {
  Status: "Success" | "Error";
  Details: string;
}

// Kept in-memory (not the DB) — an OTP is only ever needed for the few
// minutes between send and verify; a server restart mid-flow just means
// the rider re-requests a code, same as if the code itself had expired.
const otpByPhone = new Map<string, { code: string; expiresAt: number }>();

export async function sendOtp(phoneE164: string): Promise<void> {
  assertConfigured();
  const mobile = toTwoFactorMobile(phoneE164);
  const code = generateOtp();
  const resp = await fetch(
    `https://2factor.in/API/V1/${API_KEY}/SMS/${mobile}/${code}/${encodeURIComponent(TEMPLATE_NAME)}`
  );
  const data = (await resp.json()) as TwoFactorResponse;
  if (data.Status !== "Success") {
    throw new Error(data.Details || "2Factor failed to send the OTP.");
  }
  otpByPhone.set(phoneE164, { code, expiresAt: Date.now() + OTP_TTL_MS });
}

export async function checkOtp(phoneE164: string, code: string): Promise<boolean> {
  assertConfigured();
  const entry = otpByPhone.get(phoneE164);
  if (!entry || Date.now() > entry.expiresAt) return false;
  const matched = entry.code === code;
  if (matched) otpByPhone.delete(phoneE164);
  return matched;
}
