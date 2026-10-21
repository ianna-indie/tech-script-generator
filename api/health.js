// GET /api/health — checks the Rupert connection without revealing any secrets.
const llm = require("./_llm");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const out = {
    environment: process.env.VERCEL_ENV || "unknown",
    endpoint: llm.ENDPOINT, models: llm.MODELS, maxImages: llm.MAX_IMAGES,
    rupertKeySet: !!llm.KEY, rupertKeyLength: llm.KEY.length,
    cloudflareIdSet: !!llm.CF_ID, cloudflareSecretSet: !!llm.CF_SECRET,
    googleClientIdSet: !!process.env.GOOGLE_CLIENT_ID,
  };
  if (llm.KEY && llm.CF_ID && llm.CF_SECRET) {
    try { const t = await llm.complete({ prompt: "Reply with just: OK", tier: "quick", maxTokens: 10 }); out.testCall = "Working ✔ (" + String(t).trim().slice(0, 30) + ")"; }
    catch (e) { out.testCall = "Failed: " + (e.status || "") + " " + e.message; }
  } else out.testCall = "Not tested — set LLM_API_KEY, CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.";
  res.status(200).json(out);
};
