import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";

const GEMINI_MODEL = "gemini-2.0-flash";

const SUPPORT_SYSTEM_PROMPT = `You are Wingman, the AI assistant for Ridepay, an auto-rickshaw ride-hailing app serving small towns in West Bengal, India. You help riders with: booking rides, cancellations, refunds, fare questions, lost items, driver complaints, and general app help. Keep replies short (2-4 sentences), friendly, and specific to ride-hailing.

Language: Riders may write in English, Hindi, or Bengali, in either native script or Latin transliteration (Hinglish/Banglish), and may mix languages. Detect the language of each incoming message and always reply in that same language/script. Never insist on a different language.

Booking rides: If the user asks to book a ride, get a cab/auto, or go somewhere (e.g. "book a ride to City Hospital", "मुझे रेलवे स्टेशन जाना है", "আমাকে বাজারে যেতে হবে"), respond with a short friendly confirmation in the user's language, then on its own final line output exactly: BOOK_RIDE: <destination name>. Use the destination name as the user said it (transliterate to a normal place-name spelling if needed, but do not translate it into English). Only include this line when the user is clearly requesting a ride to a specific place; omit it entirely otherwise.

If a request is a genuine emergency or safety issue, tell the user to use the in-app SOS button or call the emergency helpline at 100 immediately. If you don't know something specific to this user's account (like their exact ride status), say you'll escalate to a human agent rather than making it up.`;

const INSIGHTS_SYSTEM_PROMPT = `You are an operations analyst AI for Flying Ride, an auto-rickshaw ride-hailing platform in West Bengal, India. Given a snapshot of today's platform stats, generate 4-6 short, specific, actionable insight bullets an admin would find useful (demand trends, driver performance issues, revenue forecasts, anomalies worth investigating). Each insight must have a "type" of "positive", "warning", or "critical", and a "text" under 20 words. Respond ONLY with a JSON array like: [{"type":"positive","text":"..."}]. No markdown, no extra commentary.`;

const FALLBACK_INSIGHTS = [
  { type: "positive", text: "Ride demand increased by 34% in Ranaghat today compared to last week." },
  { type: "warning", text: "Driver cancellations are unusually high in Kalyani - worth investigating." },
  { type: "positive", text: "Evening demand is growing steadily around Sealdah Station." },
  { type: "positive", text: "Five-star ratings improved by 18% across the platform this week." },
  { type: "positive", text: "Estimated revenue tomorrow: ~2.4 lakh based on booking trends." },
  { type: "critical", text: "Unusual cancellation pattern detected for one driver - flagged for review." },
] as const;

const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
});

const REPORT_SYSTEM_PROMPT = `You are a financial reporting analyst AI for Flying Ride, an auto-rickshaw ride-hailing platform in West Bengal, India. Given a report title and a data snapshot, write a concise 3-5 sentence narrative summary highlighting key figures, trends, and one actionable recommendation. Plain prose, no markdown headers, no bullet points.`;

// Deliberately blind to the guardian-typed student ID — never include it in
// this prompt. Matching happens afterward, in code (see verifyStudentId
// below); if the expected value leaked into the prompt the model could
// "confirm" it instead of genuinely reading the document, defeating the
// whole point of the check.
const STUDENT_ID_EXTRACTION_SYSTEM_PROMPT = `You are a document-reading assistant for Ridepay's Student Pass feature, used by students in West Bengal, India to get discounted auto-rickshaw fares. You will be shown an image or PDF of a student/college ID card or admission document.

Find the student ID number / roll number / registration number / enrollment number printed or handwritten on the document. Read it exactly as printed — preserve every digit, letter, and dash — do not reformat, translate, or guess missing characters.

Respond ONLY with strict JSON, no markdown, no commentary, in exactly this shape:
{"found": boolean, "idNumber": string or null}

Set "found" to true and fill "idNumber" only if you can clearly read an ID/roll/registration number on the document. Set "found" to false and "idNumber" to null if the document has no legible ID number, is blurry/unreadable, or is not a student ID document at all.`;

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

async function callGeminiParts(systemPrompt: string, parts: GeminiPart[], jsonMode = false): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            maxOutputTokens: 500,
            ...(jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return null;
  }
}

async function callGemini(systemPrompt: string, userPrompt: string, jsonMode = false): Promise<string | null> {
  return callGeminiParts(systemPrompt, [{ text: userPrompt }], jsonMode);
}

// Case/whitespace/punctuation-insensitive so "RC-2024-118" and "rc2024118"
// count as the same ID, without opening the door to genuinely wrong numbers
// passing — this is an exact match after normalization, not fuzzy matching.
function normalizeStudentId(value: string): string {
  return value.trim().toUpperCase().replace(/[\s\-_.]/g, "");
}

const ID_FILE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

