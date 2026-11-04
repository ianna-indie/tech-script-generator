// GET  /api/brief?id=…  — public: the developer brief page reads its content here.
// POST /api/brief       — indie.io only: publish or update a brief. Body: { id?, brief }.
const store = require("./_store");
const verifyGoogle = require("./_auth");
const rand = (n) => Array.from({ length: n }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");
// Readable, unguessable ids: "outcity-rda-launch-k3m9x2p7"
const newId = (brief) => {
  const slug = [brief.game, ...(brief.cuts || []).map((c) => c.label)].join(" ").toLowerCase()
    .normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36).replace(/-+$/, "");
  return (slug ? slug + "-" : "") + rand(8);
};

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
      const id = store.validId(givenId) ? givenId : newId(brief);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await store.putJSON("briefs/" + id + "/" + stamp + ".json", Object.assign({}, brief, { id, updatedAt: new Date().toISOString(), updatedBy: email }));
      // BRIEF_BASE_URL lets links use a friendlier domain (e.g. https://iio-creative.vercel.app) than the one the tool runs on.
      const base = (process.env.BRIEF_BASE_URL || "").replace(/\/+$/, "") ||
        ((req.headers["x-forwarded-proto"] || "https") + "://" + (req.headers["x-forwarded-host"] || req.headers.host));
      return res.status(200).json({ id, url: base + "/b/" + id });
    }
    return res.status(405).json({ error: "Use GET or POST." });
  } catch (e) {
    return res.status(502).json({ error: "Storage error: " + (e.message || e) });
  }
};
