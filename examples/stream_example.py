"""
============================================================================
SkyGuard — Example Usage: Real-Time Stream Processing
============================================================================
Simulates a live stream of AWS sensor data and processes each reading
through the anomaly engine with real-time alerts and SHAP explanations.

Usage:
  python examples/stream_example.py
"""

import sys
import time
import random
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

from anomaly_engine import AnomalyEngine, Reading
from datetime import datetime, timedelta
from alerts import AlertManager, alert_from_engine_result
from shap_explainer import SHAPExplainer


def run_stream_example():
    _setup_console()
    engine = AnomalyEngine()
    engine.register_station("AWS-MUM-01", 19.076, 72.877)
    engine.register_station("AWS-MUM-02", 19.089, 72.865)
    engine.register_station("AWS-DEL-01", 28.613, 77.209)

    alert_mgr = AlertManager()
    explainer = SHAPExplainer(engine)

    t0 = datetime(2026, 8, 30, 12, 0)
    faults = {
        20: ("AWS-MUM-01", "spike"),
        45: ("AWS-DEL-01", "frozen"),
        70: ("AWS-MUM-02", "comm_loss"),
    }
    active = {}

    print("=" * 70)
    print("SkyGuard — Real-Time Stream Example")
    print("=" * 70)

    for tick in range(100):
        ts = t0 + timedelta(seconds=tick * 5)
        for sid in ["AWS-MUM-01", "AWS-MUM-02", "AWS-DEL-01"]:
            base_t = 29 if "MUM" in sid else 27
            t = base_t + random.uniform(-1, 1)
            h = random.uniform(60, 80)
            p = random.uniform(1007, 1010)

            if tick in faults and faults[tick][0] == sid:
                active[sid] = (faults[tick][1], 10)

            if sid in active:
                ftype, left = active[sid]
                if ftype == "spike":
                    t += random.uniform(12, 20)
                elif ftype == "frozen":
                    t = base_t
                elif ftype == "comm_loss":
                    t, h, p = float("nan"), float("nan"), float("nan")
                left -= 1
                if left <= 0:
                    active.pop(sid)

            reading = Reading(sid, ts, t, h, p)
            result = engine.process(reading)

            # Real-time alert
            alert_from_engine_result(result, alert_mgr)

            # SHAP explanation for anomalies
            if result["verdict"] == "ANOMALY":
                st = engine.stations[sid]
                expl = explainer.explain(result, reading, st)
                print(f"\n[{ts.strftime('%H:%M:%S')}] {sid} -> {result['verdict']} "
                      f"(conf={result['confidence']}%)")
                print(f"  Root cause : {result['root_cause']['label']}")
                print(f"  Action     : {result['root_cause']['action']}")
                for e in result["evidence"][:3]:
                    print(f"  * {e}")
                corr = {k: v for k, v in result["corrected"].items() if v is not None}
                if corr:
                    print(f"  Corrected  : {corr}")
                deg = result.get("degradation", {})
                print(f"  Health     : {result['health_score']}/100, "
                      f"maintenance in {result['maintenance_due_days']} days "
                      f"[{deg.get('regime', 'n/a')}]")
                print(f"  Top drivers: {', '.join(expl.top_drivers)}")

        time.sleep(0.05)

    print("\n" + "=" * 70)
    print("Stream processing complete.")
    print("=" * 70)


if __name__ == "__main__":
    run_stream_example()
