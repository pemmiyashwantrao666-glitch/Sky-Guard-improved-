"""SkyGuard Edge Gateway — stdlib-only ingest server for ESP32 nodes.

Run:  python gateway/server.py [--port 3101] [--db gateway/edge.db]
Test: curl -X POST localhost:3101/api/edge/ingest -H "Content-Type: application/json" -d "@gateway/sample.json"
"""
from __future__ import annotations

import argparse
import json
import os
import queue
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from edge_store import (SSE_LOCK, SSE_SUBSCRIBERS, history_for, init,
                        latest_all, latest_for, now_iso, store, validate)
from notify import (admin_email as notify_admin_email, feed, notify,
                    notify_complaint, notify_demo_inject,
                    notify_edge_verdict, smtp_configured)
from simulate import backfill, is_running, start_live, stop_live


class Handler(BaseHTTPRequestHandler):
    server_version = "SkyGuardEdgeGateway/1.0"

    def log_message(self, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _json(self, code: int, obj) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/notify/complaint":
            return self._handle_complaint()
        if path == "/api/notify/event":
            return self._handle_event()
        if path == "/api/edge/simulate/stop":
            stopped = stop_live()
            return self._json(200, {"ok": True, "sim": is_running(), "stopped": stopped})
        if path == "/api/edge/simulate":
            return self._handle_simulate()
        if path != "/api/edge/ingest":
            return self._json(404, {"ok": False, "error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0
        if length <= 0 or length > 65536:
            return self._json(400, {"ok": False, "error": "empty/oversize"})
        try:
            payload = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            return self._json(400, {"ok": False, "error": "invalid JSON"})
        ok, err = validate(payload)
        if not ok:
            return self._json(400, {"ok": False, "error": err})
        try:
            rec = store(payload)
        except (ValueError, sqlite3.Error) as exc:
            return self._json(400, {"ok": False, "error": str(exc)})
        notify_edge_verdict(rec)
        self._json(200, {"ok": True, "stored": rec})

    def do_GET(self):
        p = urlparse(self.path)
        if p.path == "/api/health":
            return self._json(200, {"ok": True, "svc": "edge-gw",
                                    "time": now_iso(),
                                    "sim": {"running": is_running(),
                                            "station": "EDGE-PUNE-01"}})
        if p.path == "/api/edge/latest":
            return self._json(200, {"ok": True, "stations": latest_all()})
        if p.path.startswith("/api/edge/latest/"):
            rec = latest_for(p.path.rsplit("/", 1)[-1][:64])
            if not rec:
                return self._json(404, {"ok": False, "error": "no data"})
            return self._json(200, {"ok": True, "reading": rec})
        if p.path.startswith("/api/edge/history/"):
            sid = p.path.rsplit("/", 1)[-1].split("?")[0][:64]
            try:
                lim = int(parse_qs(p.query).get("limit", ["100"])[0])
            except ValueError:
                lim = 100
            return self._json(200, {"ok": True, "station_id": sid,
                                    "readings": history_for(sid, lim)})
        if p.path == "/api/edge/stream":
            return self._sse()
        if p.path == "/api/notify/feed":
            try:
                lim = int(parse_qs(p.query).get("limit", ["50"])[0])
            except ValueError:
                lim = 50
            return self._json(200, {"ok": True, "admin_email": notify_admin_email(),
                                    "smtp": smtp_configured(), "events": feed(lim)})
        return self._json(404, {"ok": False, "error": "not found"})

    def _read_body(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0
        if length <= 0 or length > 65536:
            return None
        try:
            return json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            return None

    def _handle_simulate(self):
        payload = self._read_body() or {}
        station = str(payload.get("station_id") or "EDGE-PUNE-01")[:64]
        try:
            hours = max(1, min(int(payload.get("hours", 24)), 168))
            interval = max(1.0, min(float(payload.get("interval", 5)), 60))
        except (TypeError, ValueError):
            hours, interval = 24, 5.0
        verdict = str(payload.get("verdict", "auto"))[:16]
        rows = backfill(station, hours, verdict=verdict)
        for r in rows:
            store(r)
        live = bool(payload.get("live", True))
        started = start_live(station, interval) if live else False
        return self._json(200, {"ok": True, "injected": len(rows),
                                "hours": hours, "station": station,
                                "live": is_running(), "started": started})

    def _handle_complaint(self):
        payload = self._read_body()
        if not isinstance(payload, dict):
            return self._json(400, {"ok": False, "error": "JSON object required"})
        subject = str(payload.get("subject", "")).strip()[:200]
        details = str(payload.get("details", "")).strip()[:4000]
        if not subject or not details:
            return self._json(400, {"ok": False, "error": "subject and details are required"})
        station = str(payload.get("stationId", "")).strip()[:64]
        reporter = str(payload.get("reporter", "")).strip()[:120]
        item = notify_complaint(subject, details, station, reporter)
        return self._json(200, {"ok": True, "case": item["id"],
                                "email_status": item["email_status"]})

    def _handle_event(self):
        payload = self._read_body()
        if not isinstance(payload, dict):
            return self._json(400, {"ok": False, "error": "JSON object required"})
        kind = str(payload.get("kind", "event")).strip()[:32]
        severity = str(payload.get("severity", "WARNING")).strip()[:16]
        station = str(payload.get("station", "")).strip()[:64]
        message = str(payload.get("message", "")).strip()[:400]
        if not message:
            return self._json(400, {"ok": False, "error": "message is required"})
        item = notify(kind, severity, station or kind, message,
                      str(payload.get("details", "")) or message)
        return self._json(200, {"ok": True, "event": item["id"],
                                "email_status": item["email_status"]})

    def _sse(self):
        q: queue.Queue = queue.Queue(maxsize=100)
        with SSE_LOCK:
            SSE_SUBSCRIBERS.append(q)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self._cors()
            self.end_headers()
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while True:
                try:
                    rec = q.get(timeout=25)
                    msg = f"data: {json.dumps(rec)}\n\n".encode()
                except queue.Empty:
                    msg = b": ping\n\n"
                try:
                    self.wfile.write(msg)
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    break
        finally:
            with SSE_LOCK:
                if q in SSE_SUBSCRIBERS:
                    SSE_SUBSCRIBERS.remove(q)


def _load_env() -> None:
    """Read gateway/.env (KEY=VALUE lines) into os.environ without clobbering."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(env_path):
        return
    with open(env_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())


def main() -> None:
    _load_env()
    ap = argparse.ArgumentParser(description="SkyGuard edge gateway")
    ap.add_argument("--port", type=int, default=3101)
    ap.add_argument("--db", default="gateway/edge.db")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--demo", action="store_true",
                    help="inject 24h of dummy data and start a live 5s feed")
    a = ap.parse_args()
    init(a.db)
    if a.demo:
        for r in backfill("EDGE-PUNE-01", 24):
            store(r)
        start_live("EDGE-PUNE-01", 5.0)
        print("demo simulator: 24h backfill injected, live feed every 5s")
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"SkyGuard edge gateway on http://{a.host}:{a.port} (db={a.db})")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")


if __name__ == "__main__":
    main()
