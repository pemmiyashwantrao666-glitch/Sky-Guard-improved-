"""
============================================================================
SkyGuard — Real-Time Alerting Module
============================================================================
Supports:
  * Console / file logging
  * Webhook (HTTP POST)
  * Email (SMTP)
  * SMS (via Twilio-style webhook)

Usage:
  from alerts import AlertManager
  am = AlertManager()
  am.send(severity="CRITICAL", station="MUM-03", message="Spike detected", details={...})
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ALERT_LOG_PATH = "alerts.log"
SEVERITY_COLORS = {
    "CRITICAL": "\033[91m",
    "WARNING":  "\033[93m",
    "INFO":     "\033[94m",
    "OK":       "\033[92m",
}
RESET_COLOR = "\033[0m"


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------
@dataclass
class Alert:
    timestamp: str
    severity: str
    station: str
    message: str
    confidence: int
    root_cause: str
    details: dict = field(default_factory=dict)
    raw: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Alert Manager
# ---------------------------------------------------------------------------
class AlertManager:
    """Multi-channel alert dispatcher."""

    def __init__(
        self,
        log_path: str = ALERT_LOG_PATH,
        webhook_url: Optional[str] = None,
        email_config: Optional[dict] = None,
        sms_config: Optional[dict] = None,
    ):
        self.log_path = log_path
        self.webhook_url = webhook_url or os.getenv("SKYGUARD_WEBHOOK_URL")
        self.email_config = email_config or {
            "smtp_server": os.getenv("SKYGUARD_SMTP_SERVER", "smtp.gmail.com"),
            "smtp_port": int(os.getenv("SKYGUARD_SMTP_PORT", "587")),
            "username": os.getenv("SKYGUARD_EMAIL_USER"),
            "password": os.getenv("SKYGUARD_EMAIL_PASS"),
            "to_addrs": os.getenv("SKYGUARD_EMAIL_TO", "admin.skyguardai@gmail.com").split(","),
        }
        self.sms_config = sms_config or {
            "url": os.getenv("SKYGUARD_SMS_URL"),
            "token": os.getenv("SKYGUARD_SMS_TOKEN"),
            "from": os.getenv("SKYGUARD_SMS_FROM"),
            "to": os.getenv("SKYGUARD_SMS_TO"),
        }
        self._setup_logger()

    def _setup_logger(self):
        self.logger = logging.getLogger("skyguard.alerts")
        self.logger.setLevel(logging.INFO)
        if not self.logger.handlers:
            fh = logging.FileHandler(self.log_path)
            fh.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
            self.logger.addHandler(fh)
            ch = logging.StreamHandler(sys.stdout)
            ch.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
            self.logger.addHandler(ch)

    # ---------------- public API ----------------
    def send(
        self,
        severity: str,
        station: str,
        message: str,
        confidence: int = 0,
        root_cause: str = "",
        details: Optional[dict] = None,
        raw: Optional[dict] = None,
    ):
        alert = Alert(
            timestamp=datetime.utcnow().isoformat() + "Z",
            severity=severity.upper(),
            station=station,
            message=message,
            confidence=confidence,
            root_cause=root_cause,
            details=details or {},
            raw=raw or {},
        )
        self._log(alert)
        self._webhook(alert)
        self._email(alert)
        self._sms(alert)

    # ---------------- channels ----------------
    def _log(self, alert: Alert):
        color = SEVERITY_COLORS.get(alert.severity, "")
        msg = (
            f"{color}[{alert.severity}] {alert.timestamp} {alert.station}: "
            f"{alert.message} (conf={alert.confidence}%){RESET_COLOR}"
        )
        self.logger.info(msg)

    def _webhook(self, alert: Alert):
        if not self.webhook_url:
            return
        try:
            import urllib.request
            payload = json.dumps(alert.raw or alert.__dict__).encode()
            req = urllib.request.Request(
                self.webhook_url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                self.logger.debug(f"Webhook response: {resp.status}")
        except Exception as exc:
            self.logger.warning(f"Webhook failed: {exc}")

    def _email(self, alert: Alert):
        cfg = self.email_config
        if not cfg.get("username") or not cfg.get("to_addrs"):
            return
        try:
            subject = f"[SkyGuard {alert.severity}] {alert.station}"
            body = (
                f"Timestamp : {alert.timestamp}\n"
                f"Station   : {alert.station}\n"
                f"Severity  : {alert.severity}\n"
                f"Confidence: {alert.confidence}%\n"
                f"Root cause: {alert.root_cause}\n"
                f"Message   : {alert.message}\n\n"
                f"Details:\n{json.dumps(alert.details, indent=2)}"
            )
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = cfg["username"]
            msg["To"] = ", ".join(cfg["to_addrs"])
            with smtplib.SMTP(cfg["smtp_server"], cfg["smtp_port"]) as s:
                s.starttls()
                s.login(cfg["username"], cfg["password"])
                s.sendmail(cfg["username"], cfg["to_addrs"], msg.as_string())
        except Exception as exc:
            self.logger.warning(f"Email failed: {exc}")

    def _sms(self, alert: Alert):
        cfg = self.sms_config
        if not cfg.get("url") or not cfg.get("to"):
            return
        try:
            import urllib.request
            payload = json.dumps({
                "to": cfg["to"],
                "from": cfg.get("from"),
                "text": (
                    f"[SkyGuard {alert.severity}] {alert.station}: "
                    f"{alert.message} (conf={alert.confidence}%)"
                ),
            }).encode()
            req = urllib.request.Request(
                cfg["url"],
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {cfg.get('token', '')}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                self.logger.debug(f"SMS response: {resp.status}")
        except Exception as exc:
            self.logger.warning(f"SMS failed: {exc}")


# ---------------------------------------------------------------------------
# Convenience wrapper
# ---------------------------------------------------------------------------
def alert_from_engine_result(result: dict, manager: AlertManager):
    """Translate an engine result dict into a dispatched alert."""
    if result["verdict"] == "ANOMALY":
        severity = "CRITICAL" if result["confidence"] >= 80 else "WARNING"
    elif result["verdict"] == "WARNING":
        severity = "WARNING"
    else:
        return

    manager.send(
        severity=severity,
        station=result["station_id"],
        message=result["root_cause"]["label"],
        confidence=result["confidence"],
        root_cause=result["root_cause"]["action"],
        details={
            "score": result["score"],
            "evidence": result["evidence"][:3],
            "corrected": result.get("corrected", {}),
            "health_score": result.get("health_score"),
            "maintenance_due_days": result.get("maintenance_due_days"),
        },
        raw=result,
    )
