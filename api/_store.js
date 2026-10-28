// Storage for developer brief pages and their responses (Vercel Blob).
// Connect a Blob store in Vercel (Storage → Create → Blob → connect to this project) — that adds BLOB_READ_WRITE_TOKEN.
const blob = require("@vercel/blob");
let ACCESS = (process.env.BLOB_ACCESS || "private").toLowerCase();

function ready() { return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID); }

async function putJSON(pathname, data) {
  const body = JSON.stringify(data);
  try {
    return await blob.put(pathname, body, { access: ACCESS, contentType: "application/json", addRandomSuffix: false });
  } catch (e) {
    // Older/public-only stores reject private blobs (and vice versa) — switch once and remember.
    if (/access|public|private/i.test(String(e.message))) {
      ACCESS = ACCESS === "private" ? "public" : "private";
      return await blob.put(pathname, body, { access: ACCESS, contentType: "application/json", addRandomSuffix: false });
    }
    throw e;
  }
}

async function readJSON(urlOrPath) {
  for (const access of [ACCESS, ACCESS === "private" ? "public" : "private"]) {
    try {
      const r = await blob.get(urlOrPath, { access, useCache: false });
      if (!r) continue;
      const text = await new Response(r.stream).text();
      return JSON.parse(text);
    } catch (e) { /* try the other access type */ }
  }
  return null;
}

async function listAll(prefix) {
  const out = []; let cursor;
  do {
    const r = await blob.list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs); cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  return out;
}

const validId = (id) => /^[a-z0-9]{10,32}$/.test(String(id || ""));

async function latestBrief(id) {
  if (!validId(id)) return null;
  const items = await listAll("briefs/" + id + "/");
  if (!items.length) return null;
  items.sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)));
  return readJSON(items[0].url || items[0].pathname);
}

module.exports = { ready, putJSON, readJSON, listAll, latestBrief, validId };
