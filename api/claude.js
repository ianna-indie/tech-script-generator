// POST /api/claude — sends a prompt (+ optional stills) to the AI backend configured in api/_llm.js.
// Only callers signed in with a Google account on ALLOWED_DOMAIN (default indie.io) are accepted.
const llm = require("./_llm");

async function verifyGoogle(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  const domain = (process.env.ALLOWED_DOMAIN || "indie.io").toLowerCase();
  if (!u.email || !u.email_verified) return null;
  if (domain !== "*" && !u.email.toLowerCase().endsWith("@" + domain)) return null;
  return u.email;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!llm.KEY) return res.status(500).json({ error: "No API key set. Add LLM_API_KEY (or ANTHROPIC_API_KEY) in Vercel, then redeploy." });
  const email = await verifyGoogle(req);
  if (!email) return res.status(401).json({ error: "Sign in with your indie.io Google account." });
  const { prompt, images = [], tier = "default" } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt." });
  try {
    const text = await llm.complete({ prompt, images: images.slice(0, 20), tier });
    return res.status(200).json({ text });
  } catch (e) {
    const where = " [" + llm.FORMAT + " API at " + e.url + "]";
    if (e.status === 401 || e.status === 403) return res.status(502).json({ error: "The API rejected the key (" + e.message + ")." + where + " Check LLM_API_KEY, LLM_AUTH and LLM_BASE_URL in Vercel." });
    if (e.status === 404) return res.status(502).json({ error: "Endpoint or model not found (" + e.message + ")." + where + " Check LLM_BASE_URL, LLM_FORMAT and CLAUDE_MODEL." });
    if (e.status === 429) return res.status(429).json({ error: e.message });
    return res.status(502).json({ error: (e.message || "AI request failed") + where });
  }
};
