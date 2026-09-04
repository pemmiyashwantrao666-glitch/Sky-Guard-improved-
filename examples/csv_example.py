"""
============================================================================
SkyGuard — Example Usage: CSV Batch Processing & Evaluation
============================================================================
Process a CSV file of AWS readings and compute evaluation metrics.

CSV format:
  station_id,timestamp,temperature,humidity,pressure

Usage:
  python examples/csv_example.py data.csv
  python examples/csv_example.py --demo   # run with synthetic data
"""

import csv
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

def _setup_console():
    """Force UTF-8 output so unicode text never crashes a legacy-code-page console."""
    for stream in (sys.stdout, sys.stderr):
        try:
            if stream is not None and hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anomaly_engine import AnomalyEngine, Reading, inject_fault


def process_csv(path: str, engine: AnomalyEngine):
    tp = fp = fn = 0
    injected = 0
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = row["station_id"]
            if sid not in engine.stations:
                engine.register_station(sid, 0.0, 0.0)
            ts = datetime.fromisoformat(row["timestamp"])
            r = Reading(sid, ts, float(row["temperature"]),
                        float(row["humidity"]), float(row["pressure"]))
            out = engine.process(r)
            flag = "ANOMALY" if out["verdict"] == "ANOMALY" else (
                   "WARNING" if out["verdict"] == "WARNING" else "NORMAL")
            print(f"{flag:8s} {out['timestamp']} {sid:10s} "
                  f"conf={out['confidence']:2d}% {out['root_cause']['label']}")


def run_demo_eval():
    rng = random.Random(42)
    engine = AnomalyEngine()
    for sid, lat, lng, bt, bh, bp in [
        ("AWS-01", 19.0, 72.8, 29, 75, 1008),
        ("AWS-02", 19.1, 72.9, 30, 72, 1007),
        ("AWS-03", 19.05, 72.85, 30, 76, 1008),
    ]:
        engine.register_station(sid, lat, lng)

    t0 = datetime(2026, 8, 30, 0, 0)
    base = {sid: (bt, bh, bp)
            for sid, _, _, bt, bh, bp in [
                ("AWS-01", 19.0, 72.8, 29, 75, 1008),
                ("AWS-02", 19.1, 72.9, 30, 72, 1007),
                ("AWS-03", 19.05, 72.85, 30, 76, 1008),
            ]}
    prev_t = {sid: float(bt) for sid, _, _, bt, _, _ in [
        ("AWS-01", 19.0, 72.8, 29, 75, 1008),
        ("AWS-02", 19.1, 72.9, 30, 72, 1007),
        ("AWS-03", 19.05, 72.85, 30, 76, 1008),
    ]}
    schedule = {20: ("AWS-02", "spike"), 50: ("AWS-03", "frozen")}
    active = {}
    tp = fp = fn = 0
    injected = 0

    print("=" * 70)
    print("SkyGuard — Batch Evaluation Demo")
    print("=" * 70)

    for tick in range(120):
        ts = t0 + timedelta(minutes=5 * tick)
        for sid, lat, lng, bt, bh, bp in [
            ("AWS-01", 19.0, 72.8, 29, 75, 1008),
            ("AWS-02", 19.1, 72.9, 30, 72, 1007),
            ("AWS-03", 19.05, 72.85, 30, 76, 1008),
        ]:
            t = bt + random.uniform(-1, 1)
            h = bh + random.uniform(-3, 3)
            p = 1008 + random.uniform(-1, 1)

            if tick in schedule and schedule[tick][0] == sid:
                active[sid] = (schedule[tick][1], 10)
                injected += 1
            if sid in active:
                ftype, left = active[sid]
                r = Reading(sid, ts, t, h, p)
                r = inject_fault(r, ftype, rng)
                if ftype == "frozen":
                    r.temperature = prev_t.get(sid, t)
                    prev_t[sid] = r.temperature
                t, h, p = r.temperature, r.humidity, r.pressure

                reading = Reading(sid, ts, t, h, p)
                out = engine.process(reading)
                expected = True

                left -= 1
                if left <= 0:
                    active.pop(sid)
                    prev_t[sid] = base[sid][0]   # resume cleanly at baseline
                else:
                    active[sid] = (ftype, left)
            else:
                reading = Reading(sid, ts, t, h, p)
                out = engine.process(reading)
                expected = False

            detected = out["verdict"] == "ANOMALY"
            if expected and detected: tp += 1
            elif expected and not detected: fn += 1
            elif not expected and detected: fp += 1

    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0

    print(f"\nInjected faults : {injected}")
    print(f"TP / FP / FN    : {tp} / {fp} / {fn}")
    print(f"Precision       : {precision*100:.1f}%")
    print(f"Recall          : {recall*100:.1f}%")
    print(f"F1 score        : {f1:.2f}")
    print("=" * 70)


if __name__ == "__main__":
    _setup_console()
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        run_demo_eval()
    elif len(sys.argv) > 1:
        engine = AnomalyEngine()
        process_csv(sys.argv[1], engine)
    else:
        print("Usage: python csv_example.py data.csv")
        print("       python csv_example.py --demo")
