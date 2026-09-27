# Email Configuration Guide — SkyGuard AI

**Enable Real-Time Email Notifications for Complaints & Anomalies**

---

## Overview

The SkyGuard gateway can send email notifications for:
- **Complaints** submitted via the dashboard
- **Edge anomalies** detected by ESP32 stations (WARNING/ANOMALY verdicts)
- **Demo fault injections** from the Analytics lab
- **Critical system events**

By default, notifications are stored in-memory but **emails are not sent** until you configure SMTP credentials.

---

## Quick Setup (Gmail Example)

### Step 1: Create a Gmail App Password

1. **Go to your Google Account:** https://myaccount.google.com/
2. **Enable 2-Step Verification:**
   - Navigate to: **Security** → **2-Step Verification**
   - Follow the prompts to enable it (required for App Passwords)
3. **Generate an App Password:**
   - Navigate to: **Security** → **2-Step Verification** → **App passwords**
   - Select app: **Mail**
   - Select device: **Windows Computer** (or Other)
   - Click **Generate**
   - **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

### Step 2: Configure the Gateway

Create or edit `gateway/.env` in your project:

```bash
cd "E:/Computer Programming/SkyGuard-AI/gateway"
notepad .env
```

Add these lines (replace with your details):

```env
SKYGUARD_SMTP_SERVER=smtp.gmail.com
SKYGUARD_SMTP_PORT=587
SKYGUARD_SMTP_USER=your-email@gmail.com
SKYGUARD_SMTP_PASS=abcd efgh ijkl mnop
SKYGUARD_ADMIN_EMAIL=admin.skyguardai@gmail.com
```

**Important:**
- Use the **16-character App Password**, NOT your regular Gmail password
- `SKYGUARD_SMTP_USER` = your Gmail address (sender)
- `SKYGUARD_ADMIN_EMAIL` = where notifications should be delivered (can be the same or different)

### Step 3: Restart the Gateway

```bash
# Stop the gateway (Ctrl+C in the terminal running it)
# Restart it:
cd "E:/Computer Programming/SkyGuard-AI"
python gateway/server.py --demo
```

### Step 4: Test It

**From the dashboard:**
1. Navigate to **Complaints** page (`/complaints`)
2. Submit a test complaint
3. Check your email inbox at `SKYGUARD_ADMIN_EMAIL`

**From the command line:**
```bash
curl -X POST http://localhost:3101/api/notify/complaint \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test email","details":"Testing SMTP configuration","stationId":"TEST-01","reporter":"Admin"}'
```

You should receive an email with subject: `[SkyGuard INFO] Test email`

---

## Alternative Email Providers

### Outlook/Office 365

```env
SKYGUARD_SMTP_SERVER=smtp-mail.outlook.com
SKYGUARD_SMTP_PORT=587
SKYGUARD_SMTP_USER=your-email@outlook.com
SKYGUARD_SMTP_PASS=your-password
SKYGUARD_ADMIN_EMAIL=admin@yourdomain.com
```

### Custom SMTP Server

```env
SKYGUARD_SMTP_SERVER=smtp.yourdomain.com
SKYGUARD_SMTP_PORT=587
SKYGUARD_SMTP_USER=notifications@yourdomain.com
SKYGUARD_SMTP_PASS=your-password
SKYGUARD_ADMIN_EMAIL=operations@yourdomain.com
```

---

## Email Notification Types

### 1. Complaints (INFO)
**Subject:** `[SkyGuard INFO] <User's Subject>`
**Body:**
```
New SkyGuard complaint/support case

Subject : Sensor calibration check needed
Station : MUM-03
Reporter: Field Engineer

Details:
Station MUM-03 is showing continuous RH drift over the last 3 hours.
```

### 2. Edge Anomalies (WARNING/CRITICAL)
**Subject:** `[SkyGuard CRITICAL] Edge ANOMALY at EDGE-PUNE-01 (score 0.89)`
**Body:**
```
Edge AI on-device verdict: ANOMALY
Station : EDGE-PUNE-01
Time    : 2026-09-27T03:15:00Z
T/H/P   : 52.4C / 100% / 1008.5hPa
Score   : 0.89
Root    : Multi-Sensor Fault
Firmware: skyguard-edge-v1.0
```

**Cooldown:** 5 minutes (300 seconds) per station to avoid email floods

