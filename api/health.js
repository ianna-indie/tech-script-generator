// GET /api/health — checks the Anthropic key without revealing it.
// Shows: whether it's set, its length, its key type, any paste problems, and Anthropic's verdict.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const raw = process.env.ANTHROPIC_API_KEY;
  const key = String(raw || "").trim().replace(/^['"]+|['"]+$/g, "").trim();
  const type = /^sk-ant-api/.test(key) ? "API key (correct type)"
    : /^sk-ant-admin/.test(key) ? "ADMIN key — wrong type, can't call Claude. Ask for a normal API key."
    : /^sk-ant-oat|^sk-ant-ort/.test(key) ? "OAuth token — wrong type. Ask for a normal API key."
    : /^sk-ant-/.test(key) ? "Anthropic key of an unknown type"
    : key ? "Not an Anthropic key (should start with sk-ant-api…)" : "missing";
  const out = {
    environment: process.env.VERCEL_ENV || "unknown",
    keySet: !!raw,
    keyLength: key.length,
    keyType: type,
    hadSpacesOrLineBreaks: !!raw && raw !== raw.trim(),
    hadQuotes: !!raw && /^['"]|['"]$/.test(raw.trim()),
    looksTruncated: !!key && key.length < 90,
    googleClientIdSet: !!process.env.GOOGLE_CLIENT_ID,
  };
  if (key) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      });
      const j = await r.json().catch(() => ({}));
      out.anthropicStatus = r.status;
      out.anthropicSays = r.ok ? "Key accepted ✔" : (j.error && j.error.message) || "error";
    } catch (e) {
      out.anthropicSays = "Couldn't reach Anthropic: " + e.message;
    }
  }
  res.status(200).json(out);
};
