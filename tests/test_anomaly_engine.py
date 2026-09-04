"""
====================================================================
SkyGuard — Unit Test Suite (Python 3.9+ stdlib only, no pytest needed)
====================================================================
Validates every specification requirement:

  * L1  Physical plausibility + communication-error (NaN) detection
  * L2  Temporal & seasonal learning (EWMA + hour-of-day, self-healing)
  * L3  Spatial consistency (neighbour-station cross-validation)
  * L4  Multivariate physics (dewpoint, pressure coupling, frozen values)
  * L5  Confidence scores, root-cause classes, explainable evidence
  *     Corrected/imputed values, sensor health & maintenance prediction
  *     SHAP-style explainer, alerting routing, fault injection

Run:
  python -m unittest discover -s tests -v
or
  python tests/test_anomaly_engine.py
"""
from __future__ import annotations

import math
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anomaly_engine import (               # noqa: E402
    AnomalyEngine, Reading, inject_fault,
    PHYSICAL_LIMITS, WARMUP_MIN_SAMPLES,
)
from shap_explainer import SHAPExplainer   # noqa: E402
from alerts import AlertManager, alert_from_engine_result  # noqa: E402

T0 = datetime(2026, 8, 30, 0, 0)


def mk_reading(sid="TEST-01", t=25.0, h=65.0, p=1008.0, step=0):
    return Reading(sid, T0 + timedelta(minutes=10 * step), t, h, p)


def warm_engine(ticks=36, base_t=25.0, base_h=65.0, base_p=1008.0):
    """Seed an engine with `ticks` normal readings from three nearby stations."""
    eng = AnomalyEngine()
    eng.register_station("TEST-01", 19.0, 72.8)
    eng.register_station("TEST-02", 19.05, 72.85)
    eng.register_station("TEST-03", 19.02, 72.82)
    noise = [0, 0.1, -0.1, 0.2, -0.2, 0.05] * 20
    for i in range(ticks):
        for sid, bl in (("TEST-01", base_t), ("TEST-02", base_t + 0.2),
                        ("TEST-03", base_t - 0.1)):
            r = Reading(sid, T0 + timedelta(minutes=10 * i),
                        bl + noise[i] + 0.5 * math.sin(i / 6.0),
                        base_h + noise[i], base_p + 0.1 * noise[i])
            eng.process(r)
    return eng


class TestPhysicalLayer(unittest.TestCase):
    """L1 — range limits, NaN / communication loss, spike steps."""

    def test_normal_readings_pass(self):
        eng = AnomalyEngine()
        eng.register_station("T", 0, 0)
        out = eng.process(mk_reading())
        self.assertEqual(out["verdict"], "NORMAL")
        self.assertEqual(out["root_cause"]["code"], "OK")

    def test_out_of_range_temperature(self):
        eng = AnomalyEngine()
        eng.register_station("T", 0, 0)
        out = eng.process(mk_reading(t=PHYSICAL_LIMITS["temperature"][1] + 20))
        self.assertEqual(out["verdict"], "ANOMALY")
        self.assertTrue(any("outside physical range" in m
                            for _, m in out["layers_detail"]["L1"]))

    def test_humidity_below_zero(self):
        eng = AnomalyEngine()
        eng.register_station("T", 0, 0)
        out = eng.process(mk_reading(h=-5.0))
        self.assertEqual(out["verdict"], "ANOMALY")
        self.assertIn("humidity", {p for p, _ in out["layers_detail"]["L1"]})

    def test_communication_loss_nan(self):
        eng = AnomalyEngine()
        eng.register_station("T", 0, 0)
        eng.process(mk_reading())  # give the engine one prior reading
        out = eng.process(mk_reading(t=float("nan"), h=float("nan"),
                                     p=float("nan"), step=1))
        self.assertEqual(out["verdict"], "ANOMALY")
        self.assertEqual(out["root_cause"]["code"], "COMM_LOSS")
        self.assertTrue(any("communication error" in m.lower()
                            for _, m in out["layers_detail"]["L1"]))

    def test_step_spike_detection(self):
        eng = AnomalyEngine()
        eng.register_station("T", 0, 0)
        eng.process(mk_reading(t=27.0))
        out = eng.process(mk_reading(t=47.0, step=1))   # +20 degC in 1 interval
        self.assertEqual(out["verdict"], "ANOMALY")
        self.assertTrue(any("jumped" in m for _, m in out["layers_detail"]["L1"]))

    def test_timestamp_gap_is_communication_anomaly(self):
        eng = AnomalyEngine()
        eng.register_station("T", 0, 0)
        eng.process(mk_reading(step=0))
        out = eng.process(mk_reading(step=4))  # 40 minutes after the prior sample
        self.assertEqual(out["verdict"], "ANOMALY")
        self.assertEqual(out["root_cause"]["code"], "COMM_LOSS")
        self.assertTrue(any("Communication gap" in m for _, m in out["layers_detail"]["L1"]))


