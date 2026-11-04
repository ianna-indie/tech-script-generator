// Saved projects, per indie.io account (Vercel Blob).
// GET    /api/projects          → your projects (newest first)
// GET    /api/projects?id=…     → one project's saved data
// POST   /api/projects          → save { id?, name, data } — keeps the last 5 versions
// DELETE /api/projects?id=…     → delete a project
const crypto = require("crypto");
const store = require("./_store");
const verifyGoogle = require("./_auth");
const newId = () => Array.from({ length: 12 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");
const userKey = (email) => crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 20);
const enc = (s) => Buffer.from(String(s || "Untitled").slice(0, 80)).toString("base64url");
const dec = (s) => { try { return Buffer.from(s, "base64url").toString(); } catch (e) { return "Untitled"; } };
// pathname: projects/<user>/<projectId>/<stamp>__<name>.json  — lets us list names without reading files
function parse(pathname) {
  const m = String(pathname).match(/^projects\/[^/]+\/([a-z0-9]+)\/([^_]+)__([A-Za-z0-9_-]*)\.json$/);
  return m ? { id: m[1], stamp: m[2], name: dec(m[3]) } : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!store.ready()) return res.status(500).json({ error: "Saving needs the Vercel Blob store. In Vercel: Storage → Create → Blob → connect, then redeploy." });
  const email = await verifyGoogle(req);
  if (!email) return res.status(401).json({ error: "Sign in with your indie.io Google account." });
  const base = "projects/" + userKey(email) + "/";
  try {
    const id = String((req.query && req.query.id) || "");
    if (req.method === "GET" && !id) {
      const all = await store.listAll(base);
      const latest = {};
      for (const b of all) { const p = parse(b.pathname); if (!p) continue; if (!latest[p.id] || p.stamp > latest[p.id].stamp) latest[p.id] = Object.assign(p, { size: b.size }); }
      const list = Object.values(latest).sort((a, b) => b.stamp.localeCompare(a.stamp))
        .map((p) => ({ id: p.id, name: p.name, savedAt: p.stamp.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1T$2:$3:$4.$5Z"), size: p.size }));
      return res.status(200).json({ projects: list });
    }
    if (req.method === "GET") {
      if (!/^[a-z0-9]{6,32}$/.test(id)) return res.status(400).json({ error: "Invalid project id." });
      const all = (await store.listAll(base + id + "/")).filter((b) => parse(b.pathname));
      if (!all.length) return res.status(404).json({ error: "Project not found." });
      all.sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)));
      const iso = (st) => st.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1T$2:$3:$4.$5Z");
      if (req.query.versions) return res.status(200).json({ versions: all.map((b) => { const p = parse(b.pathname); return { v: p.stamp, savedAt: iso(p.stamp), name: p.name, size: b.size }; }) });
      const pick = req.query.v ? all.find((b) => parse(b.pathname).stamp === String(req.query.v)) : all[0];
      if (!pick) return res.status(404).json({ error: "That version is no longer kept." });
      const data = await store.readJSON(pick.url || pick.pathname);
      if (!data) return res.status(502).json({ error: "Couldn't read the saved project." });
      return res.status(200).json({ id, name: parse(pick.pathname).name, savedAt: iso(parse(pick.pathname).stamp), data });
    }
    if (req.method === "POST") {
      const b = req.body || {};
      if (!b.data || typeof b.data !== "object") return res.status(400).json({ error: "Nothing to save." });
      const pid = /^[a-z0-9]{6,32}$/.test(String(b.id || "")) ? b.id : newId();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await store.putJSON(base + pid + "/" + stamp + "__" + enc(b.name) + ".json", b.data);
      // keep the 5 newest versions
      const all = (await store.listAll(base + pid + "/")).sort((a, c) => String(c.pathname).localeCompare(String(a.pathname)));
      await store.remove(all.slice(5).map((x) => x.url || x.pathname)).catch(() => {});
      return res.status(200).json({ id: pid, savedAt: new Date().toISOString() });
    }
    if (req.method === "DELETE") {
      if (!/^[a-z0-9]{6,32}$/.test(id)) return res.status(400).json({ error: "Invalid project id." });
      const all = await store.listAll(base + id + "/");
      await store.remove(all.map((x) => x.url || x.pathname));
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Use GET, POST or DELETE." });
  } catch (e) {
    return res.status(502).json({ error: "Storage error: " + (e.message || e) });
  }
};
