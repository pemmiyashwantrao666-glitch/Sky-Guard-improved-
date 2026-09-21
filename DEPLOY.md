# Deploying SkyGuard — GitHub + Vercel + Custom Domain

Production hosting guide for the **SkyGuard React dashboard** (`skyguard-app/`).

**Pipeline:** push to GitHub `main` → Vercel Git integration builds & deploys automatically → your custom domain serves the app with free auto-renewing HTTPS.

> ⚠️ **Domain availability warning — `skyguard.app` is taken.**
> Verified via RDAP on 2026-09-21: registered **2023-08-19** through **GoDaddy** (Google Registry), renews through **2027-08-19**, currently in auto-renew with transfer/update locks, DNS on Cloudflare, resolving to an AWS EC2 host (3.132.212.171). You cannot register it. Options:
> 1. **Pick an alternative** (instant, ~$14–20/yr for `.app`): e.g. `skyguardai.app`, `skyguard-ai.app`, `getskyguard.app`, `skyguard.live`, `skyguardai.com`, `skyguard-ai.com` — check availability at [domains.google](https://domains.google) / [Namecheap](https://namecheap.com) / [GoDaddy](https://godaddy.com).
> 2. **Buy it from the owner** (aftermarket): use [GoDaddy Domain Broker](https://www.godaddy.com/domain-broker), [Sedo](https://sedo.com), or [Afternic](https://afternic.com). Expect an offer-negotiation; short brandable `.app` names often run $500–$5,000+.
> 3. **If you actually already own it** (e.g. bought it earlier), skip to Step 3 — the DNS records below are all you need.
>
> Everything below works identically for **any** domain you own — substitute your domain wherever `skyguard.app` appears.

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

- `skyguard-app/vite.config.ts` — asset `base` is now env-driven: `/` by default (Vercel/custom domain), `/Sky-Guard-improved-/` on GitHub Pages (via `VITE_BASE_PATH`, set in `.github/workflows/deploy.yml`).
- `skyguard-app/vercel.json` — SPA rewrites (deep links like `/anomalies/3` work) + immutable asset caching + security headers.
- `.github/workflows/deploy.yml` — GitHub Pages deploy keeps working unchanged.

> Note: Vercel and the GitHub Pages workflow both deploy on every push to `main`. Keep both, or disable Pages in **repo Settings → Pages** once Vercel is live.

## Step 2 — Import the repo into Vercel

**Option A — Dashboard (recommended, ~2 minutes):**

1. Sign up / log in at [vercel.com](https://vercel.com) (use **Continue with GitHub** for one-click repo access).
2. **Add New… → Project**, then **Import** `pemmiyashwantrao666-glitch/Sky-Guard-improved-`.
3. Expand **Build and Output Settings → Root Directory** → set to **`skyguard-app`** *(important — the Vite app lives in a subfolder; Vercel auto-detects the Vite framework preset there)*.
4. (Optional) **Environment Variables** — see table below.
5. **Deploy**. First build takes ~1–2 min. You get a live URL like `sky-guard-improved.vercel.app`.

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
| `VITE_BASE_PATH` | **Leave unset** | Must stay unset on Vercel — the default `/` is correct for a custom domain |

Every push to `main` now auto-deploys to production; every PR gets its own preview URL.

## Step 3 — Connect your custom domain

1. **Buy the domain first** at any registrar (see warning above for `skyguard.app` alternatives).
2. In Vercel: **Project → Settings → Domains → Add** → enter `skyguard.app` → also add `www.skyguard.app` and redirect `www` → apex.
3. Vercel shows exactly which DNS records to create. At your registrar's DNS panel, add:

   | Type | Name / Host | Value | TTL |
   |---|---|---|---|
   | `A` | `@` (apex) | `76.76.21.21` | Auto/3600 |
   | `CNAME` | `www` | `cname.vercel-dns.com.` | Auto/3600 |

   *(If you use Cloudflare for DNS instead: set the same records, disable the orange-cloud proxy for these two records — or enable proxy with SSL mode "Full (strict)".)*
4. Wait for propagation (usually minutes, up to 48 h; check with `nslookup skyguard.app` — it should return `76.76.21.21`).
5. **HTTPS is automatic.** Vercel provisions a Let's Encrypt certificate for both the apex and `www`. This is mandatory for `.app` — the TLD is on the HSTS preload list, so browsers refuse plain HTTP. Nothing to configure; Vercel handles renewal forever.
6. Verify: `https://skyguard.app` loads the SkyGuard landing page; `https://skyguard.app/anomalies` deep-link works; certificate shows valid.

**Alternative — full DNS migration:** instead of A/CNAME records you can point your domain's nameservers to Vercel's (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) and manage records in the Vercel dashboard. Only do this if the domain won't be used for other services.

## Step 4 — Post-deploy checklist

- [ ] Landing page loads at the apex domain over HTTPS
- [ ] Login → Overview → Stations → Anomalies all navigate (SPA rewrites working)
- [ ] Hard-refresh on a deep link (e.g. `/settings`) doesn't 404
- [ ] `www.` redirects to apex
- [ ] Vercel → Deployments shows the latest `main` commit green
- [ ] GitHub Pages disabled (Settings → Pages) if you don't want the duplicate deploy

## Step 5 — Cost summary

| Item | Cost |
|---|---|
| Vercel Hobby | **Free** (personal, non-commercial; 100 GB bandwidth/mo, auto-HTTPS) |
| Domain `.app` | ~$14–20/yr (registration) — or aftermarket price for `skyguard.app` |
| Custom domain on Vercel | Free |
| HTTPS certificates | Free, auto-renewed |

Commercial use requires Vercel Pro ($20/user/mo). Hobby terms don't allow a company-run product on the free tier.

## Step 6 — (Optional) live gateway behind the dashboard

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
# Push a change → auto-deploys to Vercel (and Pages) within ~2 min
git add -A ; git commit -m "feat: change" ; git push origin main

# Manual CLI deploy (must be inside skyguard-app/)
vercel --prod

# Check DNS propagation for your domain
nslookup skyguard.app
```
