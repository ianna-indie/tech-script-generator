// POST /api/claude  — proxies a prompt (+ optional images) to the Anthropic Messages API.
// Only callers signed in with a Google account on ALLOWED_DOMAIN (default indie.io) are accepted.
const MODELS = {
  quick: process.env.CLAUDE_MODEL_QUICK || "claude-haiku-4-5-20251001",
  default: process.env.CLAUDE_MODEL || "claude-sonnet-5",
  complex: process.env.CLAUDE_MODEL_COMPLEX || process.env.CLAUDE_MODEL || "claude-sonnet-5",
};

async function verifyGoogle(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!r.ok) return null;
  const u = await r.json();
  const domain = (process.env.ALLOWED_DOMAIN || "indie.io").toLowerCase();
  if (!u.email || !u.email_verified) return null;
  if (domain !== "*" && !u.email.toLowerCase().endsWith("@" + domain)) return null;
  return u.email;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY isn't set on the server." });
  const email = await verifyGoogle(req);
  if (!email) return res.status(401).json({ error: "Sign in with your indie.io Google account." });

  const { prompt, images = [], tier = "default" } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt." });

  const content = [
    ...images.slice(0, 20).map((im) => ({
      type: "image",
      source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data },
    })),
    { type: "text", text: prompt },
  ];

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELS[tier] || MODELS.default,
        max_tokens: Number(process.env.CLAUDE_MAX_TOKENS) || 16000,
        messages: [{ role: "user", content }],
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      const msg = (j.error && j.error.message) || "Anthropic API error";
      // Don't pass Anthropic's 401/403 through — the page would read it as a sign-in problem.
      if (r.status === 401) return res.status(502).json({ error: "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in Vercel (no spaces or quotes), then redeploy. (" + msg + ")" });
      if (r.status === 403) return res.status(502).json({ error: "The API key isn't allowed to use this model or org. (" + msg + ")" });
      if (r.status === 404) return res.status(502).json({ error: "Model not found: " + (MODELS[tier] || MODELS.default) + ". Set CLAUDE_MODEL in Vercel. (" + msg + ")" });
      return res.status(r.status === 429 ? 429 : 502).json({ error: msg });
    }
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: "Couldn't reach the Anthropic API: " + e.message });
  }
};

