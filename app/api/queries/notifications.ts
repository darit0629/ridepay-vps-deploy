import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { appNotifications, pushSubscriptions, fcmTokens, type AppNotificationRow, type PushSubscriptionRow, type FcmTokenRow } from "@db/schema";

export type NotificationAudience = "rider" | "driver" | "both";
export type NotificationKind = "banner" | "text";

export interface AppNotification {
  id: string;
  audience: NotificationAudience;
  kind: NotificationKind;
  title: string;
  message: string;
  bannerUrl?: string;
  createdAt: number;
}

function toView(row: AppNotificationRow): AppNotification {
  return {
    id: row.id,
    audience: row.audience,
    kind: row.kind,
    title: row.title,
    message: row.message,
    bannerUrl: row.bannerUrl ?? undefined,
    createdAt: row.createdAt.getTime(),
  };
}

export async function seedNotificationsIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(appNotifications);
  if (Number(count) > 0) return;
  await db.insert(appNotifications).values([
    {
      id: "notif-seed-1", audience: "both", kind: "banner",
      title: "Flat ₹50 OFF this weekend",
      message: "Use code RIDE50 on rides above ₹150. Valid till Sunday midnight.",
      bannerUrl: "/assets/refer-illustration.png",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
    {
      id: "notif-seed-2", audience: "driver", kind: "text",
      title: "New surge zone near Ranaghat Station",
      message: "Demand is high in your area for the next hour. Go online to earn more.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
    },
  ]);
}

export async function listNotifications(): Promise<AppNotification[]> {
  const rows = await getDb().select().from(appNotifications).orderBy(sql`${appNotifications.createdAt} DESC`);
  return rows.map(toView);
}

export async function createNotification(input: {
  audience: NotificationAudience;
  kind: NotificationKind;
  title: string;
  message: string;
  bannerUrl?: string;
}): Promise<AppNotification> {
  const id = `notif-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  await getDb().insert(appNotifications).values({ id, ...input });
  const row = await getDb().query.appNotifications.findFirst({ where: eq(appNotifications.id, id) });
  return toView(row!);
}

export async function removeNotification(id: string): Promise<void> {
  await getDb().delete(appNotifications).where(eq(appNotifications.id, id));
}

function matchesRole(audience: NotificationAudience, role: "rider" | "driver") {
  return audience === "both" || audience === role;
}

export async function upsertPushSubscription(role: "rider" | "driver", subscription: {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}, userId?: number): Promise<void> {
  const db = getDb();
  await db
    .insert(pushSubscriptions)
    .values({
      role,
      userId: userId ?? null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      expirationTime: subscription.expirationTime ?? null,
    })
    .onDuplicateKeyUpdate({ set: { role, userId: userId ?? null, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, expirationTime: subscription.expirationTime ?? null } });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function upsertFcmToken(role: "rider" | "driver", token: string, userId?: number): Promise<void> {
  await getDb()
    .insert(fcmTokens)
    .values({ role, token, userId: userId ?? null })
    .onDuplicateKeyUpdate({ set: { role, userId: userId ?? null } });
}

type SendWebPush = (
  subscription: { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } },
  body: string
) => Promise<unknown>;
type SendFcmMessage = (token: string, title: string, message: string, url?: string) => Promise<{ invalidToken?: boolean }>;
type PushPayload = { title: string; message: string; url?: string };

// Shared delivery + dead-registration cleanup for both the broadcast and
// targeted send paths below — the only difference between them is how the
// target rows are selected (by role vs. by specific userId).
async function dispatchPush(
  webTargets: PushSubscriptionRow[],
  fcmTargets: FcmTokenRow[],
  payload: PushPayload,
  sendWebPush: SendWebPush,
  sendFcmMessage: SendFcmMessage
): Promise<void> {
  const db = getDb();
  const body = JSON.stringify({ title: payload.title, body: payload.message, url: payload.url });

  const webResults = await Promise.allSettled(
    webTargets.map((t) =>
      sendWebPush(
        { endpoint: t.endpoint, expirationTime: t.expirationTime, keys: { p256dh: t.p256dh, auth: t.auth } },
        body
      )
    )
  );

  // A 404/410 means the browser has invalidated that subscription (uninstalled,
  // permission revoked, etc.) — drop it so we stop wasting sends on it.
  const deadEndpoints: string[] = [];
  webResults.forEach((result, i) => {
    if (result.status === "rejected") {
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) deadEndpoints.push(webTargets[i].endpoint);
    }
  });
  for (const endpoint of deadEndpoints) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  const fcmResults = await Promise.all(fcmTargets.map((t) => sendFcmMessage(t.token, payload.title, payload.message, payload.url)));
  const deadTokens = fcmTargets.filter((_, i) => fcmResults[i]?.invalidToken).map((t) => t.token);
  for (const token of deadTokens) {
    await db.delete(fcmTokens).where(eq(fcmTokens.token, token));
  }
}

// Actually delivers to the OS notification tray, including while the app is
// closed. Two independent channels, both best-effort: standard Web Push for
// devices using the app in a regular browser, and FCM for devices running it
// inside the wrapped native Android app. A device only ever has an entry in
// one of the two stores.
export async function sendPushToAudience(
  audience: NotificationAudience,
  payload: PushPayload,
  sendWebPush: SendWebPush,
  sendFcmMessage: SendFcmMessage
): Promise<void> {
  const db = getDb();
  const allSubs = await db.select().from(pushSubscriptions);
  const webTargets = allSubs.filter((s) => matchesRole(audience, s.role));
  const allTokens = await db.select().from(fcmTokens);
  const fcmTargets = allTokens.filter((t) => matchesRole(audience, t.role));
  await dispatchPush(webTargets, fcmTargets, payload, sendWebPush, sendFcmMessage);
}

// Targets specific people rather than an entire audience — e.g. "a new ride
// just appeared near you" should reach only the handful of nearby online
// drivers it's actually relevant to, not every driver in the system. Devices
// that subscribed before the userId column existed (userId is null) simply
// can't be targeted this way; they still receive audience broadcasts.
export async function sendPushToUserIds(
  userIds: number[],
  payload: PushPayload,
  sendWebPush: SendWebPush,
  sendFcmMessage: SendFcmMessage
): Promise<void> {
  if (userIds.length === 0) return;
  const idSet = new Set(userIds);
  const db = getDb();
  const allSubs = await db.select().from(pushSubscriptions);
  const webTargets = allSubs.filter((s) => s.userId != null && idSet.has(s.userId));
  const allTokens = await db.select().from(fcmTokens);
  const fcmTargets = allTokens.filter((t) => t.userId != null && idSet.has(t.userId));
  await dispatchPush(webTargets, fcmTargets, payload, sendWebPush, sendFcmMessage);
}
