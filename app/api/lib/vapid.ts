import webpush from "web-push";

// Generated fresh on server boot rather than pulled from an env var — no
// external setup needed to get real Web Push working. Existing push
// subscriptions become invalid whenever the server restarts and the keys
// change, same tradeoff the in-memory notification store already makes.
const vapidKeys = webpush.generateVAPIDKeys();

webpush.setVapidDetails("mailto:online@saypx.in", vapidKeys.publicKey, vapidKeys.privateKey);

export const vapidPublicKey = vapidKeys.publicKey;
export { webpush };
