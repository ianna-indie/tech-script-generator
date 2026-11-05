// POST /api/notify-test — indie.io only: sends a test email to you and reports exactly what went wrong if it fails.
const verifyGoogle = require("./_auth");
const mail = require("./_mail");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const email = await verifyGoogle(req);
  if (!email) return res.status(401).json({ error: "Sign in with your indie.io Google account." });
  if (!mail.ready()) return res.status(200).json({ ok: false, reason: "RESEND_API_KEY isn't set for this deployment. Add it in Vercel → Environment Variables (Production), then redeploy." });
  const to = process.env.NOTIFY_EMAIL || email;
  try {
    const r = await mail.send({ to, subject: "Tech Script Generator — test email", html: "<p>Email notifications are working. Developer replies will arrive like this.</p>", text: "Email notifications are working." });
    return res.status(200).json({ ok: true, to, id: r.id, from: process.env.NOTIFY_FROM || "onboarding@resend.dev (Resend test sender)" });
  } catch (e) {
    let hint = "";
    if (/own email|testing emails|verify a domain/i.test(e.message)) hint = " — Resend's test sender only delivers to the email address your Resend account was created with. Sign up to Resend with " + to + ", or set NOTIFY_EMAIL to your Resend login email, or verify indie.io in Resend and set NOTIFY_FROM.";
    else if (/api key|unauthori|invalid/i.test(e.message)) hint = " — the RESEND_API_KEY value looks wrong. Copy it again from resend.com → API Keys.";
    else if (/domain/i.test(e.message)) hint = " — NOTIFY_FROM uses a domain that isn't verified in Resend.";
    return res.status(200).json({ ok: false, to, reason: e.message + hint });
  }
};
