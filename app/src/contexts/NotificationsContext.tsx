import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import { isNativeApp, getFcmToken, onFcmToken } from "@/lib/nativeApp";
import { useAuth } from "@/hooks/useAuth";
import type { NotificationAudience, NotificationKind } from "../../api/notification-router";

export type { NotificationAudience, NotificationKind };

export interface DisplayNotification {
  id: string;
  audience: NotificationAudience;
  kind: NotificationKind;
  title: string;
  message: string;
  bannerUrl?: string;
  createdAt: number;
  source: "admin" | "system";
  read: boolean;
}

type ComposeInput = {
  audience: NotificationAudience;
  kind: NotificationKind;
  title: string;
  message: string;
  bannerUrl?: string;
};

interface NotificationsContextType {
  notifications: DisplayNotification[];
  notificationsFor: (role: "rider" | "driver") => DisplayNotification[];
  unreadCountFor: (role: "rider" | "driver") => number;
  sendNotification: (input: ComposeInput) => void;
  pushSystemNotification: (input: Omit<ComposeInput, "kind" | "bannerUrl">) => void;
  markAllRead: (role: "rider" | "driver") => void;
  /** Admin-only: deletes a sent notification for everyone. */
  removeNotification: (id: string) => void;
  /** Rider/driver: hides a notification on this device only. */
  hideNotification: (id: string) => void;
  notificationPermission: NotificationPermission | "unsupported";
  /** True once this device has successfully registered for push through
   *  either channel (web push in a browser, or FCM inside the wrapped
   *  native app) — the "enable notifications" prompt hides once this is
   *  true, regardless of what the raw `notificationPermission` value is. */
  pushEnabled: boolean;
  /** Requests OS notification permission and, once granted, registers this
   *  device for real push — Web Push in a browser, or FCM via the native
   *  app's bridge when running inside the wrapped Android app — so
   *  notifications can arrive even when the app isn't open. `role` decides
   *  which audience this device's registration matches server-side. */
  requestNotificationPermission: (role: "rider" | "driver") => void;
  /** User-facing "Ride Updates" toggle in Settings — when off, ride/parcel
   *  lifecycle notifications (pushSystemNotification) are suppressed entirely,
   *  independent of the OS-level push permission. */
  rideUpdatesEnabled: boolean;
  setRideUpdatesEnabled: (enabled: boolean) => void;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const READ_IDS_KEY = "ridepay_notif_read_ids";
const HIDDEN_IDS_KEY = "ridepay_notif_hidden_ids";
const KNOWN_IDS_KEY = "ridepay_notif_known_ids";
const PUSH_ENABLED_KEY = "ridepay_push_enabled";
const PUSH_ROLE_KEY = "ridepay_push_role";
const RIDE_UPDATES_ENABLED_KEY = "ridepay_ride_updates_enabled";

function loadIdSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, set: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Storage can be unavailable (private browsing quota, etc.) — read/hide
    // state just won't persist across reloads for this device.
  }
}

function matchesRole(audience: NotificationAudience, role: "rider" | "driver") {
  return audience === "both" || (role === "rider" ? audience === "rider" : audience === "driver");
}

// Best-effort OS-level toast via the browser's own Notification API. Silently
// no-ops if the browser doesn't support it or permission hasn't been granted
// yet — the in-app notification list is always the source of truth.
//
// Android Chrome (and other mobile browsers) frequently throw on a bare
// `new Notification()` called from page context — they only allow showing
// notifications through a registered ServiceWorkerRegistration. Since /sw.js
// is already registered once push is enabled, route through
// `registration.showNotification()` whenever one is available, and only fall
// back to the raw constructor (desktop browsers without a SW ready yet).
function showBrowserNotification(n: { id: string; title: string; message: string }) {
  // Inside the wrapped native app, browser notifications must stay off —
  // they'd show branded as "Chrome" instead of Ridepay. The server-side FCM
  // push (sendPushToAudience) is what reaches the tray there, with the
  // app's own icon and name.
  if (isNativeApp()) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        registration.showNotification(n.title, { body: n.message, icon: "/assets/logo.png", tag: n.id }).catch(() => {
          tryLegacyNotification(n);
        });
      } else {
        tryLegacyNotification(n);
      }
    });
    return;
  }

  tryLegacyNotification(n);
}

