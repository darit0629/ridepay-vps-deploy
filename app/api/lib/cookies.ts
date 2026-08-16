import type { CookieOptions } from "hono/utils/cookie";

function isLocalhost(headers: Headers): boolean {
  const host = headers.get("host") || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

// The frontend (SPA) and this API are always served from the same Hono app
// on the same origin — in dev via @hono/vite-dev-server mounting the same
// app the Vite server runs, in prod via serveStaticFiles(app) on the same
// app that handles /api/*. There is no cross-site request in this
// architecture (no separate frontend origin, no embedding), so SameSite=None
// was never actually required — it's meant for genuine cross-site cookie
// use (third-party iframes, a separate frontend domain calling this API).
// SameSite=Lax covers same-site fetches fine AND is exempted for top-level
// GET navigations (so the OAuth callback's 302 redirect still carries it),
// while being far less prone to being dropped/rejected by browsers with
// stricter third-party-cookie heuristics than SameSite=None — that
// unnecessary strictness was the actual cause of the session cookie
// intermittently failing to persist in the browser (root-caused after curl
// with a manually-set cookie header worked reliably every time, proving the
// JWT/session logic itself was never the problem — only what the browser
// was willing to store).
export function getSessionCookieOptions(headers: Headers): CookieOptions {
  const localhost = isLocalhost(headers);

  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: !localhost,
  };
}
