// Keeps the tool private to indie.io accounts. Only the developer brief pages (/b/…) and the APIs (which check
// sign-in themselves) are public. Everything else needs the signed session cookie set by /api/session.
import { next } from "@vercel/functions";

export const config = {
  // Public: brief pages, the login page, APIs (they check sign-in themselves), and open-source/static helpers
  // (sw.js must stay public — browsers fetch service-worker scripts without following a login redirect).
  matcher: ["/((?!b/|brief\\.html|login\\.html|api/|favicon\\.ico|sw\\.js|vendor/).*)"],
};

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

async function validSession(token, secret) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64u(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  if (expected.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return false;
  try {
    const p = JSON.parse(fromB64u(body));
    const domain = (process.env.ALLOWED_DOMAIN || "indie.io").toLowerCase();
    return p.x > Date.now() && (domain === "*" || String(p.e).toLowerCase().endsWith("@" + domain));
  } catch (e) { return false; }
}

export default async function middleware(request) {
  const secret = process.env.SESSION_SECRET;
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)iio_session=([^;]+)/);
  if (secret && m && (await validSession(decodeURIComponent(m[1]), secret))) return next();
  const url = new URL(request.url);
  const login = new URL("/login.html", url);
  if (url.pathname !== "/" || url.search) login.searchParams.set("next", url.pathname + url.search);
  return Response.redirect(login.toString(), 302);
}
