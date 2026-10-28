// GET  /api/brief?id=…  — public: the developer brief page reads its content here.
// POST /api/brief       — indie.io only: publish or update a brief. Body: { id?, brief }.
const store = require("./_store");
const verifyGoogle = require("./_auth");
const newId = () => Array.from({ length: 16 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!store.ready()) return res.status(500).json({ error: "Brief pages need a Vercel Blob store. In Vercel: Storage → Create → Blob → connect it to this project, then redeploy." });
  try {
    if (req.method === "GET") {
      const id = String(req.query.id || "");
      if (!store.validId(id)) return res.status(400).json({ error: "This brief link isn't valid." });
      const b = await store.latestBrief(id);
      if (!b) return res.status(404).json({ error: "This brief wasn't found. It may have been removed — ask indie.io for a new link." });
      return res.status(200).json(b);
    }
    if (req.method === "POST") {
      const email = await verifyGoogle(req);
      if (!email) return res.status(401).json({ error: "Sign in with your indie.io Google account." });
      const { id: givenId, brief } = req.body || {};
      if (!brief || !brief.game) return res.status(400).json({ error: "Missing brief content." });
      const id = store.validId(givenId) ? givenId : newId();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await store.putJSON("briefs/" + id + "/" + stamp + ".json", Object.assign({}, brief, { id, updatedAt: new Date().toISOString(), updatedBy: email }));
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const proto = req.headers["x-forwarded-proto"] || "https";
      return res.status(200).json({ id, url: proto + "://" + host + "/b/" + id });
    }
    return res.status(405).json({ error: "Use GET or POST." });
  } catch (e) {
    return res.status(502).json({ error: "Storage error: " + (e.message || e) });
  }
};
