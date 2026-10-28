// POST /api/claude — sends a prompt (+ optional stills) to Rupert. Only @indie.io Google accounts may call it.
const llm = require("./_llm");

const verifyGoogle = require("./_auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!llm.KEY) return res.status(500).json({ error: "No Rupert key set. Add LLM_API_KEY in Vercel, then redeploy." });
  if (!llm.CF_ID || !llm.CF_SECRET) return res.status(500).json({ error: "Cloudflare service token missing. Add CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET in Vercel, then redeploy." });
  const email = await verifyGoogle(req);
  if (!email) return res.status(401).json({ error: "Sign in with your indie.io Google account." });
  const { prompt, images = [], tier = "default" } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt." });
  try {
    let out;
    try { out = await llm.complete({ prompt, images, tier, json: true }); }
    catch (e1) {
      const lim = /image/i.test(e1.message) && (String(e1.message).match(/at most (\d+)/i) || String(e1.message).match(/(?:maximum|limit)[^\d]{0,20}(\d+)/i));
      if (lim && Number(lim[1]) > 0 && images.length > Number(lim[1])) out = await llm.complete({ prompt, images: images.slice(0, Number(lim[1])), tier, json: true }); // retry within Rupert's image limit
      else if (!e1.status || e1.status >= 500) { await new Promise((r) => setTimeout(r, 2500)); out = await llm.complete({ prompt, images, tier, json: true }); } // one retry on a hiccup
      else throw e1;
    }
    return res.status(200).json({ text: out.text, truncated: out.truncated });
  } catch (e) {
    const where = " [" + (e.url || llm.ENDPOINT) + "]";
    if (/image/i.test(e.message) && /(at most|limit|maximum|too many)/i.test(e.message)) return res.status(502).json({ error: "Rupert accepts fewer images per request (" + e.message + "). Set LLM_MAX_IMAGES in Vercel to that number, then redeploy." });
    if (e.status === 401 || e.status === 403) return res.status(502).json({ error: "Rupert or Cloudflare rejected the request (" + e.message + ")." + where + " Check LLM_API_KEY and the two CF_ACCESS values in Vercel." });
    if (e.status === 404) return res.status(502).json({ error: "Endpoint or model not found (" + e.message + ")." + where + " Check LLM_BASE_URL and LLM_MODEL." });
    if (e.status === 429) return res.status(429).json({ error: e.message });
    if (!e.status || e.status >= 500) return res.status(502).json({ error: "Rupert didn't answer properly (" + (e.message || "no reply") + "). It may be busy or restarting — try again in a minute." + where });
    return res.status(502).json({ error: (e.message || "AI request failed") + where });
  }
};
