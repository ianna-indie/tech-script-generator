// Shared settings for the AI backend. Works with Anthropic directly, or with your own
// API / gateway in either Anthropic-style (/v1/messages) or OpenAI-style (/v1/chat/completions) format.
const cleanKey = (k) => String(k || "").trim().replace(/^['"]+|['"]+$/g, "").trim();

const BASE = (process.env.LLM_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
// "auto" (default when LLM_BASE_URL is set) tries Anthropic-style and OpenAI-style endpoints and the usual auth headers.
let FORMAT = (process.env.LLM_FORMAT || (process.env.LLM_BASE_URL ? "auto" : "anthropic")).toLowerCase();
let AUTH = (process.env.LLM_AUTH || (FORMAT === "openai" ? "bearer" : FORMAT === "auto" ? "auto" : "x-api-key")).toLowerCase();
let DETECTED = null; // {format, auth, path}
const KEY = cleanKey(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY);

const MODELS = {
  quick: process.env.CLAUDE_MODEL_QUICK || process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
  default: process.env.CLAUDE_MODEL || "claude-sonnet-5",
  complex: process.env.CLAUDE_MODEL_COMPLEX || process.env.CLAUDE_MODEL || "claude-sonnet-5",
};

function authHeaders(auth = AUTH, format = FORMAT) {
  const h = {};
  if (auth === "bearer") h.Authorization = "Bearer " + KEY;
  else if (auth === "api-key") h["api-key"] = KEY;
  else h["x-api-key"] = KEY;
  if (format === "anthropic") h["anthropic-version"] = "2023-06-01";
  return h;
}

function endpoint(path) {
  // Accept a base URL with or without /v1, or the full endpoint itself.
  if (/\/(messages|chat\/completions)$/.test(BASE)) return BASE;
  return /\/v1$/.test(BASE) ? BASE + path.replace(/^\/v1/, "") : BASE + path;
}

function buildBody(format, model, max_tokens, prompt, images) {
  if (format === "openai") return { model, max_tokens, messages: [{ role: "user", content: [
    ...images.map((im) => ({ type: "image_url", image_url: { url: "data:" + (im.media_type || "image/jpeg") + ";base64," + im.data } })),
    { type: "text", text: prompt } ] }] };
  return { model, max_tokens, messages: [{ role: "user", content: [
    ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data } })),
    { type: "text", text: prompt } ] }] };
}
function parseText(format, j) {
  if (format === "openai") { const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content; return typeof c === "string" ? c : JSON.stringify(c || ""); }
  if (Array.isArray(j.content)) return j.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return j.text || j.output || j.completion || JSON.stringify(j);
}
async function call({ format, auth, url }, { prompt, images = [], tier = "default", maxTokens }) {
  const model = MODELS[tier] || MODELS.default;
  const max_tokens = maxTokens || Number(process.env.CLAUDE_MAX_TOKENS) || 16000;
  const r = await fetch(url, { method: "POST", headers: Object.assign({ "content-type": "application/json" }, authHeaders(auth, format)), body: JSON.stringify(buildBody(format, model, max_tokens, prompt, images)) });
  const raw = await r.text(); let j = {}; try { j = JSON.parse(raw); } catch (e) {}
  if (!r.ok) {
    const msg = (j.error && (j.error.message || j.error)) || j.message || j.detail || raw.slice(0, 200) || ("HTTP " + r.status);
    const e = new Error(String(typeof msg === "string" ? msg : JSON.stringify(msg))); e.status = r.status; e.url = url; throw e;
  }
  if (!raw.trim().startsWith("{")) { const e = new Error("Got a non-JSON reply (is this the API address, not a web page?)"); e.status = r.status; e.url = url; throw e; }
  return parseText(format, j);
}
function candidates() {
  const fmts = FORMAT === "auto" ? ["anthropic", "openai"] : [FORMAT];
  const auths = AUTH === "auto" ? ["bearer", "x-api-key", "api-key"] : [AUTH];
  const out = [];
  for (const f of fmts) {
    const p = f === "openai" ? "/v1/chat/completions" : "/v1/messages";
    const urls = /\/(messages|chat\/completions)$/.test(BASE) ? [BASE] : [endpoint(p), BASE + "/api" + p];
    for (const u of urls) for (const a of auths) out.push({ format: f, auth: a, url: u });
  }
  return out;
}
async function complete(opts) {
  if (DETECTED) return call(DETECTED, opts);
  const tries = candidates(); let last = null;
  for (const c of tries) {
    try { const t = await call(c, opts); DETECTED = c; return t; }
    catch (e) {
      last = e;
      // Only keep probing on "wrong endpoint / wrong auth" style errors; stop on real failures from a working endpoint.
      if (tries.length === 1 || ![400, 401, 403, 404, 405, 415, 422].includes(e.status) && !/non-JSON/.test(e.message)) throw e;
    }
  }
  throw last;
}
const detected = () => DETECTED;

module.exports = { BASE, get FORMAT(){ return DETECTED ? DETECTED.format : FORMAT; }, get AUTH(){ return DETECTED ? DETECTED.auth : AUTH; }, KEY, MODELS, complete, endpoint, authHeaders, detected, candidates };