function tryLegacyNotification(n: { id: string; title: string; message: string }) {
  try {
    new Notification(n.title, { body: n.message, icon: "/assets/logo.png", tag: n.id });
  } catch {
    // No usable notification path on this browser — the in-app list still has it either way.
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  // Only used to learn who's logged in, so an already-granted push
  // subscription can be (re-)tagged with their userId — this provider sits
  // above the router in main.tsx, so it can't redirect on its own; that's
  // fine, useAuth here is purely informational.
  const { user } = useAuth();
  // Ride-lifecycle notifications ("driver arrived", etc.) are inherently
  // scoped to whoever is on that ride right now, so they stay purely local
  // to this device/session rather than going through the shared server list.
  const [systemNotifications, setSystemNotifications] = useState<DisplayNotification[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [readIds, setReadIds] = useState<Set<string>>(() => loadIdSet(READ_IDS_KEY));
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadIdSet(HIDDEN_IDS_KEY));
  // Persisted across reloads (not just this tab's lifetime) so a device
  // doesn't re-toast every admin notification it already knows about.
  const knownIdsRef = useRef<Set<string>>(loadIdSet(KNOWN_IDS_KEY));
  const [pushEnabled, setPushEnabled] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(PUSH_ENABLED_KEY) === "1"
  );
  const [rideUpdatesEnabled, setRideUpdatesEnabledState] = useState(
    () => typeof window === "undefined" || window.localStorage.getItem(RIDE_UPDATES_ENABLED_KEY) !== "0"
  );
  const setRideUpdatesEnabled = (enabled: boolean) => {
    setRideUpdatesEnabledState(enabled);
    try {
      window.localStorage.setItem(RIDE_UPDATES_ENABLED_KEY, enabled ? "1" : "0");
    } catch {
      // Non-fatal — the toggle just won't persist across reloads.
    }
  };
  // Set once the native app's bridge hands back a token; a click on
  // "Enable" that arrives before the token does is remembered here and
  // fulfilled as soon as the token shows up.
  const fcmTokenRef = useRef<string | null>(null);
  const pendingFcmRoleRef = useRef<"rider" | "driver" | null>(null);

  const utils = trpc.useUtils();
  const { data: adminRaw } = trpc.notification.list.useQuery(undefined, {
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const sendMutation = trpc.notification.send.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  });
  const removeMutation = trpc.notification.remove.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  });
  const subscribeMutation = trpc.notification.subscribe.useMutation();
  const registerFcmMutation = trpc.notification.registerFcmToken.useMutation();
  const sendSystemPushMutation = trpc.notification.sendSystemPush.useMutation();
  const checkDueScheduleMutation = trpc.schedule.checkDue.useMutation();

  // Scheduled-ride reminders (schedule-router.ts's checkDue) have no cron to
  // fire them — this poll is what actually finds "due soon" schedules and
  // sends the real push while a rider has the app open anywhere, not just on
  // the Schedule/Services page. Riders only; drivers/admins have no schedules.
  useEffect(() => {
    if (user?.role !== "user") return;
    checkDueScheduleMutation.mutate();
    const interval = setInterval(() => checkDueScheduleMutation.mutate(), 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  // Wires up the wrapped native Android app ("RidepayApp"). Newer app builds
  // auto-deliver the FCM token on every page load via the always-installed
  // handler in src/lib/nativeApp.ts — the moment a token shows up (including
  // one caught before React mounted), it's registered with the server
  // automatically, no "Enable" tap needed. The role comes from whichever
  // portal last registered on this device, defaulting to rider.
  useEffect(() => {
    if (!isNativeApp()) return;

    const register = (token: string) => {
      fcmTokenRef.current = token;
      let storedRole: string | null = null;
      try {
        storedRole = window.localStorage.getItem(PUSH_ROLE_KEY);
      } catch {
        // Fall through to the rider default.
      }
      const role = pendingFcmRoleRef.current ?? (storedRole === "driver" ? "driver" : "rider");
      pendingFcmRoleRef.current = null;
      registerFcmMutation.mutate({ role, token });
      setPushEnabled(true);
      try {
        window.localStorage.setItem(PUSH_ENABLED_KEY, "1");
        window.localStorage.setItem(PUSH_ROLE_KEY, role);
      } catch {
        // Non-fatal — just means the prompt may reappear on next launch.
      }
    };

    const existing = getFcmToken();
    if (existing) register(existing);
    const unsubscribe = onFcmToken(register);
    // Older app builds only hand the token over when asked.
    window.NativeBridge?.getFcmToken?.();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registers the notification service worker as soon as the app loads and
  // permission is already granted (not just when the user goes through the
  // subscribe-to-push flow) — showBrowserNotification needs a live
  // registration to reliably reach the OS tray on mobile browsers.
  useEffect(() => {
    // Not in the native app — web push/SW would route notifications through
    // Chrome's identity there; FCM handles delivery instead.
    if (isNativeApp()) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — showBrowserNotification falls back to the raw constructor.
    });
  }, []);

  // Cross-device delivery: every open tab/device polls the same server list
  // above, and this toasts + remembers anything this device hasn't seen yet
  // — whether it was just composed here or synced in from another device.
  useEffect(() => {
    if (!adminRaw) return;
    let changed = false;
    for (const n of adminRaw) {
      if (!knownIdsRef.current.has(n.id)) {
        knownIdsRef.current.add(n.id);
        changed = true;
        showBrowserNotification(n);
      }
    }
    if (changed) saveIdSet(KNOWN_IDS_KEY, knownIdsRef.current);
  }, [adminRaw]);

  const adminNotifications: DisplayNotification[] = useMemo(
    () =>
      (adminRaw ?? [])
        .filter((n) => !hiddenIds.has(n.id))
        .map((n) => ({ ...n, source: "admin" as const, read: readIds.has(n.id) })),
    [adminRaw, hiddenIds, readIds]
  );

  const notifications = useMemo(
    () => [...systemNotifications, ...adminNotifications].sort((a, b) => b.createdAt - a.createdAt),
    [systemNotifications, adminNotifications]
  );

  const sendNotification: NotificationsContextType["sendNotification"] = (input) => {
    sendMutation.mutate(input);
  };

  const pushSystemNotification: NotificationsContextType["pushSystemNotification"] = (input) => {
    if (!rideUpdatesEnabled) return;
    const notification: DisplayNotification = {
      id: `sys-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      audience: input.audience,
      kind: "text",
      title: input.title,
      message: input.message,
      createdAt: Date.now(),
      source: "system",
      read: false,
    };
    setSystemNotifications((prev) => [notification, ...prev]);
    showBrowserNotification(notification);
    // Local-only delivery (in-app list + best-effort same-tab toast) isn't
    // enough to ever reach the OS tray reliably, especially inside the
    // wrapped native app where a page-context Notification/SW call has no
    // way to surface a system notification at all — this fires the real
    // web-push/FCM send so ride/parcel updates land the same way admin
    // notifications already do.
    sendSystemPushMutation.mutate({ audience: input.audience, title: input.title, message: input.message });
  };

  const notificationsFor = (role: "rider" | "driver") =>
    notifications.filter((n) => matchesRole(n.audience, role));

  const unreadCountFor = (role: "rider" | "driver") =>
    notificationsFor(role).filter((n) => !n.read).length;

  const markAllRead = (role: "rider" | "driver") => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of adminNotifications) if (matchesRole(n.audience, role)) next.add(n.id);
      saveIdSet(READ_IDS_KEY, next);
      return next;
    });
    setSystemNotifications((prev) => prev.map((n) => (matchesRole(n.audience, role) ? { ...n, read: true } : n)));
  };

  const removeNotification = (id: string) => {
    removeMutation.mutate({ id });
  };

  const hideNotification = (id: string) => {
    if (systemNotifications.some((n) => n.id === id)) {
      setSystemNotifications((prev) => prev.filter((n) => n.id !== id));
      return;
    }
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveIdSet(HIDDEN_IDS_KEY, next);
      return next;
    });
  };

  const subscribeToPush = async (role: "rider" | "driver") => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const { key } = await utils.notification.vapidPublicKey.fetch();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      subscribeMutation.mutate({
        role,
        subscription: {
          endpoint: json.endpoint,
          expirationTime: json.expirationTime ?? null,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
      });
      setPushEnabled(true);
      try {
        window.localStorage.setItem(PUSH_ENABLED_KEY, "1");
      } catch {
        // Non-fatal — just means the prompt may reappear on next launch.
      }
    } catch (error) {
      console.error("Push subscription failed:", error);
    }
  };

  // Re-runs the (idempotent) subscribe flow whenever we learn who's logged
  // in, so a subscription created before per-user push targeting existed —
  // or on a device that granted permission in a previous session — gets
  // tagged with this userId. Without this, "new ride nearby" pushes
  // (targeted by userId, not just role) would silently never reach a
  // returning driver until they happened to re-trigger the enable flow.
  useEffect(() => {
    if (isNativeApp()) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!user) return;
    const role = user.role === "driver" ? "driver" : "rider";
    subscribeToPush(role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const requestNotificationPermission = (role: "rider" | "driver") => {
    // Inside the wrapped native app: permission is handled by Android
    // itself, not the web Notification API, so this skips straight to
    // registering (or waiting for) the FCM token — and pins the chosen
    // role for future auto-registrations on this device.
    if (typeof window !== "undefined" && isNativeApp()) {
      const token = fcmTokenRef.current ?? getFcmToken();
      if (token) {
        registerFcmMutation.mutate({ role, token });
        setPushEnabled(true);
        try {
          window.localStorage.setItem(PUSH_ENABLED_KEY, "1");
          window.localStorage.setItem(PUSH_ROLE_KEY, role);
        } catch {
          // Non-fatal.
        }
      } else {
        pendingFcmRoleRef.current = role;
        window.NativeBridge?.getFcmToken?.();
      }
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((permission) => {
      setNotificationPermission(permission);
      if (permission === "granted") subscribeToPush(role);
    });
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        notificationsFor,
        unreadCountFor,
        sendNotification,
        pushSystemNotification,
        markAllRead,
        removeNotification,
        hideNotification,
        notificationPermission,
        pushEnabled,
        requestNotificationPermission,
        rideUpdatesEnabled,
        setRideUpdatesEnabled,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}
