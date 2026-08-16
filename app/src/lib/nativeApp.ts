// Bridge to the wrapped native Android app ("RidepayApp").
//
// The app identifies itself two ways: its WebView User Agent contains
// "RidepayApp", and it injects window.NativeBridge. Newer app builds also
// auto-deliver the device's FCM token by calling window.onFcmTokenReceived()
// on every page load — without the website having to ask — so the handler
// must exist before that call fires. index.html installs a tiny buffering
// stub before the bundle loads, and this module (imported first in main.tsx)
// replaces it and drains anything the stub caught.

declare global {
  interface Window {
    NativeBridge?: { getFcmToken?: () => void };
    onFcmTokenReceived?: (token: string) => void;
    // Set by the index.html stub if the app delivered the token before the
    // JS bundle finished loading.
    __earlyFcmToken?: string;
  }
}

const FCM_TOKEN_KEY = "ridepay_fcm_token";

type TokenListener = (token: string) => void;

let latestToken: string | null = null;
const listeners = new Set<TokenListener>();

/** True when running inside the wrapped native Android app — in that case
 *  browser notifications must stay off and push goes through FCM instead,
 *  so notifications show with the Ridepay icon rather than Chrome's. */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.userAgent.includes("RidepayApp") || !!window.NativeBridge;
}

/** Latest FCM token the app has handed over, if any (falls back to the one
 *  persisted from a previous launch). */
export function getFcmToken(): string | null {
  if (latestToken) return latestToken;
  try {
    return window.localStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Subscribe to future token deliveries. Returns an unsubscribe function. */
export function onFcmToken(listener: TokenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function receiveToken(token: string) {
  if (!token) return;
  latestToken = token;
  try {
    window.localStorage.setItem(FCM_TOKEN_KEY, token);
  } catch {
    // Non-fatal — the token just won't survive a reload until redelivered.
  }
  listeners.forEach((listener) => listener(token));
}

// Installed at module-import time (before React mounts) and never removed —
// the app may call this at any point in the page's lifetime.
if (typeof window !== "undefined") {
  window.onFcmTokenReceived = receiveToken;
  if (window.__earlyFcmToken) {
    receiveToken(window.__earlyFcmToken);
    delete window.__earlyFcmToken;
  }
}
