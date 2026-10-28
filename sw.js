/* Tech Script Generator — streams Google Drive videos into the page.
   The page posts your Google access token here; requests to /drive-stream/<fileId>
   are forwarded to the Drive API with that token and Range headers, so the video
   player can seek and frames can be captured without downloading whole files. */
let TOKEN = null;
const sizes = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "token") {
    TOKEN = e.data.token;
    if (e.ports && e.ports[0]) e.ports[0].postMessage("ok");
  }
});

// Ask an open page for a (fresh) token — covers the worker being restarted or the token expiring.
async function askForToken(clientId, expired) {
  const list = clientId ? [await self.clients.get(clientId)].filter(Boolean) : [];
  const all = list.length ? list : await self.clients.matchAll({ type: "window" });
  for (const c of all) {
    const t = await new Promise((res) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => res(e.data && e.data.token);
      c.postMessage({ type: "need-token", expired: !!expired }, [ch.port2]);
      setTimeout(() => res(null), 8000);
    });
    if (t) { TOKEN = t; return t; }
  }
  return null;
}

async function fileSize(id) {
  if (sizes.has(id)) return sizes.get(id);
  const r = await fetch("https://www.googleapis.com/drive/v3/files/" + id + "?fields=size&supportsAllDrives=true", { headers: { Authorization: "Bearer " + TOKEN } });
  const j = await r.json();
  const n = Number(j.size) || null;
  sizes.set(id, n);
  return n;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const m = url.pathname.match(/^\/drive-stream\/([A-Za-z0-9_-]+)/);
  if (!m) return;
  event.respondWith((async () => {
    if (!TOKEN) await askForToken(event.clientId, false);
    if (!TOKEN) return new Response("Not signed in", { status: 401 });
    const id = m[1];
    const range = event.request.headers.get("range");
    const get = () => {
      const headers = { Authorization: "Bearer " + TOKEN };
      if (range) headers.Range = range;
      return fetch("https://www.googleapis.com/drive/v3/files/" + id + "?alt=media&supportsAllDrives=true", { headers });
    };
    let res = await get();
    if (res.status === 401 && (await askForToken(event.clientId, true))) res = await get(); // token expired — refresh once
    if (!res.ok && res.status !== 206) return new Response("Drive: " + (await res.text()), { status: res.status });
    const out = new Headers();
    out.set("Content-Type", res.headers.get("content-type") || "video/mp4");
    out.set("Accept-Ranges", "bytes");
    const len = res.headers.get("content-length");
    if (len) out.set("Content-Length", len);
    let cr = res.headers.get("content-range");
    if (res.status === 206 && !cr && range) {
      const total = Number(url.searchParams.get("size")) || (await fileSize(id));
      const start = Number((range.match(/bytes=(\d+)-/) || [])[1] || 0);
      const end = len ? start + Number(len) - 1 : (total ? total - 1 : "");
      cr = "bytes " + start + "-" + end + "/" + (total || "*");
    }
    if (cr) out.set("Content-Range", cr);
    return new Response(res.body, { status: res.status, headers: out });
  })());
});
