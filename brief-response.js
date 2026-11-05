// POST /api/brief-response — public: developers send music picks, licensed-music links, notes,
// and per-shot suggestions (optionally with a screenshot). The publisher gets an email.
const store = require("./_store");
const mail = require("./_mail");
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
const okUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href.slice(0, 600) : ""; } catch (e) { return ""; } };
const okImg = (d) => (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(d || "")) && String(d).length < 900000 ? String(d) : "");

function cleanShotNotes(raw) {
  const out = {};
  let imgs = 0;
  for (const [k, v] of Object.entries(raw || {}).slice(0, 200)) {
    const key = clip(k, 40);
    if (typeof v === "string") { if (v.trim()) out[key] = { text: clip(v, 2000) }; continue; }
    if (!v || typeof v !== "object") continue;
    const image = imgs < 6 ? okImg(v.image) : "";
    if (image) imgs++;
    const text = clip(v.text, 2000);
    if (text.trim() || image) out[key] = { text, sid: clip(v.sid, 40), image };
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!store.ready()) return res.status(500).json({ error: "Responses aren't set up yet — please email your notes to indie.io." });
  const b = req.body || {};
  if (!store.validId(b.id)) return res.status(400).json({ error: "This brief link isn't valid." });
  if (JSON.stringify(b).length > 4000000) return res.status(413).json({ error: "That's too much for one response — try fewer or smaller screenshots." });
  if (b.website) return res.status(200).json({ ok: true }); // honeypot for bots
  try {
    const brief = await store.latestBrief(b.id);
    if (!brief) return res.status(404).json({ error: "This brief wasn't found." });
    const clean = {
      name: clip(b.name, 120), studio: clip(b.studio, 120), email: clip(b.email, 200),
      musicChoice: clip(b.musicChoice, 600),
      musicChoices: b.musicChoices && typeof b.musicChoices === "object" ? Object.fromEntries(Object.entries(b.musicChoices).slice(0, 10).map(([k, v]) => [clip(k, 40), clip(v, 300)]).filter(([, v]) => v)) : null,
      licensedMusic: (Array.isArray(b.licensedMusic) ? b.licensedMusic : []).slice(0, 10).map((m) => ({ title: clip(m.title, 200), link: okUrl(m.link), license: clip(m.license, 500) })).filter((m) => m.title || m.link),
      footageUploaded: !!b.footageUploaded,
      notes: clip(b.notes, 8000),
      shotNotes: cleanShotNotes(b.shotNotes),
      receivedAt: new Date().toISOString(),
    };
    const stamp = clean.receivedAt.replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 8);
    await store.putJSON("responses/" + b.id + "/" + stamp + ".json", clean);
    let emailed = false, emailError = "";
    try { emailed = !!(await notify(req, b.id, brief, clean)).id; if (!emailed) emailError = mail.ready() ? "no recipient" : "RESEND_API_KEY not set"; }
    catch (e) { emailError = e.message; console.error("notify failed:", e.message); }
    if (!emailed) { clean.emailError = emailError; try { await store.putJSON("responses/" + b.id + "/" + stamp + ".json", clean); } catch (e) {} }
    return res.status(200).json({ ok: true, emailed });
  } catch (e) {
    return res.status(502).json({ error: "Couldn't save your response (" + (e.message || e) + "). Please try again." });
  }
};

