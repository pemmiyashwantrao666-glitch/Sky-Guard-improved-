"""Dummy-data generator for SkyGuard Edge AI — stdlib only.

Produces realistic BME280-style readings (diurnal temperature cycle,
random-walk pressure, humidity anti-correlated with temperature) plus
occasional WARNING / ANOMALY verdicts with plausible root causes.

Use from the gateway:
    python gateway/server.py --port 3101 --demo      # auto-start live sim
or via HTTP:
    POST /api/edge/simulate        {"hours": 24, "live": true}
    POST /api/edge/simulate/stop
or standalone (posts over HTTP to a running gateway):
    python gateway/simulate.py --interval 5 --hours 24
"""
from __future__ import annotations

import argparse
import json
import math
import random
import threading
import time
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT_CAUSES = {
    "ANOMALY": ["heat_spike", "humidity_collapse", "pressure_surge",
                "frozen_sensor", "dewpoint_incoherence"],
    "WARNING": ["sensor_drift", "rapid_pressure_drop", "humidity_rise"],
}
VERDICT_WEIGHTS = (("NORMAL", 0.85), ("WARNING", 0.10), ("ANOMALY", 0.05))


def _pick_verdict(rng, verdict: str) -> str:
    if verdict and verdict != "auto":
        return verdict
    x, acc = rng.random(), 0.0
    for name, w in VERDICT_WEIGHTS:
        acc += w
        if x <= acc:
            return name
    return "NORMAL"


def generate_reading(station_id: str = "EDGE-PUNE-01", ts: str | None = None,
                     verdict: str = "auto", state: dict | None = None) -> dict:
    """One plausible sensor frame. `state` carries the pressure walk."""
    rng = state.get("rng") if state else random
    now = datetime.now(timezone.utc).replace(microsecond=0)
    if ts is None:
        ts = now.isoformat().replace("+00:00", "Z")
    v = _pick_verdict(rng, verdict)
    hour = now.hour + now.minute / 60.0
    # Diurnal cycle: min ~05:00, max ~15:00, amplitude 4.5C around 27C.
    temp = 27.0 + 4.5 * math.sin((hour - 9) / 24 * 2 * math.pi) + rng.uniform(-0.8, 0.8)
    if state is None:
        pressure = 1008.0 + rng.uniform(-6, 6)
    else:
        state["p"] = pressure = state.get("p", 1008.0) + rng.uniform(-0.35, 0.35)
    humidity = min(95.0, max(30.0, 92.0 - (temp - 22.0) * 4.2 + rng.uniform(-3, 3)))
    score = round(rng.uniform(0.01, 0.15), 3)
    root_cause = "none"
    if v == "WARNING":
        score = round(rng.uniform(0.40, 0.60), 3)
        root_cause = rng.choice(ROOT_CAUSES["WARNING"])
        mode = rng.random()
        if mode < 0.4:
            humidity = max(18.0, humidity - rng.uniform(8, 14))
        elif mode < 0.7:
            pressure -= rng.uniform(2.5, 4.5)
        else:
            temp += rng.uniform(2.5, 4.0)
    elif v == "ANOMALY":
        score = round(rng.uniform(0.72, 0.95), 3)
        root_cause = rng.choice(ROOT_CAUSES["ANOMALY"])
        mode = rng.random()
        if mode < 0.3:
            temp = rng.uniform(42.0, 46.5)           # heat spike
        elif mode < 0.55:
            humidity = rng.uniform(8.0, 15.0)         # humidity collapse
        elif mode < 0.8:
            pressure = rng.uniform(1032.0, 1040.0)    # pressure surge
        elif mode < 0.9:
            temp = humidity = -99.0                   # frozen sensor
        else:
            humidity = 5.0                            # dewpoint incoherence
    return {
        "station_id": station_id, "ts": ts,
        "t": round(temp, 2), "h": round(humidity, 2),
        "p": round(pressure, 2), "score": score,
        "verdict": v, "root_cause": root_cause,
        "lat": 18.5204, "lon": 73.8567,
        "fw": "skyguard-edge-sim",
    }


def backfill(station_id: str = "EDGE-PUNE-01", hours: int = 24,
             step_min: int = 10, verdict: str = "auto") -> list[dict]:
    """History so charts and uptime look real immediately."""
    state = {"p": 1008.0 + random.uniform(-5, 5), "rng": random.Random()}
    out, t = [], datetime.now(timezone.utc) - timedelta(hours=hours)
    end = datetime.now(timezone.utc)
    while t <= end:
        ts = t.isoformat(timespec="seconds").replace("+00:00", "Z")
        out.append(generate_reading(station_id, ts, verdict, state))
        t += timedelta(minutes=step_min)
    return out


class Simulator(threading.Thread):
    """Live dummy feed: one reading every `interval` seconds, forever."""

    def __init__(self, station_id: str = "EDGE-PUNE-01", interval: float = 5.0):
        super().__init__(daemon=True, name="edge-simulator")
        self.station_id, self.interval = station_id, interval
        self._stop = threading.Event()
        self.state = {"p": 1008.0, "rng": random.Random()}

    def run(self) -> None:
        from edge_store import store  # in-process; avoids self-HTTP
        while not self._stop.wait(self.interval):
            try:
                store(generate_reading(self.station_id, None, "auto", self.state))
            except Exception:
                pass  # keep simulating even if a store fails

    def stop(self) -> None:
        self._stop.set()


SIM: Simulator | None = None


def start_live(station_id: str = "EDGE-PUNE-01", interval: float = 5.0) -> bool:
    global SIM
    if SIM and SIM.is_alive():
        return False  # already running
    SIM = Simulator(station_id, interval)
    SIM.start()
    return True


def stop_live() -> bool:
    global SIM
    if SIM and SIM.is_alive():
        SIM.stop()
        return True
    return False


def is_running() -> bool:
    return bool(SIM and SIM.is_alive())


def _main() -> None:
    ap = argparse.ArgumentParser(description="SkyGuard edge dummy-data feeder")
    ap.add_argument("--gateway", default="http://localhost:3101")
    ap.add_argument("--station", default="EDGE-PUNE-01")
    ap.add_argument("--interval", type=float, default=5.0)
    ap.add_argument("--hours", type=int, default=24)
    a = ap.parse_args()
    url = f"{a.gateway.rstrip('/')}/api/edge/ingest"
    state = {"p": 1008.0, "rng": random.Random()}
    rows = backfill(a.station, a.hours)
    print(f"backfilling {len(rows)} readings to {url} ...")
    for r in rows:
        req = urllib.request.Request(url, json.dumps(r).encode(),
                                     {"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5)
    print(f"live feed every {a.interval}s — Ctrl+C to stop")
    while True:
        r = generate_reading(a.station, None, "auto", state)
        req = urllib.request.Request(url, json.dumps(r).encode(),
                                     {"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5)
        print(r["ts"], r["verdict"], r["t"], r["h"], r["p"])
        time.sleep(a.interval)


if __name__ == "__main__":
    _main()
