# Tech Script Generator — Vercel version

Brief + footage in → indie.io-branded tech script out (RDA / Launch tabs, stills embedded,
Brief & Rubric hidden, columns C+ at 444 px, shot rows at 250 px).

This version runs outside Claude, so it can **stream Google Drive videos straight into the
player**: preview, scrub, press **C** to capture, and automatic frame scanning all work on
linked Drive footage — nothing is downloaded.

## What's in the folder

| File | What it does |
|---|---|
| `index.html` | The whole app (UI, capture workspace, export). |
| `sw.js` | Service worker that streams Drive videos with your Google token (enables preview + capture). |
| `api/claude.js` | Server route that sends prompts/stills to Claude. Holds the Anthropic key; only indie.io Google accounts can call it. |
| `api/config.js` | Gives the page the Google client ID. |
| `vercel.json` | Function timeout + service-worker headers. |
| `.env.example` | The environment variables to set in Vercel. |

---

## Setup (about 20 minutes, once)

### 1. Google Cloud — "Sign in with Google" + Drive access

1. Go to **console.cloud.google.com** → create a project (e.g. `iio-tech-script`), or reuse one.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**
   - User type: **Internal** (indie.io Workspace only — no Google review needed).
   - App name: `Tech Script Generator`, support email: yours.
   - Scopes: add `openid`, `email`, `.../auth/drive.readonly`, `.../auth/drive.file`.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: your Vercel URL, e.g. `https://tech-script-generator.vercel.app`
     (add `http://localhost:3000` too if you'll test locally)
   - Redirect URIs: leave empty.
   - Copy the **Client ID**.

> If "Internal" isn't available, the Google project isn't inside the indie.io Workspace —
> ask IT to create it under the organization.

### 2. Anthropic API key

console.anthropic.com → **API Keys** → create a key (use the indie.io org/billing).

### 3. Deploy to Vercel

**Option A — dashboard (no terminal)**
1. Put this folder in a GitHub repo (or add it to the iio-tools repo as its own folder).
2. vercel.com → **Add New → Project** → import the repo → set **Root Directory** to this folder.
3. **Environment Variables**: add `ANTHROPIC_API_KEY` and `GOOGLE_CLIENT_ID`
   (optional: `ALLOWED_DOMAIN`, model overrides — see `.env.example`).
4. **Deploy**.

**Option B — Vercel CLI**
```bash
npm i -g vercel
cd tech-script-generator
vercel                     # first deploy, follow prompts
vercel env add ANTHROPIC_API_KEY
vercel env add GOOGLE_CLIENT_ID
vercel --prod
```

After the first deploy, copy the production URL into the Google OAuth client's
**Authorized JavaScript origins** (step 1.4) if you hadn't already.

---

## Using it

1. Open the site → **Sign in with Google** (left panel). Use your indie.io account.
2. **Brief** → fill in, tick **RDA + Launch**.
3. **Sources** → paste Drive file/folder links (or **Browse Google Drive**). Linked videos show
   "streams from Drive".
4. **Analyse** → Claude plans the shots and auto-picks distinct stills from the streamed footage.
5. **Review** → **Capture from source** or **Open capture workspace**: the Drive video plays in
   the tool; scrub, press **C**, and the frame becomes an option for that shot.
6. **Music** → finds Drive tracks + Envato searches (at least 2 tracks).
7. **Export** → **Create Google Sheet** (pick the folder) or **Download .xlsx**.

## Notes & limits

- **Codecs:** the browser must be able to decode the file. H.264/AAC `.mp4`/`.mov` (OBS default)
  play fine; **ProRes and some HEVC files won't** — use an H.264 proxy for those.
- **First load:** the service worker needs one page load to activate. If a Drive clip says
  "Reload the page once…", reload and try again.
- **Speed:** scanning a long clip seeks through Drive many times; big 4K files scan slower.
- **Timeouts:** `vercel.json` sets the Claude route to 300 s. If your Vercel plan rejects that,
  lower it to 60.
- **Who can use it:** only Google accounts ending in `@indie.io` (change with `ALLOWED_DOMAIN`).
  The Anthropic key never reaches the browser.
- **Envato:** no public Envato search API, so the tool opens ready-made searches; paste the
  chosen track link back in.
- Drafts are saved in each person's browser (IndexedDB), not on the server.