async function notify(req, id, brief, r) {
  const to = process.env.NOTIFY_EMAIL || brief.notifyEmail || brief.updatedBy;
  if (!mail.ready() || !to) return {};
  const e = mail.esc, shots = {};
  (brief.cuts || []).forEach((c) => (c.shots || []).forEach((s, i) => { shots[s.key] = Object.assign({ num: i + 1, cut: c.label }, s); }));
  const base = (process.env.TOOL_BASE_URL || ("https://" + (req.headers["x-forwarded-host"] || req.headers.host))).replace(/\/+$/, "");
  const att = [];
  const blocks = Object.entries(r.shotNotes).map(([key, n], i) => {
    const s = shots[key] || {};
    let refImg = "", theirImg = "";
    const a1 = s.still && mail.dataUrlAttachment(s.still, key + "_reference.jpg", "ref" + i); if (a1) { att.push(a1); refImg = `<img src="cid:ref${i}" alt="Current reference" width="260" style="border-radius:8px;display:block">`; }
    const a2 = n.image && mail.dataUrlAttachment(n.image, key + "_their_screenshot." + (n.image.includes("png") ? "png" : "jpg"), "dev" + i); if (a2) { att.push(a2); theirImg = `<img src="cid:dev${i}" alt="Their screenshot" width="260" style="border-radius:8px;display:block">`; }
    return `<tr><td style="padding:14px 0;border-top:1px solid #e5e5ea">
      <div style="font:600 13px -apple-system,Segoe UI,sans-serif;color:#373278">${e(s.cut || "")} · Shot ${String(s.num || "?").padStart(2, "0")} (${e(key)})</div>
      <div style="font:15px -apple-system,Segoe UI,sans-serif;color:#6e6e73;margin:4px 0 8px">${e(s.desc || "")}</div>
      <div style="font:16px -apple-system,Segoe UI,sans-serif;color:#1d1d1f;background:#f5f5f7;border-radius:10px;padding:10px 12px;margin-bottom:8px">“${e(n.text || "(screenshot only)")}”</div>
      <table role="presentation"><tr>${refImg ? `<td style="padding-right:10px;vertical-align:top"><div style="font:12px sans-serif;color:#6e6e73">Current reference</div>${refImg}</td>` : ""}${theirImg ? `<td style="vertical-align:top"><div style="font:12px sans-serif;color:#6e6e73">Their screenshot</div>${theirImg}</td>` : ""}</tr></table>
    </td></tr>`;
  }).join("");
  const who = [r.name, r.studio].filter(Boolean).join(" · ") || "A developer";
  const html = `<div style="max-width:640px;margin:0 auto;font:15px -apple-system,Segoe UI,Helvetica,sans-serif;color:#1d1d1f">
    <p style="color:#6e6e73;font-size:13px;margin:0">indie.io · developer feedback</p>
    <h1 style="font-size:24px;margin:6px 0 4px">${e(brief.game)}</h1>
    <p style="margin:0 0 16px">${e(who)} sent feedback on the capture brief${r.footageUploaded ? " · <b>footage uploaded ✓</b>" : ""}.</p>
    ${r.musicChoices && Object.keys(r.musicChoices).length ? `<p><b>Music picks:</b></p><ul>${Object.entries(r.musicChoices).map(([k, v]) => `<li><b>${e(k)}:</b> ${e(v)}</li>`).join("")}</ul>` : (r.musicChoice ? `<p><b>Music pick:</b> ${e(r.musicChoice)}</p>` : "")}
    ${r.licensedMusic.length ? `<p><b>Licensed music they suggest:</b></p><ul>${r.licensedMusic.map((m) => `<li>${e(m.title || "Track")}${m.link ? ` — <a href="${e(m.link)}">${e(m.link)}</a>` : ""}${m.license ? ` (${e(m.license)})` : ""}</li>`).join("")}</ul>` : ""}
    ${r.notes ? `<p><b>Notes:</b><br>${e(r.notes).replace(/\n/g, "<br>")}</p>` : ""}
    ${blocks ? `<h2 style="font-size:18px;margin:20px 0 4px">Shot suggestions</h2><table role="presentation" width="100%">${blocks}</table>` : ""}
    <p style="margin-top:22px"><a href="${e(base)}/?brief=${e(id)}&replies=1" style="background:#373278;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;display:inline-block">Open in the Tech Script Generator</a></p>
    <p style="color:#6e6e73;font-size:13px">Developer page: <a href="${e(base)}/b/${e(id)}">${e(base)}/b/${e(id)}</a></p></div>`;
  const text = `${brief.game} — ${who} sent feedback.\n` + (r.musicChoice ? `Music pick: ${r.musicChoice}\n` : "") + (r.notes ? `Notes: ${r.notes}\n` : "") +
    Object.entries(r.shotNotes).map(([k, n]) => `${k}: ${n.text || "(screenshot)"}`).join("\n") + `\nOpen in the tool: ${base}/?brief=${id}&replies=1`;
  return mail.send({ to, subject: `${brief.game}: feedback from ${who}`, html, text, attachments: att });
}