const verifyStudentIdInput = z.object({
  studentId: z.string().trim().min(2).max(60),
  institution: z.string().trim().min(2).max(120),
  mimeType: z.enum(ID_FILE_MIME_TYPES),
  // ~8MB raw file -> ~11MB base64, well under boot.ts's global 50MB bodyLimit.
  fileDataUrl: z.string().min(50).max(12_000_000),
});

const extractionResultSchema = z.object({ found: z.boolean(), idNumber: z.string().nullable() });

type VerifyStudentIdResult =
  | { outcome: "verified"; extractedId: string }
  | { outcome: "mismatch"; extractedId: string }
  | { outcome: "extraction_failed" }
  | { outcome: "error"; reason: string };

export const aiRouter = createRouter({
  chat: publicQuery
    .input(
      z.object({
        message: z.string().min(1).max(1000),
        history: z.array(chatMessageSchema).max(20).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          reply: "AI support isn't configured yet. Please email online@saypx.in or call +91 62940 11684 for help.",
        };
      }

      const historyText = input.history.map((h) => `${h.role}: ${h.text}`).join("\n");
      const prompt = historyText ? `${historyText}\nuser: ${input.message}` : input.message;
      const reply = await callGemini(SUPPORT_SYSTEM_PROMPT, prompt);

      return {
        reply: reply || "Sorry, I'm having trouble connecting right now. Please try again in a moment, or reach RidePay Support at online@saypx.in / +91 62940 11684.",
      };
    }),

  insights: publicQuery
    .input(
      z.object({
        statsSnapshot: z.string(),
      })
    )
    .query(async ({ input }) => {
      const raw = await callGemini(INSIGHTS_SYSTEM_PROMPT, input.statsSnapshot, true);
      if (!raw) return { insights: FALLBACK_INSIGHTS, source: "fallback" as const };

      try {
        const parsed = JSON.parse(raw);
        const validated = z
          .array(z.object({ type: z.enum(["positive", "warning", "critical"]), text: z.string() }))
          .min(1)
          .parse(parsed);
        return { insights: validated, source: "ai" as const };
      } catch (error) {
        console.error("Failed to parse AI insights:", error, raw);
        return { insights: FALLBACK_INSIGHTS, source: "fallback" as const };
      }
    }),

  report: publicQuery
    .input(
      z.object({
        title: z.string(),
        dataSnapshot: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const summary = await callGemini(REPORT_SYSTEM_PROMPT, `Report: ${input.title}\nData: ${input.dataSnapshot}`);
      return {
        summary:
          summary ||
          `This is an automated summary of the ${input.title}. Review the attached figures for a full breakdown; AI narrative generation is temporarily unavailable.`,
      };
    }),

  // Real OCR-style verification for UserStudentPass.tsx — replaces what was
  // previously a fake `setTimeout`-simulated "verification" with zero
  // backend involvement. authedQuery (not publicQuery, unlike chat/insights/
  // report above) — this is the first AI endpoint tied to a specific user's
  // paid-discount eligibility rather than a general chat/insights feature,
  // and it calls a costed third-party API, so it shouldn't be callable
  // anonymously.
  verifyStudentId: authedQuery.input(verifyStudentIdInput).mutation(async ({ input }): Promise<VerifyStudentIdResult> => {
    try {
      const prefix = `data:${input.mimeType};base64,`;
      if (!input.fileDataUrl.startsWith(prefix)) {
        return { outcome: "error", reason: "That file looks corrupted. Please upload it again." };
      }
      const base64Data = input.fileDataUrl.slice(prefix.length);
      if (base64Data.length < 100) {
        return { outcome: "error", reason: "That file looks empty or corrupted. Please upload it again." };
      }
      if (!process.env.GEMINI_API_KEY) {
        return { outcome: "error", reason: "ID verification isn't available right now. Please try again shortly." };
      }

      const raw = await callGeminiParts(
        STUDENT_ID_EXTRACTION_SYSTEM_PROMPT,
        [
          { text: `The document should be a student/college ID from an institution called "${input.institution}" in West Bengal, India. Read the student ID number on it.` },
          { inlineData: { mimeType: input.mimeType, data: base64Data } },
        ],
        true
      );
      if (!raw) return { outcome: "error", reason: "We couldn't read your document right now. Please try again." };

      let parsed: { found: boolean; idNumber: string | null };
      try {
        parsed = extractionResultSchema.parse(JSON.parse(raw));
      } catch (error) {
        console.error("Failed to parse student-ID extraction result:", error, raw);
        return { outcome: "error", reason: "We couldn't read your document right now. Please try again." };
      }

      if (!parsed.found || !parsed.idNumber) return { outcome: "extraction_failed" };

      const matched = normalizeStudentId(parsed.idNumber) === normalizeStudentId(input.studentId);
      return matched ? { outcome: "verified", extractedId: parsed.idNumber } : { outcome: "mismatch", extractedId: parsed.idNumber };
    } catch (error) {
      console.error("verifyStudentId failed:", error);
      return { outcome: "error", reason: "Something went wrong verifying your ID. Please try again." };
    }
  }),
});
