# Tech Script Generator — Vercel version (Rupert)

Brief + Drive footage in → indie.io-branded tech script out (RDA / Launch tabs, stills embedded,
Brief & Rubric hidden, columns C+ at 444 px, shot rows at 250 px). Drive videos stream into the
player for preview, capture (press **C**) and automatic frame scanning — nothing is downloaded.
AI runs on **Rupert** (rupert.indie.io), indie.io's own model server.

## Files

| File | What it does |
|---|---|
| `index.html` | The app. |
| `sw.js` | Streams Drive videos with your Google sign-in (preview + capture). |
| `api/_llm.js` | Rupert connection (Cloudflare service token + Rupert key, streaming). |
| `api/claude.js` | The route the app calls for AI. Only @indie.io Google accounts can use it. |
| `api/health.js` | Open `/api/health` to check the Rupert connection. |
| `api/config.js` | Gives the page the Google client ID. |
| `brief.html` | The developer page (`/b/<id>`): tabs per trailer, recording tips, music with preview + choose. |
| `vendor/` | ExcelJS, JSZip, the MP3 encoder (music previews) and the PSD reader, bundled so nothing depends on a CDN. |
| `api/brief.js`, `api/brief-response.js`, `api/brief-responses.js` | Publish briefs, receive and read developer replies. |
| `api/projects.js` | Saved projects per indie.io account (Save, Projects, autosave). |
| `api/_store.js`, `api/_auth.js` | Blob storage + indie.io sign-in check. |
| `middleware.js`, `login.html`, `api/session.js` | Keep the tool private to indie.io accounts; `/b/…` pages stay public. |
| `vercel.json` | Timeout, `/b/<id>` route, service-worker headers. |

## Environment variables (Vercel → project → Environment Variables → Production)

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (`…apps.googleusercontent.com`) |
| `LLM_API_KEY` | Your Rupert key — Rupert → Settings → Account → API Keys (`sk-…`) |
| `CF_ACCESS_CLIENT_ID` | Cloudflare service token ID (from Evan, 1Password) |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare service token secret (from Evan, 1Password) |

Optional: `LLM_MODEL` (default `qwen3.8:27b` — must accept images; **not** `deepseek-v4-flash`),
`LLM_BASE_URL` (default `https://rupert.indie.io/api/v1/chat/completions`), `LLM_MAX_IMAGES`
(default 10), `LLM_MAX_TOKENS` (default 8000), `ALLOWED_DOMAIN` (default `indie.io`).

You can delete the old `ANTHROPIC_API_KEY` variable — it isn't used any more.
After adding or changing variables: **Deployments → ⋯ → Redeploy**.

The Cloudflare token expires **2027-10-19** — ask for a new one before then.

## Developer brief pages (Share step) — one-off setup

Brief pages and developer replies are stored in **Vercel Blob**:
1. Vercel → your project → **Storage** → **Create** → **Blob** → name it (e.g. `tech-script-briefs`) → **Connect** to this project.
   That adds `BLOB_READ_WRITE_TOKEN` automatically.
2. Redeploy.

Brief links look like `https://iio-creative.vercel.app/b/outcity-rda-launch-k3m9x2p7` once you add a friendlier domain:
Vercel → project → **Settings → Domains → Add** → e.g. `iio-creative.vercel.app` (any free `*.vercel.app` name), then set
`BRIEF_BASE_URL=https://iio-creative.vercel.app` and redeploy. A custom domain like `briefs.indie.io` works the same way (needs a DNS record from IT). Anyone with the link can view the page and send
a reply (no sign-in), so share it only with the dev team. Publishing again keeps the same link.

## Email when developers reply