class TestTemporalLayer(unittest.TestCase):
    """L2 — seasonal / EWMA baselines and self-healing learning."""

    def test_warmup_requires_minimum_samples(self):
        eng = AnomalyEngine()
        eng.register_station("T", 0, 0)
        # Vary values slightly so the frozen-value detector is not triggered.
        for i in range(WARMUP_MIN_SAMPLES):
            eng.process(mk_reading(sid="T", t=25.0 + (i % 5) * 0.05,
                                   h=65.0 + (i % 3) * 0.1,
                                   p=1008.0 + (i % 2) * 0.05, step=i))
        self.assertGreaterEqual(
            eng.stations["T"].baseline["temperature"]["n"], WARMUP_MIN_SAMPLES)

    def test_gradual_drift_is_detected(self):
        eng = warm_engine()
        for i in range(10):
            out = eng.process(mk_reading(t=25.0 + 0.8 * (i + 1), step=200 + i))
            if i >= 2:
                self.assertEqual(out["verdict"], "ANOMALY",
                                 f"drift must be caught by tick {i}")

    def test_spike_detected_via_temporal_z(self):
        eng = warm_engine()
        out = eng.process(mk_reading(t=25.0 + 6.0, step=200))
        self.assertEqual(out["verdict"], "ANOMALY")
        self.assertTrue(any("deviates" in m
                            for _, m in out["layers_detail"]["L2"]))

    def test_self_healing_baseline_not_poisoned_by_anomalies(self):
        eng = warm_engine()
        b_before = eng.stations["TEST-01"].baseline["temperature"]["ewma"]
        for i in range(5):
            eng.process(mk_reading(t=40.0, step=300 + i))  # spikes, not learned
        b_after = eng.stations["TEST-01"].baseline["temperature"]["ewma"]
        self.assertLess(abs(b_after - b_before), 0.5)


class TestSpatialLayer(unittest.TestCase):
    """L3 — neighbour-station cross-validation."""

    def test_spatial_outlier_detected(self):
        eng = warm_engine()
        out = eng.process(mk_reading(t=25.0 + 7.0, step=200))
        self.assertEqual(out["verdict"], "ANOMALY")
        self.assertTrue(any("neighbors" in m
                            for _, m in out["layers_detail"]["L3"]))


class TestMultivariateLayer(unittest.TestCase):
    """L4 — dewpoint coherence, pressure coupling, frozen values."""

    def test_frozen_value_detection(self):
        eng = warm_engine()
        for i in range(10):
            out = eng.process(mk_reading(t=25.0, step=200 + i))
        self.assertEqual(out["verdict"], "ANOMALY")
        self.assertEqual(out["root_cause"]["code"], "STUCK_SENSOR")

    def test_dewpoint_conflict(self):
        eng = AnomalyEngine()
        eng.register_station("T", 0, 0)
        for i in range(10):
            eng.process(mk_reading(t=28.0, h=60.0, step=i))
        out = eng.process(mk_reading(t=50.0, h=97.0, step=10))
        self.assertTrue(any("implausible" in m
                            for _, m in out["layers_detail"]["L4"]))

    def test_pressure_drop_detected(self):
        eng = warm_engine()
        eng.process(mk_reading(p=1008.0, step=200))
        out = eng.process(mk_reading(p=996.0, step=201))  # -12 hPa
        self.assertTrue(
            any("fell" in m for _, m in out["layers_detail"]["L4"])
            or any("jumped" in m for _, m in out["layers_detail"]["L1"]))


class TestOutputsAndQuality(unittest.TestCase):
    """L5 — confidence, root causes, evidence, imputation, health."""

    def _run_anomaly(self):
        eng = warm_engine()
        return eng, eng.process(mk_reading(t=25.0 + 8.0, step=200))

    def test_result_schema_complete(self):
        eng, out = self._run_anomaly()
        self.assertEqual(out["verdict"], "ANOMALY")
        for key in ["station_id", "timestamp", "confidence", "score",
                    "layers_triggered", "layers_detail", "evidence",
                    "root_cause", "param_confidence", "corrected",
                    "health_score", "maintenance_due_days", "degradation"]:
            self.assertIn(key, out)

    def test_confidence_in_range(self):
        _, out = self._run_anomaly()
        self.assertGreaterEqual(out["confidence"], 40)
        self.assertLessEqual(out["confidence"], 99)

    def test_root_cause_classification(self):
        _, out = self._run_anomaly()
        valid = {"COMM_LOSS", "STUCK_SENSOR", "SENSOR_FAULT", "SPATIAL_OUTLIER",
                 "REAL_EVENT", "RANGE_VIOLATION", "OK"}
        self.assertIn(out["root_cause"]["code"], valid)
        self.assertTrue(out["root_cause"]["label"])
        self.assertTrue(out["root_cause"]["action"])

    def test_corrected_values_are_imputed(self):
        _, out = self._run_anomaly()
        flagged = {p for iss in out["layers_detail"].values() for p, _ in iss}
        self.assertTrue(flagged)
        for p in flagged:
            self.assertIsNotNone(out["corrected"][p])
            self.assertGreater(out["corrected"][p], 0)

    def test_health_degradation_when_faulting(self):
        eng = warm_engine()
        h0 = eng.health_score("TEST-01")
        for i in range(4):
            eng.process(mk_reading(t=45.0, step=400 + i))
        h1 = eng.health_score("TEST-01")
        self.assertLessEqual(h1, h0)
        deg = eng._degradation(eng.stations["TEST-01"])
        self.assertIn(deg["regime"], ("stable", "drifting", "degrading", "critical"))

    def test_explainable_evidence(self):
        _, out = self._run_anomaly()
        self.assertGreaterEqual(len(out["evidence"]), 1)
        for e in out["evidence"]:
            self.assertIsInstance(e, str)

    def test_confidence_for_normal(self):
        eng = warm_engine()
        out = eng.process(mk_reading(step=200))
        self.assertEqual(out["verdict"], "NORMAL")


