"""SkyGuard admin notifier — stdlib-only SMTP relay (Gmail compatible).

Secrets are NEVER hardcoded. Configure via environment (or gateway/.env):

  SKYGUARD_SMTP_SERVER=smtp.gmail.com
  SKYGUARD_SMTP_PORT=587
  SKYGUARD_SMTP_USER=your-sender@gmail.com
  SKYGUARD_SMTP_PASS=<Gmail App Password, NOT the login password>
  SKYGUARD_ADMIN_EMAIL=admin.skyguardai@gmail.com

Gmail notes: plain login passwords are rejected when 2-Step Verification is
on. Create an App Password: Google Account -> Security -> 2-Step Verification
-> App passwords -> generate 16-char code -> use it as SKYGUARD_SMTP_PASS.
"""
from __future__ import annotations

import os
import queue
import smtplib
import threading
import time
from datetime import datetime, timezone
from email.mime.text import MIMEText

ADMIN_DEFAULT = "admin.skyguardai@gmail.com"
FEED: list[dict] = []
FEED_LOCK = threading.Lock()
_LAST_SENT: dict[str, float] = {}
_SEND_Q: queue.Queue = queue.Queue()
_WORKER_STARTED = False


def admin_email() -> str:
    return os.getenv("SKYGUARD_ADMIN_EMAIL", ADMIN_DEFAULT).strip() or ADMIN_DEFAULT


def smtp_configured() -> bool:
    return bool(os.getenv("SKYGUARD_SMTP_USER") and os.getenv("SKYGUARD_SMTP_PASS"))


def _smtp_send(to_addr: str, subject: str, body: str) -> None:
    server = os.getenv("SKYGUARD_SMTP_SERVER", "smtp.gmail.com")
    port = int(os.getenv("SKYGUARD_SMTP_PORT", "587"))
    user = os.getenv("SKYGUARD_SMTP_USER", "")
    pwd = os.getenv("SKYGUARD_SMTP_PASS", "")
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to_addr
    with smtplib.SMTP(server, port, timeout=15) as s:
        s.starttls()
        s.login(user, pwd)
        s.sendmail(user, [to_addr], msg.as_string())


def _worker() -> None:
    while True:
        job = _SEND_Q.get()
        try:
            _smtp_send(job["to"], job["subject"], job["body"])
            job["status"] = "sent"
        except Exception as exc:  # noqa: BLE001 - log and continue
            job["status"] = f"failed: {exc}"
        with FEED_LOCK:
            for item in FEED:
                if item.get("id") == job.get("id"):
                    item["email_status"] = job["status"]
        _SEND_Q.task_done()


def _ensure_worker() -> None:
    global _WORKER_STARTED
    if not _WORKER_STARTED:
        _WORKER_STARTED = True
        threading.Thread(target=_worker, daemon=True).start()

def _record(kind: str, severity: str, station: str, subject: str, body: str) -> dict:
    item = {
        "id": f"{int(time.time() * 1000)}",
        "time": datetime.now(timezone.utc).isoformat(),
        "kind": kind, "severity": severity, "station": station,
        "subject": subject, "body": body,
        "email_status": "queued" if smtp_configured() else "skipped-no-smtp",
    }
    with FEED_LOCK:
        FEED.append(item)
        del FEED[:-200]
    return item


def notify(kind: str, severity: str, station: str, subject: str, body: str, cooldown_sec: int = 0) -> dict:
    """Queue an admin notification. Cooldown dedups repeats per station+subject."""
    sev = (severity or "INFO").upper()
    if cooldown_sec > 0:
        key = f"{station}|{subject}"
        now = time.time()
        if now - _LAST_SENT.get(key, 0) < cooldown_sec:
            item = _record(kind, sev, station, subject, body)
            item["email_status"] = "suppressed-cooldown"
            return item
        _LAST_SENT[key] = now
    item = _record(kind, sev, station, subject, body)
    if not smtp_configured():
        return item
    _ensure_worker()
    _SEND_Q.put({"id": item["id"], "to": admin_email(), "subject": f"[SkyGuard {sev}] {subject}", "body": body, "status": "queued"})
    return item


def notify_complaint(subject: str, details: str, station: str = "", reporter: str = "") -> dict:
    body = f"New SkyGuard complaint/support case\n\nSubject : {subject}\nStation : {station or '-'}\nReporter: {reporter or '-'}\n\nDetails:\n{details}\n"
    return notify("complaint", "INFO", station or "support", subject, body)


def notify_demo_inject(text: str, station: str = "") -> dict:
    return notify("demo-inject", "WARNING", station or "demo", f"Demo fault injected: {text}", f"{text}\n\nInjected from Analytics fault-injection lab at {datetime.now(timezone.utc).isoformat()}.")


def notify_edge_verdict(reading: dict) -> dict | None:
    verdict = reading.get("verdict")
    if verdict not in ("ANOMALY", "WARNING"):
        return None
    station = str(reading.get("station_id", "edge"))
    sev = "CRITICAL" if verdict == "ANOMALY" else "WARNING"
    subject = f"Edge {verdict} at {station} (score {reading.get('score', '?')})"
    body = (f"Edge AI on-device verdict: {verdict}\nStation : {station}\nTime    : {reading.get('ts')}\nT/H/P   : {reading.get('t')}C / {reading.get('h')}% / {reading.get('p')}hPa\n"
            f"Score   : {reading.get('score')}\nRoot    : {reading.get('root_cause')}\nFirmware: {reading.get('fw', '')}\n")
    return notify("edge-anomaly", sev, station, subject, body, cooldown_sec=300)


def feed(limit: int = 50) -> list[dict]:
    with FEED_LOCK:
        return list(reversed(FEED[-max(1, min(limit, 200)):]))

