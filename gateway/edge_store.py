"""SQLite storage + validation for the SkyGuard edge gateway (stdlib only)."""
from __future__ import annotations

import queue
import sqlite3
import threading
from datetime import datetime, timezone

VALID_VERDICTS = {"NORMAL", "WARNING", "ANOMALY"}
SSE_SUBSCRIBERS: list[queue.Queue] = []
SSE_LOCK = threading.Lock()
DB_LOCK = threading.Lock()
DB_PATH = "gateway/edge.db"
_CONN: sqlite3.Connection | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS edge_readings (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             station_id TEXT NOT NULL, ts TEXT NOT NULL,
             t REAL, h REAL, p REAL, score REAL,
             verdict TEXT, root_cause TEXT,
             lat REAL, lon REAL, fw TEXT, received_at TEXT NOT NULL)"""
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_edge_station ON edge_readings(station_id, id)"
    )
    return conn


def init(db_path: str) -> None:
    global DB_PATH, _CONN
    DB_PATH = db_path
    _CONN = connect(db_path)


def _conn() -> sqlite3.Connection:
    global _CONN
    if _CONN is None:
        _CONN = connect(DB_PATH)
    return _CONN


COLS = ("station_id ts t h p score verdict root_cause lat lon fw received_at".split())


def validate(p: dict) -> tuple[bool, str]:
    if not isinstance(p, dict):
        return False, "body must be a JSON object"
    if not p.get("station_id") or not isinstance(p["station_id"], str):
        return False, "station_id (string) is required"
    for k in ("t", "h", "p"):
        try:
            float(p[k])
        except (KeyError, TypeError, ValueError):
            return False, f"{k} (number) is required"
    if p.get("verdict") not in VALID_VERDICTS:
        return False, "verdict must be NORMAL|WARNING|ANOMALY"
    return True, ""


def store(p: dict) -> dict:
    rec = {
        "station_id": str(p["station_id"])[:64],
        "ts": str(p.get("ts") or now_iso()),
        "t": float(p["t"]), "h": float(p["h"]), "p": float(p["p"]),
        "score": float(p.get("score", 0) or 0),
        "verdict": str(p.get("verdict", "NORMAL")),
        "root_cause": str(p.get("root_cause", "none"))[:64],
        "lat": p.get("lat"), "lon": p.get("lon"),
        "fw": str(p.get("fw", ""))[:32],
        "received_at": now_iso(),
    }
    with DB_LOCK:
        _conn().execute(
            """INSERT INTO edge_readings (station_id, ts, t, h, p, score,
                  verdict, root_cause, lat, lon, fw, received_at)
               VALUES (:station_id, :ts, :t, :h, :p, :score,
                  :verdict, :root_cause, :lat, :lon, :fw, :received_at)""",
            rec,
        )
        _conn().commit()
    with SSE_LOCK:
        for q in list(SSE_SUBSCRIBERS):
            try:
                q.put_nowait(rec)
            except queue.Full:
                pass
    return rec


def _rows(sql: str, args: tuple = ()) -> list[dict]:
    with DB_LOCK:
        rows = _conn().execute(sql, args).fetchall()
    keys = ("station_id", "ts", "t", "h", "p", "score", "verdict",
            "root_cause", "lat", "lon", "fw", "received_at")
    return [dict(zip(keys, r)) for r in rows]


def latest_for(sid: str) -> dict | None:
    r = _rows("SELECT station_id, ts, t, h, p, score, verdict, root_cause,"
              " lat, lon, fw, received_at FROM edge_readings"
              " WHERE station_id=? ORDER BY id DESC LIMIT 1", (sid,))
    return r[0] if r else None


def latest_all() -> list[dict]:
    return _rows("SELECT station_id, ts, t, h, p, score, verdict, root_cause,"
                 " lat, lon, fw, received_at FROM edge_readings WHERE id IN"
                 " (SELECT MAX(id) FROM edge_readings GROUP BY station_id)")


def history_for(sid: str, limit: int) -> list[dict]:
    limit = max(1, min(limit, 500))
    r = _rows("SELECT station_id, ts, t, h, p, score, verdict, root_cause,"
              " lat, lon, fw, received_at FROM edge_readings"
              " WHERE station_id=? ORDER BY id DESC LIMIT ?", (sid, limit))
    return list(reversed(r))