class TestFaultInjection(unittest.TestCase):
    def test_spike(self):
        rng = __import__("random").Random(1)
        r = inject_fault(mk_reading(), "spike", rng)
        self.assertGreater(r.temperature, 20)
        self.assertLessEqual(r.humidity, 100.0)

    def test_comm_loss(self):
        r = inject_fault(mk_reading(), "comm_loss", __import__("random").Random(1))
        self.assertTrue(math.isnan(r.temperature) and math.isnan(r.humidity)
                        and math.isnan(r.pressure))

    def test_pressure_drop(self):
        r = inject_fault(mk_reading(), "pressure_drop", __import__("random").Random(1))
        self.assertLess(r.pressure, 1008.0 - 8.0)


class TestCSVBatchProcessing(unittest.TestCase):
    def test_csv_roundtrip(self):
        eng = AnomalyEngine()
        eng.register_station("AWS-1", 19.0, 72.8)
        rows = [
            ("AWS-1", T0.isoformat(), 25.0, 65.0, 1008.0),
            ("AWS-1", (T0 + timedelta(minutes=10)).isoformat(), 26.0, 66.0, 1008.1),
            ("AWS-1", (T0 + timedelta(minutes=20)).isoformat(), 55.0, 66.0, 1008.2),
        ]
        fd, path = tempfile.mkstemp(suffix=".csv")
        try:
            with os.fdopen(fd, "w", newline="") as fh:
                fh.write("station_id,timestamp,temperature,humidity,pressure\n")
                for r in rows:
                    fh.write(",".join(map(str, r)) + "\n")
            import csv as _csv
            verdicts = []
            with open(path, newline="") as f:
                for row in _csv.DictReader(f):
                    r = Reading(row["station_id"],
                                datetime.fromisoformat(row["timestamp"]),
                                float(row["temperature"]),
                                float(row["humidity"]),
                                float(row["pressure"]))
                    verdicts.append(eng.process(r)["verdict"])
            self.assertEqual(verdicts[-1], "ANOMALY")
        finally:
            os.unlink(path)


class TestSHAPExplainer(unittest.TestCase):
    def test_z_regex_parses_engine_messages(self):
        expl = SHAPExplainer(AnomalyEngine())
        self.assertEqual(expl._extract_z("deviates 4.6sigma from seasonal"), 4.6)
        self.assertEqual(expl._extract_z("deviates 4.6σ from seasonal"), 4.6)

    def test_explanation_contract(self):
        eng = warm_engine()
        reading = mk_reading(t=25.0 + 8.0, step=200)
        out = eng.process(reading)
        expl = SHAPExplainer(eng).explain(out, reading,
                                          eng.stations["TEST-01"])
        self.assertEqual(expl.final_score, out["score"])
        self.assertTrue(expl.contributions)
        self.assertEqual(len(expl.top_drivers), min(3, len(expl.contributions)))
        md = expl.to_markdown()
        self.assertIn("Feature Contributions", md)
        d = expl.to_dict()
        self.assertIn("contributions", d)


class TestAlerts(unittest.TestCase):
    def _manager(self, suffix):
        return AlertManager(log_path=os.path.join(
            tempfile.gettempdir(), f"sg_{suffix}.log"))

    def test_anomaly_maps_to_critical(self):
        mgr = self._manager("a")
        result = {
            "verdict": "ANOMALY", "confidence": 91, "station_id": "S1",
            "root_cause": {"label": "Spike", "action": "Inspect"},
            "score": 0.8, "evidence": ["x"], "corrected": {},
            "health_score": 80, "maintenance_due_days": 10,
        }
        alerts = []
        orig = mgr.send
        mgr.send = lambda severity, **kw: alerts.append(severity)
        try:
            alert_from_engine_result(result, mgr)
        finally:
            mgr.send = orig
        self.assertEqual(alerts, ["CRITICAL"])

    def test_normal_does_not_alert(self):
        mgr = self._manager("b")
        result = {
            "verdict": "NORMAL", "confidence": 40, "station_id": "S1",
            "root_cause": {"label": "Nominal", "action": "None"},
            "score": 0.0, "evidence": [], "corrected": {},
            "health_score": 100, "maintenance_due_days": 90,
        }
        sent = []
        orig = mgr.send
        mgr.send = lambda severity, **kw: sent.append(severity)
        try:
            alert_from_engine_result(result, mgr)
        finally:
            mgr.send = orig
        self.assertEqual(sent, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)