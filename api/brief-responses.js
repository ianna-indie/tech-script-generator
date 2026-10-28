// GET /api/brief-responses?id=… — indie.io only: everything developers sent for a brief.
const store = require("./_store");
const verifyGoogle = require("./_auth");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!store.ready()) return res.status(500).json({ error: "No Vercel Blob store connected." });
  const email = await verifyGoogle(req);
  if (!email) return res.status(401).json({ error: "Sign in with your indie.io Google account." });
  const id = String(req.query.id || "");
  if (!store.validId(id)) return res.status(400).json({ error: "Invalid brief id." });
  try {
    const items = await store.listAll("responses/" + id + "/");
    items.sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)));
    const out = [];
    for (const it of items.slice(0, 200)) { const j = await store.readJSON(it.url || it.pathname); if (j) out.push(j); }
    return res.status(200).json({ responses: out });
  } catch (e) {
    return res.status(502).json({ error: "Storage error: " + (e.message || e) });
  }
};
