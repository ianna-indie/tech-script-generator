// AI backend: indie.io's Rupert (OpenAI-style API behind Cloudflare Access).
// All values come from Vercel environment variables — nothing secret reaches the browser.
const clean = (k) => String(k || "").trim().replace(/^['"]+|['"]+$/g, "").trim();

const RAW = clean(process.env.LLM_BASE_URL || "https://rupert.indie.io/api/v1/chat/completions").replace(/\/+$/, "");
const ENDPOINT = /\/chat\/completions$/.test(RAW) ? RAW : RAW.replace(/\/(api\/)?v1$/, "").replace(/\/api$/, "") + "/api/v1/chat/completions";
const KEY = clean(process.env.LLM_API_KEY || process.env.RUPERT_API_KEY || process.env.ANTHROPIC_API_KEY);
const CF_ID = clean(process.env.CF_ACCESS_CLIENT_ID || process.env.RUPERT_CF_CLIENT_ID);
const CF_SECRET = clean(process.env.CF_ACCESS_CLIENT_SECRET || process.env.RUPERT_CF_CLIENT_SECRET);
const MODEL = clean(process.env.LLM_MODEL) || "qwen3.8:27b";
const MODELS = { quick: clean(process.env.LLM_MODEL_QUICK) || MODEL, default: MODEL, complex: clean(process.env.LLM_MODEL_COMPLEX) || MODEL };
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 8000;
const MAX_IMAGES = Number(process.env.LLM_MAX_IMAGES) || 10;

function headers() {
  const h = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (KEY) h.Authorization = "Bearer " + KEY;
  if (CF_ID) h["CF-Access-Client-Id"] = CF_ID;
  if (CF_SECRET) h["CF-Access-Client-Secret"] = CF_SECRET;
  return h;
}

// Streams the reply (Cloudflare drops responses that take > ~100 s) and returns the full text.
async function complete({ prompt, images = [], tier = "default", maxTokens }) {
  const body = {
    model: MODELS[tier] || MODEL,
    stream: true,
    max_tokens: maxTokens || MAX_TOKENS,
    chat_template_kwargs: { enable_thinking: false },
    messages: [{ role: "user", content: [
      { type: "text", text: prompt },
      ...images.slice(0, MAX_IMAGES).map((im) => ({ type: "image_url", image_url: { url: "data:" + (im.media_type || "image/jpeg") + ";base64," + im.data } })),
    ] }],
  };
  const r = await fetch(ENDPOINT, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const ctype = r.headers.get("content-type") || "";
  if (!r.ok || /text\/html/.test(ctype)) {
    const raw = await r.text();
    let msg = raw.slice(0, 300);
    try { const j = JSON.parse(raw); msg = (j.error && (j.error.message || j.error)) || j.detail || j.message || msg; } catch (e) {}
    const title = (raw.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];
    if (title) msg = 'Got a web page ("' + title.trim() + '") — Cloudflare blocked the request. Check CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.';
    const e = new Error(typeof msg === "string" ? msg : JSON.stringify(msg)); e.status = r.status; e.url = ENDPOINT; throw e;
  }
  if (/application\/json/.test(ctype)) {
    const j = await r.json();
    return ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }
  const reader = r.body.getReader(); const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let j; try { j = JSON.parse(data); } catch (e) { continue; }
      if (j.error) { const e = new Error(j.error.message || JSON.stringify(j.error)); e.status = 502; e.url = ENDPOINT; throw e; }
      const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
      if (d && typeof d.content === "string") text += d.content;
    }
  }
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

module.exports = { ENDPOINT, KEY, CF_ID, CF_SECRET, MODELS, MAX_IMAGES, complete };