### 3. Demo Fault Injections (WARNING)
**Subject:** `[SkyGuard WARNING] Demo fault injected: Temperature spike (+20°C)`
**Body:**
```
Temperature spike (+20°C)

Injected from Analytics fault-injection lab at 2026-09-27T03:20:15Z.
```

---

## Troubleshooting

### Problem: "Username and Password not accepted"

**Cause:** Using regular Gmail password instead of App Password

**Solution:**
1. Verify 2-Step Verification is enabled
2. Generate a new App Password (Security → 2-Step Verification → App passwords)
3. Use the 16-character code in `SKYGUARD_SMTP_PASS`

### Problem: Emails not arriving

**Check:**
1. **Gateway logs:** Look for `sent` vs `failed` status in `/api/notify/feed`
2. **Spam folder:** Check if emails are being filtered
3. **SMTP credentials:** Verify `SKYGUARD_SMTP_USER` and `SKYGUARD_SMTP_PASS` are correct
4. **Firewall:** Ensure port 587 (SMTP) is not blocked

**Test manually:**
```bash
curl http://localhost:3101/api/notify/feed | python -m json.tool
```

Look for `"email_status": "sent"` (success) or `"email_status": "failed: ..."` (error details)

### Problem: Dashboard shows "Email alerts disabled"

**Cause:** `SKYGUARD_SMTP_USER` or `SKYGUARD_SMTP_PASS` is not set

**Solution:**
1. Create `gateway/.env` with SMTP credentials
2. Restart the gateway
3. Refresh the dashboard — the warning should disappear

---

## Security Best Practices

1. **Never commit `.env` files to Git**
   - Already in `.gitignore` by default
   - Rotate credentials if accidentally exposed

2. **Use App Passwords, not account passwords**
   - App Passwords can be revoked individually
   - Account passwords grant full access

3. **Restrict admin email access**
   - Use a dedicated operations inbox (e.g., `ops@yourdomain.com`)
   - Set up email filters/rules for `[SkyGuard CRITICAL]`

4. **Monitor failed attempts**
   - Check `/api/notify/feed` regularly
   - Set up alerts for persistent `email_status: "failed"`

---

## Production Deployment

For production use:

1. **Use environment variables** instead of `.env` file:
   ```bash
   export SKYGUARD_SMTP_SERVER=smtp.gmail.com
   export SKYGUARD_SMTP_PORT=587
   export SKYGUARD_SMTP_USER=alerts@yourdomain.com
   export SKYGUARD_SMTP_PASS=xxxx
   export SKYGUARD_ADMIN_EMAIL=operations@yourdomain.com
   python gateway/server.py
   ```

2. **Use a secrets manager** (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)

3. **Set up email rules** to route critical alerts to SMS/Slack/PagerDuty

4. **Configure SPF/DKIM** records if using a custom domain

---

## Testing Checklist

- [ ] `gateway/.env` created with SMTP credentials
- [ ] Gateway restarted after adding credentials
- [ ] Dashboard no longer shows "Email alerts disabled" warning
- [ ] Test complaint submitted and email received
- [ ] Email appears in inbox (check spam folder)
- [ ] Subject line matches: `[SkyGuard INFO] <subject>`
- [ ] Email includes station ID, reporter, and details
- [ ] `/api/notify/feed` shows `"email_status": "sent"`

---

## Example `.env` File

```env
# Gmail SMTP Configuration
SKYGUARD_SMTP_SERVER=smtp.gmail.com
SKYGUARD_SMTP_PORT=587
SKYGUARD_SMTP_USER=skyguard.alerts@gmail.com
SKYGUARD_SMTP_PASS=abcd efgh ijkl mnop
SKYGUARD_ADMIN_EMAIL=operations.team@yourcompany.com

# Optional: Twilio SMS Integration (future feature)
# SKYGUARD_TWILIO_SID=ACxxxx
# SKYGUARD_TWILIO_TOKEN=xxxx
# SKYGUARD_TWILIO_FROM=+1234567890
# SKYGUARD_TWILIO_TO=+0987654321
```

---

## Support

If emails still don't work after following this guide:

1. Check gateway console logs for detailed error messages
2. Verify firewall/antivirus isn't blocking port 587
3. Test with a different email provider (Outlook, custom SMTP)
4. Submit a complaint via the dashboard (it will appear in `/api/notify/feed` even if email fails)

**Email setup is complete when:**
- Dashboard shows no SMTP warning
- Complaints show `email_status: "sent"` in `/api/notify/feed`
- Emails arrive within 5 seconds in the admin inbox
