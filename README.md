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
| `vercel.json` | Timeout + service-worker headers. |

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

## Limits

- Browser must decode the video: H.264 `.mp4/.mov` fine; ProRes / some HEVC won't play.
- Google limits how much a shared Drive file can be read per day. If a clip says its download quota
  is exceeded, **Make a copy** in Drive and link the copy (or wait ~24 h).
- First visit: reload once so the streaming helper (`sw.js`) activates.
- Envato has no public search API — the tool opens ready-made searches; paste the track link back.
