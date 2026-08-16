import { initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let app: App | null | undefined;

// FIREBASE_SERVICE_ACCOUNT holds the full service-account JSON (from
// Firebase Console → Project Settings → Service Accounts → Generate new
// private key), pasted as a single-line string. Optional — FCM sends are
// skipped gracefully when it isn't set, same fallback pattern the Gemini
// integration uses when GEMINI_API_KEY is absent.
function getFirebaseApp(): App | null {
  if (app !== undefined) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    app = null;
    return app;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    app = initializeApp({ credential: cert(serviceAccount) }, "ridepay-fcm");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin (check FIREBASE_SERVICE_ACCOUNT):", error);
    app = null;
  }
  return app;
}

export async function sendFcmMessage(token: string, title: string, body: string, url?: string): Promise<{ ok: boolean; invalidToken?: boolean }> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return { ok: false };

  try {
    await getMessaging(firebaseApp).send({
      token,
      notification: { title, body },
      android: { notification: { color: "#FF6B00" } },
      // Read by the wrapped native app's own tap handler, if it chooses to
      // deep-link — harmless data field otherwise.
      data: url ? { url } : undefined,
    });
    return { ok: true };
  } catch (error) {
    const code = (error as { errorInfo?: { code?: string }; code?: string })?.errorInfo?.code ?? (error as { code?: string })?.code;
    const invalidToken = code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" || code === "messaging/invalid-argument";
    if (!invalidToken) console.error("FCM send error:", error);
    return { ok: false, invalidToken };
  }
}
