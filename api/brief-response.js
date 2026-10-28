// POST /api/brief-response — public: developers send music picks, licensed-music links and notes.
const store = require("./_store");
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
const okUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href.slice(0, 600) : ""; } catch (e) { return ""; } };

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!store.ready()) return res.status(500).json({ error: "Responses aren't set up yet — please email your notes to indie.io." });
  const b = req.body || {};
  if (!store.validId(b.id)) return res.status(400).json({ error: "This brief link isn't valid." });
  if (JSON.stringify(b).length > 60000) return res.status(413).json({ error: "That's too much text for one response — please split it." });
  if (b.website) return res.status(200).json({ ok: true }); // honeypot for bots
  try {
    const exists = (await store.listAll("briefs/" + b.id + "/")).length > 0;
    if (!exists) return res.status(404).json({ error: "This brief wasn't found." });
    const clean = {
      name: clip(b.name, 120), studio: clip(b.studio, 120), email: clip(b.email, 200),
      musicChoice: clip(b.musicChoice, 300),
      licensedMusic: (Array.isArray(b.licensedMusic) ? b.licensedMusic : []).slice(0, 10).map((m) => ({ title: clip(m.title, 200), link: okUrl(m.link), license: clip(m.license, 500) })).filter((m) => m.title || m.link),
      footageUploaded: !!b.footageUploaded,
      notes: clip(b.notes, 8000),
      shotNotes: Object.fromEntries(Object.entries(b.shotNotes || {}).slice(0, 200).map(([k, v]) => [clip(k, 20), clip(v, 1000)]).filter(([, v]) => v)),
      receivedAt: new Date().toISOString(),
    };
    const stamp = clean.receivedAt.replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 8);
    await store.putJSON("responses/" + b.id + "/" + stamp + ".json", clean);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: "Couldn't save your response (" + (e.message || e) + "). Please try again." });
  }
};
