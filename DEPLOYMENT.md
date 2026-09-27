# SkyGuard AI — Deployment Guide

**Deploy the Complete System: Frontend + Backend + Database**

---

## Deployment Options

### Option 1: Quick Demo (GitHub Pages Frontend Only) ✅ Already Configured
- **Frontend:** Deployed to GitHub Pages
- **Backend:** You run locally
- **Best for:** Demos, portfolios, static showcases

### Option 2: Full Stack (Render/Railway/Fly.io)
- **Frontend:** Static hosting (Vercel/Netlify/GitHub Pages)
- **Backend:** Python gateway on cloud server
- **Best for:** Production deployments, SIH demo

### Option 3: Local Network Deployment
- **Everything runs on your machine**
- **Accessible from other devices on WiFi**
- **Best for:** Field testing, LAN demos

---

## 🚀 Option 1: GitHub Pages (Already Set Up!)

### Status: ✅ Deployment Pipeline Active

Your repository already has GitHub Actions configured to deploy the React dashboard automatically.

### How to Deploy:

1. **Enable GitHub Pages:**
   ```
   1. Go to: https://github.com/pemmiyashwantrao666-glitch/skyguard-AI/settings/pages
   2. Under "Build and deployment":
      - Source: GitHub Actions
   3. Save
   ```

2. **Trigger Deployment:**
   ```bash
   cd "E:/Computer Programming/SkyGuard-AI"
   git push skyguard main
   ```

3. **Wait 2-3 minutes** for GitHub Actions to build and deploy

4. **Access your dashboard:**
   ```
   https://pemmiyashwantrao666-glitch.github.io/skyguard-AI/
   ```

### ⚠️ Limitations:
- **Static frontend only** — No backend included
- **No real-time data** — API calls will fail (gateway not running)
- **Demo mode only** — Good for showing UI/UX

### To Make It Work with Local Gateway:
Update `skyguard-app/src/lib/edge-api.ts`:
```typescript
const configured = (import.meta.env.VITE_EDGE_API_URL as string | undefined)?.trim();
const EDGE_BASE = (configured ?? "http://YOUR-PUBLIC-IP:3101").replace(/\/+$/, "");
```

Then expose your local gateway with ngrok (see Option 3 below).

---

## 🌐 Option 2: Full Stack Deployment (Render)

Deploy both frontend and backend to the cloud.

### Frontend: Vercel (Free)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   cd "E:/Computer Programming/SkyGuard-AI/skyguard-app"
   vercel
   ```

3. **Follow prompts:**
   - Link to existing project? **No**
   - Project name: **skyguard-ai**
   - Directory: **.**
   - Build command: **npm run build**
   - Output directory: **dist**

4. **Set environment variable:**
   ```bash
   vercel env add VITE_EDGE_API_URL
   # Enter: https://skyguard-gateway.onrender.com (your backend URL)
   ```

5. **Redeploy:**
   ```bash
   vercel --prod
   ```

**Result:** Dashboard live at `https://skyguard-ai.vercel.app`

### Backend: Render (Free Tier)

1. **Create `render.yaml` in project root:**

```yaml
services:
  - type: web
    name: skyguard-gateway
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: python gateway/server.py --host 0.0.0.0 --port $PORT --db /opt/render/project/data/edge.db
    envVars:
      - key: SKYGUARD_SMTP_SERVER
        sync: false
      - key: SKYGUARD_SMTP_PORT
        value: 587
      - key: SKYGUARD_SMTP_USER
        sync: false
      - key: SKYGUARD_SMTP_PASS
        sync: false
      - key: SKYGUARD_ADMIN_EMAIL
        value: admin.skyguardai@gmail.com
    disk:
      name: skyguard-data
      mountPath: /opt/render/project/data
      sizeGB: 1

databases:
  - name: skyguard-db
    databaseName: skyguard
    user: skyguard_user
```

2. **Push to GitHub:**
   ```bash
   git add render.yaml
   git commit -m "feat: add Render deployment config"
   git push skyguard main
   ```

3. **Deploy on Render:**
   - Go to: https://render.com
   - Sign in with GitHub
   - **New** → **Blueprint**
   - Select: `pemmiyashwantrao666-glitch/skyguard-AI`
   - Click **Apply**

4. **Set environment variables:**
   - SKYGUARD_SMTP_USER: `your-email@gmail.com`
   - SKYGUARD_SMTP_PASS: `your-app-password`

**Result:** Backend live at `https://skyguard-gateway.onrender.com`

---

## 🏠 Option 3: Local Network Deployment

Deploy on your local network so phones/tablets can access it.

### Step 1: Find Your Local IP

**Windows:**
```bash
ipconfig | findstr IPv4
# Look for: IPv4 Address. . . . . . . . . . . : 192.168.1.XXX
```

**Example:** `192.168.1.105`

### Step 2: Update Dashboard API URL

Edit `skyguard-app/src/lib/edge-api.ts`:
```typescript
const EDGE_BASE = "http://192.168.1.105:3101";
```

### Step 3: Start Backend

