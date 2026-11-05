// Email notifications via Resend (resend.com). Set RESEND_API_KEY in Vercel.
// Sender: NOTIFY_FROM (a verified domain address), or Resend's test sender, which only delivers to the Resend account owner.
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ready = () => !!process.env.RESEND_API_KEY;

async function send({ to, subject, html, text, attachments = [] }) {
  if (!ready() || !to) return { skipped: true };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM || "Tech Script Generator <onboarding@resend.dev>", to: [].concat(to), subject, html, text, attachments }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j && (j.message || j.error)) || "Resend " + r.status);
  return j;
}

// data:image/...;base64,xxx → Resend attachment (inline via content_id so it shows in the email body)
function dataUrlAttachment(dataUrl, filename, cid) {
  const m = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return null;
  return { filename, content: m[2], content_type: m[1], content_id: cid };
}

module.exports = { ready, send, esc, dataUrlAttachment };
