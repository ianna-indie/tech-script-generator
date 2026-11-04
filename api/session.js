// POST   /api/session  (Authorization: Bearer <Google token>) → sets the indie.io session cookie for the tool
// DELETE /api/session  → signs out
const crypto = require("crypto");
const verifyGoogle = require("./_auth");
const DAYS = 7;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secure = (req.headers["x-forwarded-proto"] || "https") === "https" ? "; Secure" : "";
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", "iio_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + secure);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST or DELETE." });
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) return res.status(500).json({ error: "SESSION_SECRET isn't set (or is shorter than 24 characters) in Vercel." });
  const email = await verifyGoogle(req);
  if (!email) return res.status(403).json({ error: "This tool is for " + (process.env.ALLOWED_DOMAIN || "indie.io") + " accounts only." });
  const body = Buffer.from(JSON.stringify({ e: email, x: Date.now() + DAYS * 864e5 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  res.setHeader("Set-Cookie", "iio_session=" + body + "." + sig + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + DAYS * 86400 + secure);
  return res.status(200).json({ ok: true, email });
};