```bash
cd "E:/Computer Programming/SkyGuard-AI"
python gateway/server.py --host 0.0.0.0 --port 3101 --demo
```

### Step 4: Start Frontend

```bash
cd skyguard-app
npm run dev -- --host 0.0.0.0
```

### Step 5: Access from Other Devices

On your phone/tablet connected to the same WiFi:
```
http://192.168.1.105:5173/
```

### Optional: Use ngrok for Public URL

If you want to share outside your network:

```bash
# Install ngrok: https://ngrok.com/download

# Expose backend
ngrok http 3101

# Update dashboard with ngrok URL:
# const EDGE_BASE = "https://xxxx-xx-xxx-xxx-xx.ngrok-free.app";

# Expose frontend
ngrok http 5173
```

**Result:** Accessible worldwide at `https://xxxx.ngrok-free.app`

---

## 🐳 Option 4: Docker Deployment

### Create Dockerfile for Backend:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3101

CMD ["python", "gateway/server.py", "--host", "0.0.0.0", "--port", "3101", "--db", "/data/edge.db"]
```

### Create docker-compose.yml:

```yaml
version: '3.8'

services:
  gateway:
    build: .
    ports:
      - "3101:3101"
    volumes:
      - ./data:/data
    environment:
      - SKYGUARD_SMTP_SERVER=${SKYGUARD_SMTP_SERVER}
      - SKYGUARD_SMTP_PORT=${SKYGUARD_SMTP_PORT}
      - SKYGUARD_SMTP_USER=${SKYGUARD_SMTP_USER}
      - SKYGUARD_SMTP_PASS=${SKYGUARD_SMTP_PASS}
      - SKYGUARD_ADMIN_EMAIL=${SKYGUARD_ADMIN_EMAIL}
    restart: unless-stopped

  frontend:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./skyguard-app:/app
    ports:
      - "5173:5173"
    command: sh -c "npm install && npm run dev -- --host 0.0.0.0"
    depends_on:
      - gateway
    environment:
      - VITE_EDGE_API_URL=http://gateway:3101
```

### Deploy:

```bash
docker-compose up -d
```

**Result:** 
- Backend: `http://localhost:3101`
- Frontend: `http://localhost:5173`

---

## 📊 Deployment Comparison

| Option | Frontend | Backend | Cost | Difficulty | Best For |
|--------|----------|---------|------|------------|----------|
| **GitHub Pages** | ✅ | ❌ | Free | Easy | Portfolio, UI demo |
| **Vercel + Render** | ✅ | ✅ | Free | Medium | Production, SIH demo |
| **Local Network** | ✅ | ✅ | Free | Easy | Field testing, LAN |
| **Docker** | ✅ | ✅ | Free | Hard | Dev environment |
| **ngrok** | ✅ | ✅ | Free | Easy | Quick public sharing |

---

## 🎯 Recommended for SIH 2026 Demo

### Before Demo Day:
**Use GitHub Pages + Local Gateway**
- Deploy frontend to GitHub Pages (already done)
- Run gateway locally during presentation
- No internet dependency for core demo

### On Demo Day:
**Use Local Network (Option 3)**
- Everything runs on your laptop
- Judges can access from their devices via WiFi hotspot
- Zero deployment issues
- Full real-time features work

### Post-Demo (Portfolio):
**Use Vercel + Render (Option 2)**
- Both services free forever
- Always-on public URL to share with recruiters
- Professional deployment

---

## 🚀 Quick Start: Deploy Now

### 1. GitHub Pages (Frontend Only):
```bash
cd "E:/Computer Programming/SkyGuard-AI"
git push skyguard main
# Wait 3 minutes
# Visit: https://pemmiyashwantrao666-glitch.github.io/skyguard-AI/
```

### 2. Local Network (Full Stack):
```bash
# Terminal 1: Backend
cd "E:/Computer Programming/SkyGuard-AI"
python gateway/server.py --host 0.0.0.0 --demo

# Terminal 2: Frontend
cd skyguard-app
npm run dev -- --host 0.0.0.0

# Share this URL: http://YOUR-LOCAL-IP:5173/
```

---

## 📝 Post-Deployment Checklist

- [ ] Dashboard loads without errors
- [ ] API health check works: `/api/health`
- [ ] Latest readings appear: `/api/edge/latest`
- [ ] Complaints submit successfully
- [ ] Alerts page shows notifications
- [ ] Station map renders correctly
- [ ] Real-time SSE stream updates dashboard
- [ ] Email notifications configured (optional)

---

## 🆘 Troubleshooting

### Dashboard shows "Gateway unreachable"
**Fix:** Update `VITE_EDGE_API_URL` to point to your backend URL.

### CORS errors in browser console
**Fix:** Gateway already has CORS enabled. Check the backend URL is correct.

### GitHub Pages shows 404 for sub-routes
**Fix:** Already handled by `404.html` fallback in deploy workflow.

### Render free tier goes to sleep
**Fix:** Use a cron job to ping the health endpoint every 10 minutes:
```bash
*/10 * * * * curl https://skyguard-gateway.onrender.com/api/health
```

---

Would you like me to deploy it now using one of these options?
