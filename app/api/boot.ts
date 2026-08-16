import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { createRazorpayWebhookHandler } from "./webhooks/razorpayWebhook";
import { Paths } from "@contracts/constants";
import { startDispatchWorker } from "./lib/dispatchWorker";
import { startSchoolNightlyWorker } from "./lib/schoolNightlyWorker";
import { startRouteRestrictionWorker } from "./lib/routeRestrictionWorker";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
// Plain (non-tRPC) route — needs the raw request body for signature
// verification, which tRPC's body parsing would already have consumed.
// Must be registered before the catch-all 404 below (Hono matches routes
// in registration order).
app.post(Paths.razorpayWebhook, createRazorpayWebhookHandler());
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// Run once per process, dev and prod alike — see api/lib/dispatchWorker.ts
// for why these are setInterval loops and not a real job queue.
startDispatchWorker();
startSchoolNightlyWorker();
startRouteRestrictionWorker();

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
