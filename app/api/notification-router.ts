import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { vapidPublicKey, webpush } from "./lib/vapid";
import { sendFcmMessage } from "./lib/firebase";
import {
  listNotifications,
  createNotification,
  removeNotification,
  upsertPushSubscription,
  removePushSubscription,
  upsertFcmToken,
  sendPushToAudience,
  sendPushToUserIds,
  seedNotificationsIfEmpty,
} from "./queries/notifications";

export type { AppNotification, NotificationAudience, NotificationKind } from "./queries/notifications";

void seedNotificationsIfEmpty();

const audienceSchema = z.enum(["rider", "driver", "both"]);
const kindSchema = z.enum(["banner", "text"]);
const roleSchema = z.enum(["rider", "driver"]);
const pushSubscriptionSchema = z.object({
  endpoint: z.string(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

function sendPush(audience: "rider" | "driver" | "both", payload: { title: string; message: string; url?: string }) {
  return sendPushToAudience(
    audience,
    payload,
    (subscription, body) => webpush.sendNotification(subscription, body),
    sendFcmMessage
  );
}

// Called from other routers (e.g. ride-router.ts when a ride starts
// searching, schedule-router.ts for a due reminder) to push a real OS-level
// notification to specific drivers/riders by userId, rather than
// broadcasting to everyone with that role. `url` (optional) is where the
// service worker navigates on tap — see public/sw.js.
export function sendPushToDrivers(userIds: number[], payload: { title: string; message: string; url?: string }) {
  return sendPushToUserIds(
    userIds,
    payload,
    (subscription, body) => webpush.sendNotification(subscription, body),
    sendFcmMessage
  );
}

// Same underlying delivery as sendPushToDrivers (sendPushToUserIds doesn't
// actually filter by role — see queries/notifications.ts) — a separate name
// just for call-site clarity in api/queries/schoolBilling.ts and
// api/lib/schoolNightlyWorker.ts, which target guardians, not drivers.
export function sendPushToGuardians(userIds: number[], payload: { title: string; message: string; url?: string }) {
  return sendPushToUserIds(
    userIds,
    payload,
    (subscription, body) => webpush.sendNotification(subscription, body),
    sendFcmMessage
  );
}

export const notificationRouter = createRouter({
  list: publicQuery.query(() => listNotifications()),

  send: publicQuery
    .input(
      z.object({
        audience: audienceSchema,
        kind: kindSchema,
        title: z.string().trim().min(1).max(120),
        message: z.string().trim().min(1).max(500),
        // Data URI when a banner image was uploaded — self-contained so it
        // renders on every device without needing file storage.
        bannerUrl: z.string().max(2_000_000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const notification = await createNotification(input);
      await sendPush(input.audience, { title: input.title, message: input.message });
      return notification;
    }),

  remove: publicQuery.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await removeNotification(input.id);
    return { ok: true };
  }),

  // Ride/parcel lifecycle events (pushSystemNotification on the client) are
  // personal to whoever's on that ride/parcel right now, so — unlike `send`
  // above — this deliberately does NOT add to the shared notifications list
  // everyone polls (that would broadcast "your courier picked up your
  // parcel" to every rider's device). It only fires the actual OS-level
  // push, through the same web-push/FCM pipeline admin notifications use —
  // the in-app list entry for this event already exists locally on the
  // originating device via NotificationsContext's own systemNotifications state.
  sendSystemPush: publicQuery
    .input(
      z.object({
        audience: audienceSchema,
        title: z.string().trim().min(1).max(120),
        message: z.string().trim().min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      await sendPush(input.audience, { title: input.title, message: input.message });
      return { ok: true };
    }),

  vapidPublicKey: publicQuery.query(() => ({ key: vapidPublicKey })),

  subscribe: publicQuery
    .input(z.object({ role: roleSchema, subscription: pushSubscriptionSchema }))
    .mutation(async ({ ctx, input }) => {
      await upsertPushSubscription(input.role, input.subscription, ctx.user?.id);
      return { ok: true };
    }),

  unsubscribe: publicQuery.input(z.object({ endpoint: z.string() })).mutation(async ({ input }) => {
    await removePushSubscription(input.endpoint);
    return { ok: true };
  }),

  // Called from the wrapped native Android app's NativeBridge, not from a
  // regular browser — see subscribe/unsubscribe above for the web-push path.
  registerFcmToken: publicQuery
    .input(z.object({ role: roleSchema, token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await upsertFcmToken(input.role, input.token, ctx.user?.id);
      return { ok: true };
    }),
});