1. Sign up at **resend.com** with your indie.io email → **API Keys → Create** → copy the key (`re_…`).
2. Vercel → Environment Variables: `RESEND_API_KEY` = that key. Redeploy.
Replies are emailed to whoever published the brief (or `NOTIFY_EMAIL` if set), with each suggestion, the shot's current reference
image, the developer's screenshot, and an **Open in the Tech Script Generator** button that jumps straight to the replies.
Until you verify a sending domain in Resend, mail comes from Resend's test address and only reaches the email you signed up with —
fine for you; set `NOTIFY_FROM` (e.g. `Tech Scripts <briefs@indie.io>`) after verifying indie.io to send from your own domain.

## Keep the tool private (indie.io only)

The tool (`/`) only opens for signed-in indie.io accounts; developer pages (`/b/…`) stay public.
Set `SESSION_SECRET` in Vercel (Production) to a long random string — at least 24 characters, e.g. from a password
generator — and redeploy. Visitors without a session land on a "Sign in with Google" page; anyone outside indie.io is refused.
Sessions last 7 days; **Sign out** in the sidebar ends it. Without `SESSION_SECRET`, the tool stays locked behind the login page.

## Saving progress

**Save** (sidebar, or ⌘S / Ctrl+S) stores the whole project — brief, footage links, shots, stills, supers, music, share settings —
to your indie.io account. It also autosaves 30 s after you stop editing. **Projects** lists everything you've saved: open, or delete.
Each account only sees its own projects. The last 5 versions of each are kept. Uses the same Vercel Blob store as brief pages.

## Check it

Open `https://<your-app>.vercel.app/api/health`. Look for:
- `cloudflareIdSet: true`, `cloudflareSecretSet: true`, `rupertKeySet: true`
- `testCall: "Working ✔ …"`

If it says Cloudflare blocked the request, re-check the two `CF_ACCESS_…` values.
If it mentions an image limit, set `LLM_MAX_IMAGES` to the number it gives.

## Google Cloud setup (one-off, already done if sign-in works)

console.cloud.google.com → enable **Google Drive API** → OAuth consent screen **Internal** with scopes
`openid`, `email`, `drive.readonly`, `drive.file` → Credentials → **OAuth client ID (Web)** with your
Vercel URL in **Authorized JavaScript origins**.

## What happens automatically (no action needed)

- Messy AI answers (extra text, stray commas, cut-off lists) are cleaned up; one automatic repair pass if needed.
- If Rupert accepts fewer images per request, the request is retried within its limit.
- One automatic retry if Rupert is busy or restarting.
- Stills sent to the AI are shrunk to stay under Vercel's 4.5 MB request limit.
- Drive streaming re-fetches your Google sign-in if it expires mid-session.
- Footage that looks the same throughout still yields at least 8 stills per clip.

## Supers (on-screen text)

The **Supers** step designs text cards in the game's look (font, colours, plate, position — or **Suggest a look from the brief**).
They're overlaid on stills in the sheet and the brief page, and **Download supers** gives:
- `svg/` — editable vector cards (live text, Plate/Text layers) for Illustrator → save as .ai → import into After Effects
- `png_transparent/` — 1920×1080 overlays
- `after_effects/build_supers.jsx` — File → Scripts → Run Script File… builds one comp per card with an editable text layer
Install the font (Google Fonts / Adobe Fonts) first so text stays live.

**PSD template:** Supers → **PSD template** → **Upload PSD**. Artwork layers are kept; live text layers stay editable (keep text as type, not
rasterised). Retype each card's text under its preview, drag a card to move the graphic, and adjust size, font (or upload the font file),
colour, stroke and drop shadow. Downloads add `psd_layers/` PNGs, and the After Effects script rebuilds each card with the artwork layers
plus editable text (stroke + drop shadow applied).

## Limits

- Browser must decode the video: H.264 `.mp4/.mov` fine; ProRes / some HEVC won't play.
- Google limits how much a shared Drive file can be read per day. If a clip says its download quota
  is exceeded, **Make a copy** in Drive and link the copy (or wait ~24 h).
- First visit: reload once so the streaming helper (`sw.js`) activates.
- Envato has no public search API — the tool opens ready-made searches; paste the track link back.
