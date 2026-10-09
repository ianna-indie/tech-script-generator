// GET /api/health — checks the AI backend settings without revealing the key.
const llm = require("./_llm");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const out = {
    environment: process.env.VERCEL_ENV || "unknown",
    baseUrl: llm.BASE, format: llm.FORMAT, authHeader: llm.AUTH,
    models: llm.MODELS,
    keySet: !!llm.KEY, keyLength: llm.KEY.length,
    googleClientIdSet: !!process.env.GOOGLE_CLIENT_ID,
  };
  if (llm.KEY) {
    try {
      const text = await llm.complete({ prompt: 'Reply with just: OK', tier: "quick", maxTokens: 10 });
      out.testCall = "Working ✔ (" + String(text).trim().slice(0, 20) + ")";
      out.workingSettings = llm.detected();
    } catch (e) {
      out.testCall = "Failed: " + e.status + " " + e.message;
      out.lastTriedUrl = e.url;
      out.triedCombinations = llm.candidates().length;
    }
  }
  res.status(200).json(out);
};
