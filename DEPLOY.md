# Deploying SkyGuard — Free Hosting (GitHub Pages + Vercel free domain)

Free hosting guide for the **SkyGuard React dashboard** (`skyguard-app/`).

> **No custom domain, no cost.** The app deploys to free URLs:
> - **GitHub Pages (live now):** `https://pemmiyashwantrao666-glitch.github.io/Sky-Guard-improved-/`
> - **Vercel (optional second free host):** import the repo → you get `https://<project>.vercel.app`
>
> **Pipeline:** push to GitHub `main` → GitHub Actions builds & publishes to Pages automatically (free HTTPS included). Optionally, Vercel Git integration builds & deploys the same code to its free `*.vercel.app` domain.

---

## What gets deployed — and what doesn't

| Component | Hosted on Vercel? | Why |
|---|---|---|
| `skyguard-app/` (React 19 + Vite SPA) | ✅ Yes — this is the deployment | Static output in `dist/`, perfect for Vercel's CDN |
| Legacy static dashboard (`index.html`, `dashboard.html`, …) | ❌ Not deployed | Optional demo; open locally, or add later as another Vercel project |
| Python anomaly engine (`anomaly_engine.py`, `shap_explainer.py`) | ❌ Not deployed | CLI tool; the React dashboard uses its own local simulated stream |
| `gateway/` (edge API, SSE stream, SMTP notifier, SQLite) | ❌ Not on Vercel | Long-running process with in-memory state + SSE + SMTP — incompatible with serverless. See Step 6 |

The dashboard is fully functional standalone: all data is simulated client-side. Deploying `skyguard-app` alone gives you a complete production site.

---

## Step 1 — Code is on GitHub ✅

The repo is already pushed to `origin` (`main`). This deployment prep was committed and pushed:

- `skyguard-app/vite.config.ts` — asset `base` is env-driven: `/` by default (Vercel free `*.vercel.app` domain), `/Sky-Guard-improved-/` on GitHub Pages (via `VITE_BASE_PATH`, set in `.github/workflows/deploy.yml`).
- `skyguard-app/vercel.json` — SPA rewrites (deep links like `/anomalies/3` work on the free Vercel domain) + immutable asset caching + security headers.
- `.github/workflows/deploy.yml` — GitHub Pages deploy (the current live free link) + SPA fallback (`404.html`).

## Step 2 — Free hosting links

**GitHub Pages (already live, free):**

**Option A — Dashboard (recommended, ~2 minutes):**

1. Sign up / log in at [vercel.com](https://vercel.com) (use **Continue with GitHub** for one-click repo access).
2. **Add New… → Project**, then **Import** `pemmiyashwantrao666-glitch/Sky-Guard-improved-`.
3. Expand **Build and Output Settings → Root Directory** → set to **`skyguard-app`** *(important — the Vite app lives in a subfolder; Vercel auto-detects the Vite framework preset there)*.
4. (Optional) **Environment Variables** — see table below.
5. **Deploy**. First build takes ~1–2 min. You get a live free URL like `sky-guard-improved.vercel.app` — HTTPS included, no custom domain needed.

**Option B — CLI:**

```powershell
npm i -g vercel          # already done on this machine
vercel login             # opens browser — must be run by you
cd "e:\Computer Programming\SkyGuard-AI\skyguard-app"
vercel                   # links + previews
vercel --prod            # production deploy
```

**Environment variables** (Vercel → Project → Settings → Environment Variables):

| Variable | Required? | Value |
|---|---|---|
| `VITE_EDGE_API_URL` | No | Only if you deploy the Python gateway (Step 6). Default falls back to `http://localhost:3101`. e.g. `https://skyguard-gateway.onrender.com` |
| `VITE_IMD_API_URL` | No | Only if you self-host the IMD weather API. Default `http://localhost:5000` |
| `VITE_BASE_PATH` | **Leave unset** | Must stay unset on Vercel — the default `/` is correct for the free `*.vercel.app` domain |

Every push to `main` now auto-deploys to production (GitHub Pages) and to Vercel if connected; every PR gets its own Vercel preview URL.

> **No custom domain is used anywhere** — both live links are free (`*.github.io` and `*.vercel.app`). If you ever buy a domain later, you can add it in Vercel **Project → Settings → Domains** (free to attach, HTTPS auto-provisioned).

## Step 3 — Post-deploy checklist

- [ ] Landing page loads over HTTPS on the free link(s)
- [ ] Login → Overview → Stations → Anomalies all navigate (SPA rewrites/fallback working)
- [ ] Hard-refresh on a deep link (e.g. `/settings`) doesn't 404
- [ ] Vercel → Deployments shows the latest `main` commit green (if connected)
- [ ] GitHub Actions `Deploy to GitHub Pages` run is green

## Step 4 — Cost summary

| Item | Cost |
|---|---|
| GitHub Pages | **Free** (public repo, auto-HTTPS) |
| Vercel Hobby | **Free** (personal, non-commercial; 100 GB bandwidth/mo, auto-HTTPS, free `*.vercel.app` domain) |
| Custom domain | **None — not used** |
| HTTPS certificates | Free, auto-renewed |

Commercial use requires Vercel Pro ($20/user/mo). Hobby terms don't allow a company-run product on the free tier.

## Step 5 — (Optional) live gateway behind the dashboard

`VITE_EDGE_API_URL` feeds the Edge-Nodes page, SSE stream, complaint emailer and simulator. Since Vercel can't host the Python gateway, either:

- **Keep it local** for demos (run `python gateway/server.py`), or
- **Deploy it to a long-running host** with a free tier and set `VITE_EDGE_API_URL` in Vercel:
  - [Render](https://render.com) — Web Service, start command `python gateway/server.py`,
  - [Railway](https://railway.app) / [Fly.io](https://fly.io) — similar one-command deploys,
  - Configure `gateway/.env` (SMTP creds etc.) on that host — secrets are environment-only, never committed.

Until then, the site is fully demo-capable with its built-in local simulation — no gateway required.

---

## Quick reference — commands

```powershell
# Push a change → auto-deploys to GitHub Pages (and Vercel if connected) within ~2 min
git add -A ; git commit -m "feat: change" ; git push origin main

# Manual Vercel deploy to the free *.vercel.app domain (must be inside skyguard-app/)
vercel --prod
```
