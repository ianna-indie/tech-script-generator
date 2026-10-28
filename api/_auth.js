// Verifies the caller's Google sign-in and that the account is on ALLOWED_DOMAIN (default indie.io).
module.exports = async function verifyGoogle(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  const domain = (process.env.ALLOWED_DOMAIN || "indie.io").toLowerCase();
  if (!u.email || !u.email_verified) return null;
  if (domain !== "*" && !u.email.toLowerCase().endsWith("@" + domain)) return null;
  return u.email;
};
