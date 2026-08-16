// Loads Razorpay's Standard Checkout script on demand and opens the payment
// modal — same "cached promise, load once" pattern googleMaps.ts uses for
// its script tag. Only the publishable Key ID ever reaches this file (via
// VITE_RAZORPAY_KEY_ID); the Key Secret stays server-side in
// api/razorpay-router.ts and is never sent to the browser.
export interface RazorpayCheckoutResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpaySubscriptionCheckoutResult {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayInstanceOptions {
  key: string;
  // One-time Orders checkout needs amount/currency/order_id; recurring
  // Subscriptions checkout needs subscription_id instead — the plan already
  // defines the amount, so amount/currency are omitted for that flow.
  amount?: number;
  currency?: string;
  order_id?: string;
  subscription_id?: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayCheckoutResult | RazorpaySubscriptionCheckoutResult) => void;
  modal?: { ondismiss?: () => void };
  // Tells Razorpay's checkout this is running inside a WebView (the native
  // app wrapper) — without it, checkout.js detects the WebView's own
  // User-Agent marker and hides UPI as a security precaution, since a
  // misconfigured WebView can't always redirect back from a UPI app.
  webview_intent?: boolean;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayInstanceOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
// Razorpay's checkout iframe fetches this directly from its own servers, so
// it must be a real internet-reachable URL — never window.location.origin,
// which would be localhost during local dev. Uses the same domain already
// approved in the Razorpay dashboard's Website/App settings.
const CHECKOUT_LOGO_URL = "https://ridepay.saypx.in/assets/logo.png";
const BRAND_COLOR = "#FF6B00";

let loadPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loadPromise = null;
        reject(new Error("Failed to load the Razorpay checkout script"));
      };
      document.body.appendChild(script);
    });
  }
  return loadPromise;
}

export interface OpenRazorpayCheckoutParams {
  orderId: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (result: RazorpayCheckoutResult) => void;
  /** User closed the modal without paying — not an error. */
  onDismiss?: () => void;
  onFailure?: (message: string) => void;
}

export async function openRazorpayCheckout(params: OpenRazorpayCheckoutParams): Promise<void> {
  if (!RAZORPAY_KEY_ID) {
    params.onFailure?.("Razorpay is not configured (missing VITE_RAZORPAY_KEY_ID).");
    return;
  }

  try {
    await loadRazorpayScript();
  } catch {
    params.onFailure?.("Couldn't load the Razorpay checkout script — check your connection.");
    return;
  }
  if (!window.Razorpay) {
    params.onFailure?.("Razorpay checkout script failed to load.");
    return;
  }

  const instance = new window.Razorpay({
    key: RAZORPAY_KEY_ID,
    amount: params.amount,
    currency: params.currency,
    order_id: params.orderId,
    name: params.name,
    description: params.description,
    image: CHECKOUT_LOGO_URL,
    prefill: params.prefill,
    theme: { color: BRAND_COLOR },
    webview_intent: true,
    handler: (response) => params.onSuccess(response as RazorpayCheckoutResult),
    modal: { ondismiss: () => params.onDismiss?.() },
  });

  instance.on("payment.failed", (response) => {
    params.onFailure?.(response.error?.description || "Payment failed.");
  });

  instance.open();
}

export interface OpenRazorpaySubscriptionCheckoutParams {
  subscriptionId: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (result: RazorpaySubscriptionCheckoutResult) => void;
  /** User closed the modal without authorizing — not an error. */
  onDismiss?: () => void;
  onFailure?: (message: string) => void;
}

// Same lazy checkout.js loading as openRazorpayCheckout above, but opens
// Standard Checkout in recurring mode (subscription_id in place of
// order_id/amount/currency) — the same modal, a different authorization
// flow underneath. See api/queries/schoolBilling.ts's
// createSubscriptionCheckout for how subscriptionId gets created.
export async function openRazorpaySubscriptionCheckout(params: OpenRazorpaySubscriptionCheckoutParams): Promise<void> {
  if (!RAZORPAY_KEY_ID) {
    params.onFailure?.("Razorpay is not configured (missing VITE_RAZORPAY_KEY_ID).");
    return;
  }

  try {
    await loadRazorpayScript();
  } catch {
    params.onFailure?.("Couldn't load the Razorpay checkout script — check your connection.");
    return;
  }
  if (!window.Razorpay) {
    params.onFailure?.("Razorpay checkout script failed to load.");
    return;
  }

  const instance = new window.Razorpay({
    key: RAZORPAY_KEY_ID,
    subscription_id: params.subscriptionId,
    name: params.name,
    description: params.description,
    image: CHECKOUT_LOGO_URL,
    prefill: params.prefill,
    theme: { color: BRAND_COLOR },
    webview_intent: true,
    handler: (response) => params.onSuccess(response as RazorpaySubscriptionCheckoutResult),
    modal: { ondismiss: () => params.onDismiss?.() },
  });

  instance.on("payment.failed", (response) => {
    params.onFailure?.(response.error?.description || "Payment failed.");
  });

  instance.open();
}
