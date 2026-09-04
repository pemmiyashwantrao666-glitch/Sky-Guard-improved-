"""
============================================================================
SkyWatch / SkyGuard -  AWS Anomaly Detection Engine
============================================================================
5-layer detection stack (runnable on Python 3.9+ stdlib only):

  L1  Physical plausibility   -  hard range limits + communication-error (NaN)
  L2  Temporal learning       -  EWMA baseline + seasonal hour-of-day mean
  L3  Spatial consistency     -  neighbor-station cross-validation
  L4  Multivariate physics    -  T/RH dewpoint coherence, pressure coupling,
                                frozen-value detection (all parameters)
  L5  Explainable AI          -  per-layer contributions, per-parameter
                                confidence, human-readable evidence

Outputs per reading:
  verdict (ANOMALY / WARNING / NORMAL), confidence %, root-cause class,
  per-parameter confidence, corrected (imputed) values, sensor health score,
  maintenance ETA.

Usage:
  python anomaly_engine.py            # built-in demo
  python anomaly_engine.py --demo     # same
  python anomaly_engine.py --csv data.csv   # CSV columns:
      station_id,timestamp,temperature,humidity,pressure
"""

from __future__ import annotations

import argparse
import csv
import math
import random
import statistics
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PHYSICAL_LIMITS = {
    "temperature": (-10.0, 60.0),
    "humidity":    (0.0, 100.0),
    "pressure":    (870.0, 1084.0),
}

LAYER_WEIGHTS = {"L1": 0.25, "L2": 0.30, "L3": 0.25, "L4": 0.20}
ANOMALY_THRESHOLD = 0.50
WARNING_THRESHOLD = 0.30
Z_THRESHOLD = 2.5
NEIGHBOR_RADIUS_DEG = 0.35
MIN_NEIGHBORS = 2
COMM_LOSS_PENALTY = 0.35   # added score for any NaN param

WARMUP_MIN_SAMPLES = 12     # history samples before L2 temporal checks activate
MAD_WINDOW = 24             # recent trusted values used for robust (MAD) spread
MIN_SD = {"temperature": 0.6, "humidity": 2.0, "pressure": 0.4}  # physical floors
STEP_LIMITS = {"temperature": 8.0, "humidity": 25.0, "pressure": 6.0}  # per interval
TRIMMED_MEAN_FRAC = 0.2     # fraction trimmed each side in robust averages
MAX_RECENT = 30
MAX_INTERVAL_GAP = timedelta(minutes=30)
MAX_TRACKED_GAP = timedelta(hours=24)

PARAM_LABEL = {
    "temperature": "Temperature",
    "humidity":    "Humidity",
    "pressure":    "Pressure",
}
PARAM_UNIT = {"temperature": "degC", "humidity": "%", "pressure": " hPa"}
PARAM_KEYS = ("temperature", "humidity", "pressure")


# ---------------------------------------------------------------------------
# NaN-safe helpers
# ---------------------------------------------------------------------------
def _safe_mean(vals):
    vals = [v for v in vals if v is not None and not math.isnan(v)]
    return statistics.mean(vals) if vals else None

def _safe_pstdev(vals):
    vals = [v for v in vals if v is not None and not math.isnan(v)]
    return statistics.pstdev(vals) if len(vals) >= 2 else None

def _safe_z(value, center, spread):
    if value is None or math.isnan(value):
        return 0.0
    if center is None or spread is None or spread == 0:
        return 0.0
    return abs((value - center) / spread)

def _trimmed_mean(vals, frac: float = TRIMMED_MEAN_FRAC):
    clean = [v for v in vals if v is not None and not math.isnan(v)]
    if not clean:
        return None
    k = max(0, int(len(clean) * frac))
    core = clean[k:(len(clean) - k)] if len(clean) - 2 * k >= 3 else clean
    return statistics.mean(core)


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------
@dataclass
class Reading:
    station_id: str
    timestamp: datetime
    temperature: float
    humidity: float
    pressure: float

    def get(self, key: str) -> float:
        return getattr(self, key)

    def is_nan(self, key: str) -> bool:
        return math.isnan(self.get(key))


@dataclass
class StationState:
    station_id: str
    lat: float = 0.0
    lng: float = 0.0
    baseline: dict = field(default_factory=dict)
    health: dict = field(default_factory=lambda: {
        "drift": 0.0, "faults": 0, "samples": 0, "uptime": 100.0
    })
    last_good: dict | None = None
    last_timestamp: datetime | None = None
    recent: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class AnomalyEngine:
    def __init__(self, z_threshold: float = Z_THRESHOLD):
        self.z_threshold = z_threshold
        self.stations: dict[str, StationState] = {}

    # ---------------- station registry ----------------
    def register_station(self, station_id: str, lat: float, lng: float):
        st = StationState(station_id, lat, lng)
        for p in PARAM_KEYS:
            st.baseline[p] = {"ewma": None, "sd": None, "n": 0, "hourly": {}}
        self.stations[station_id] = st
        return st

    # ---------------- learning ----------------
    def _learn(self, st: StationState, param: str, value: float, hour: int):
        b = st.baseline[param]
        alpha = 0.08
        if b["ewma"] is None:
            b["ewma"], b["sd"], b["n"] = value, 0.8, 1
        else:
            b["ewma"] = alpha * value + (1 - alpha) * b["ewma"]
            dev = abs(value - b["ewma"])
            b["sd"] = 0.9 * (b["sd"] or 0.8) + 0.1 * dev
            b["n"] += 1
        slot = b["hourly"].setdefault(hour, [])
        slot.append(value)
        if len(slot) > 90:
            slot.pop(0)
        window = b.setdefault("window", [])
        window.append(value)
        if len(window) > MAD_WINDOW:
            window.pop(0)

    def _seasonal_mean(self, st: StationState, param: str, hour: int):
        slot = st.baseline[param]["hourly"].get(hour)
        if not slot or len(slot) < 3:
            return None
        return _trimmed_mean(slot)

    # ---------------- L1: physical plausibility + comm errors ----------------
    def _l1_physical(self, st: StationState, r: Reading):
        issues = []
        prev = st.recent[-1] if st.recent else None
        if st.last_timestamp is not None:
            gap = r.timestamp - st.last_timestamp
            if MAX_INTERVAL_GAP < gap <= MAX_TRACKED_GAP:
                issues.append(("communication", f"Communication gap: {gap} since previous reading (maximum expected interval {MAX_INTERVAL_GAP})"))
            elif gap.total_seconds() < 0:
                issues.append(("communication", "Timestamp moved backwards; reject out-of-order reading"))
        for p in PARAM_KEYS:
            v = r.get(p)
            if math.isnan(v):
                issues.append((p, f"{PARAM_LABEL[p]} missing / communication error (NaN)"))
                continue
            lo, hi = PHYSICAL_LIMITS[p]
            if v < lo or v > hi:
                issues.append((p,
                    f"{PARAM_LABEL[p]} {v:.1f}{PARAM_UNIT[p]} outside physical range [{lo},{hi}]{PARAM_UNIT[p]}"
                ))
            if prev is not None:
                pv = prev.get(p)
                if not math.isnan(pv):
                    jump = abs(v - pv)
                    if jump > STEP_LIMITS[p]:
                        issues.append((p,
                            f"{PARAM_LABEL[p]} jumped {jump:.1f}{PARAM_UNIT[p]} in one interval (spike limit {STEP_LIMITS[p]:.0f}{PARAM_UNIT[p]})"
                        ))
        return issues

    # ---------------- L2: temporal z-scores ----------------
    def _spread(self, b: dict, param: str) -> float:
        """Robust spread estimate = max(EWMA sd, physical floor, MAD-based sigma)."""
        base = max(b["sd"] or 0.001, MIN_SD[param])
        window = b.get("window", [])
        if len(window) >= 8:
            med = statistics.median(window)
            mad = statistics.median([abs(x - med) for x in window])
            robust = 1.4826 * mad
            return max(base, robust)
        return base

    def _l2_temporal(self, st: StationState, r: Reading):
        issues = []
        hour = r.timestamp.hour
        for p in PARAM_KEYS:
            v = r.get(p)
            if math.isnan(v):
                continue
            b = st.baseline[p]
            if b["n"] < WARMUP_MIN_SAMPLES:
                continue
            sd = self._spread(b, p)
            seas = self._seasonal_mean(st, p, hour)
            reference = seas if seas is not None else b["ewma"]
            z = _safe_z(v, reference, sd)
            if z >= self.z_threshold:
                if seas is not None:
                    issues.append((p,
                        f"{PARAM_LABEL[p]} deviates {z:.1f}sigma from seasonal expectation ({seas:.1f}{PARAM_UNIT[p]})"
                    ))
                else:
                    issues.append((p,
                        f"{PARAM_LABEL[p]} deviates {z:.1f}sigma from learned baseline ({b['ewma']:.1f}{PARAM_UNIT[p]})"
                    ))
        return issues

    # ---------------- L3: spatial consistency ----------------
    def _l3_spatial(self, r: Reading):
        issues = []
        me = self.stations.get(r.station_id)
        if me is None:
            return issues
        neighbors = [
            s for s in self.stations.values()
            if s.station_id != r.station_id
            and math.hypot(s.lat - me.lat, s.lng - me.lng) < NEIGHBOR_RADIUS_DEG
            and s.last_good is not None
            and all(not math.isnan(v) for v in s.last_good.values())
        ]
        if len(neighbors) < MIN_NEIGHBORS:
            return issues
        for p in PARAM_KEYS:
            v = r.get(p)
            if math.isnan(v):
                continue
            nv = [s.last_good[p] for s in neighbors]
            mean = _safe_mean(nv)
            if mean is None:
                continue
            spread = _safe_pstdev(nv) or 0.001
            z = abs((v - mean) / (spread * 1.6))
            if z >= self.z_threshold + 0.5:
                issues.append((p,
                    f"{PARAM_LABEL[p]} {v:.1f}{PARAM_UNIT[p]} disagrees with {len(neighbors)} neighbors (avg {mean:.1f}{PARAM_UNIT[p]}, {z:.1f}sigma)"
                ))
        return issues

    # ---------------- L4: multivariate physics ----------------
    def _l4_multivariate(self, st: StationState, r: Reading, recent: list[Reading]):
        issues = []
        t = r.temperature
        h = r.humidity
        p = r.pressure

        # Dewpoint coherence
        if not (math.isnan(t) or math.isnan(h)):
            dp = t - (100 - h) / 5
            if t >= 45 and h >= 85:
                issues.append(("temperature",
                    f"Physics conflict: {t:.0f}degC with {h:.0f}% RH implausible (dewpoint {dp:.0f}degC >= T)"
                ))

        # Pressure drop vs previous reading
        if not math.isnan(p) and recent:
            prev_p = recent[-1].pressure
            if not math.isnan(prev_p):
                drop = prev_p - p
                if drop >= 5:
                    issues.append(("pressure",
                        f"Pressure fell {drop:.1f} hPa in one interval -  verify against wind/rain response"
                    ))

        # Frozen sensor -  all parameters
        if len(recent) >= 8:
            for p in PARAM_KEYS:
                tail = recent[-8:]
                last_v = getattr(tail[-1], p)
                if any(math.isnan(getattr(x, p)) for x in tail):
                    continue
                if all(abs(getattr(x, p) - last_v) < 1e-6 for x in tail):
                    issues.append((p,
                        f"Frozen value: {PARAM_LABEL[p]} unchanged for 8+ consecutive samples -> stuck sensor"
                    ))
        return issues

    def _extract_z(self, msg: str) -> float:
        import re
        m = re.search(r"([0-9.]+)sigma", msg)
        return float(m.group(1)) if m else self.z_threshold + 1.0

    # ---------------- root-cause classifier ----------------
    def _classify(self, layers: dict, frozen: bool, comm_loss: bool):
        keys = {p for iss in layers.values() for p, _ in iss}
        spat = layers["L3"]
        temp = layers["L2"]

        if comm_loss:
            return {"code": "COMM_LOSS", "label": "Communication Error / Missing Data",
                    "action": "Check datalogger link; verify sensor power & serial connection"}
        if frozen:
            return {"code": "STUCK_SENSOR", "label": "Stuck/Frozen Sensor",
                    "action": "Restart datalogger; check sensor cable & ADC"}
        if {"temperature", "humidity"} <= keys and layers["L4"]:
            return {"code": "SENSOR_FAULT", "label": "Multi-Sensor Fault",
                    "action": "Recalibrate station; verify RH + T probes"}
        if spat and not temp:
            return {"code": "SPATIAL_OUTLIER", "label": "Spatial Outlier (likely sensor)",
                    "action": "Cross-check with neighbor stations; inspect sensor"}
        if temp and spat:
            return {"code": "SENSOR_FAULT", "label": "Sensor Fault (temporal+spatial)",
                    "action": "Schedule calibration; flag data as suspect"}
        if spat:
            return {"code": "SPATIAL_OUTLIER", "label": "Spatial Outlier",
                    "action": "Verify against neighbors before use"}
        if temp and not spat:
            return {"code": "REAL_EVENT", "label": "Possible Real Weather Event",
                    "action": "Monitor -  no spatial disagreement; may be genuine"}
        if layers["L1"]:
            return {"code": "RANGE_VIOLATION", "label": "Range Violation",
                    "action": "Check sensor wiring / datalogger config"}
        return {"code": "OK", "label": "Nominal", "action": "None"}

    # ---------------- per-parameter confidence ----------------
    def _param_confidence(self, layers: dict, score: float) -> dict:
        """Return per-parameter confidence % based on max evidence z-score."""
        param_z = {p: [] for p in PARAM_KEYS}
        for name, issues in layers.items():
            for p, msg in issues:
                if p in param_z:
                    param_z[p].append(self._extract_z(msg))
        conf = {}
        for p in PARAM_KEYS:
            if not param_z[p]:
                conf[p] = None
            else:
                zmax = max(param_z[p])
                # Map zmax to confidence: z_thresh -> 60%, z_thresh+4 -> 99%
                c = 60 + min(39, (zmax - self.z_threshold) * 10)
                conf[p] = int(max(60, min(99, round(c))))
        return conf

    # ---------------- health ----------------
    def _update_health(self, st: StationState, is_anomaly: bool):
        H = st.health
        H["samples"] += 1
        if is_anomaly:
            H["faults"] += 1
        b = st.baseline["temperature"]
        if b["n"] > 20 and b["ewma"] is not None and st.last_good:
            bias = abs(st.last_good["temperature"] - b["ewma"])
            H["drift"] = 0.95 * H["drift"] + 0.05 * bias
        H["uptime"] = max(0.0, 100 - (H["faults"] / max(H["samples"], 1)) * 100)

    def _raw_health(self, st: StationState) -> float:
        H = st.health
        return max(0.0, min(100.0,
            100 - H["drift"] * 6 - (H["faults"] / max(H["samples"], 1)) * 60))

    def health_score(self, station_id: str) -> int:
        st = self.stations.get(station_id)
        if not st:
            return 100
        return int(round(self._raw_health(st)))

    def _degradation(self, st: StationState) -> dict:
        """Predict sensor degradation & maintenance need from fault rate + drift."""
        H = st.health
        n = max(H["samples"], 1)
        rate = H["faults"] / n
        drift = H["drift"]
        health = self._raw_health(st)

        if rate >= 0.15 or health <= 40:
            regime, base_days, action = (
                "critical", 2,
                "Immediate inspection -  recalibrate or replace failing probes")
        elif rate >= 0.05 or health <= 70:
            regime, base_days, action = (
                "degrading", max(3, round(health / 12)),
                "Schedule maintenance this week; monitor drift trend")
        elif drift >= 0.8:
            regime, base_days, action = (
                "drifting", max(7, round(health / 8)),
                "Calibrate at next visit; flag data as low-confidence")
        else:
            regime, base_days, action = (
                "stable", 90, "Routine maintenance; no immediate action")

        days = int(max(1, min(90, base_days)))
        return {
            "regime": regime,
            "days_to_maintenance": days,
            "health_score": int(round(health)),
            "recommended_action": action,
            "fault_rate": round(rate, 3),
            "drift": round(drift, 2),
        }

    def maintenance_days(self, station_id: str) -> int:
        st = self.stations.get(station_id)
        if not st:
            return 90
        return self._degradation(st)["days_to_maintenance"]

    # ---------------- master inference ----------------
    def process(self, r: Reading, learn: bool = True) -> dict:
        if r.station_id not in self.stations:
            self.register_station(r.station_id, 0.0, 0.0)
        st = self.stations[r.station_id]
        recent = st.recent

        layers = {
            "L1": self._l1_physical(st, r),
            "L2": self._l2_temporal(st, r),
            "L3": self._l3_spatial(r),
            "L4": self._l4_multivariate(st, r, recent),
        }
        frozen = any("Frozen" in m for _, m in layers["L4"])
        comm_loss = any("communication" in m.lower() for _, m in layers["L1"])

        score = 0.0
        for name, issues in layers.items():
            if not issues:
                continue
            w = LAYER_WEIGHTS[name]
            if name in ("L1", "L4"):
                score += w * min(1.0, len(issues) / 2)
            else:
                zs = [self._extract_z(m) for _, m in issues]
                zmax = max(zs)
                strength = min(1.0, zmax / (self.z_threshold + 1.5))
                score += w * strength

        if comm_loss:
            score = max(score, ANOMALY_THRESHOLD + 0.05)
        if frozen:
            score = max(score, ANOMALY_THRESHOLD + 0.05)
        if layers["L1"]:
            # Hard physical violations (range, NaN, spike step) are decisive -
            # a single implausible reading is an anomaly regardless of scale.
            score = max(score, ANOMALY_THRESHOLD + 0.05)

        layers_hit = [k for k, v in layers.items() if v]
        if len(layers_hit) >= 2:
            score += 0.15 * (len(layers_hit) - 1)

        is_anomaly = score >= ANOMALY_THRESHOLD
        is_warning = not is_anomaly and score >= WARNING_THRESHOLD

        agreement = len(layers_hit) / 4
        confidence = int(max(40, min(99, round(
            (0.55 + 0.45 * agreement) * (100 if is_anomaly else 70)
        ))))

        root_cause = self._classify(layers, frozen, comm_loss)
        param_conf = self._param_confidence(layers, score)

        # corrected (imputed) values
        corrected = {}
        flagged = {p for iss in layers.values() for p, _ in iss if p in PARAM_KEYS}
        hour = r.timestamp.hour
        for p in PARAM_KEYS:
            if p not in flagged:
                corrected[p] = None
                continue
            candidates = []
            seas = self._seasonal_mean(st, p, hour)
            if seas is not None and not math.isnan(seas):
                candidates.append(seas)
            neigh = [
                s.last_good[p] for s in self.stations.values()
                if s.station_id != r.station_id and s.last_good
                and not math.isnan(s.last_good[p])
                and math.hypot(s.lat - st.lat, s.lng - st.lng) < NEIGHBOR_RADIUS_DEG
            ]
            if neigh:
                candidates.append(statistics.median(neigh))
            if not candidates and st.baseline[p]["ewma"] is not None:
                candidates.append(st.baseline[p]["ewma"])
            corrected[p] = round(statistics.mean(candidates), 2) if candidates else None

        # update state
        if learn and not is_anomaly:
            for p in PARAM_KEYS:
                v = r.get(p)
                if not math.isnan(v):
                    self._learn(st, p, v, hour)
        if not is_anomaly and not comm_loss and not any(math.isnan(r.get(p)) for p in PARAM_KEYS):
            st.last_good = {p: r.get(p) for p in PARAM_KEYS}
        self._update_health(st, is_anomaly)
        recent.append(r)
        st.last_timestamp = r.timestamp
        if len(recent) > MAX_RECENT:
            recent.pop(0)

        verdict = "ANOMALY" if is_anomaly else ("WARNING" if is_warning else "NORMAL")
        return {
            "station_id": r.station_id,
            "timestamp": r.timestamp.isoformat(),
            "verdict": verdict,
            "confidence": confidence,
            "score": round(score, 3),
            "layers_triggered": layers_hit,
            "layers_detail": layers,
            "evidence": [m for iss in layers.values() for _, m in iss],
            "root_cause": root_cause,
            "param_confidence": param_conf,
            "corrected": corrected,
            "health_score": self.health_score(r.station_id),
            "maintenance_due_days": self.maintenance_days(r.station_id),
            "degradation": self._degradation(st),
        }


# ---------------------------------------------------------------------------
# Fault injection
# ---------------------------------------------------------------------------
def inject_fault(reading: Reading, fault: str, rng: random.Random) -> Reading:
    """Return a copy of the reading with a synthetic sensor fault applied."""
    r = Reading(reading.station_id, reading.timestamp,
                reading.temperature, reading.humidity, reading.pressure)
    if fault == "spike":
        r.temperature += rng.uniform(14, 22)
        r.humidity = min(100.0, r.humidity + rng.uniform(20, 30))
    elif fault == "stuck":
        pass  # caller freezes values externally
    elif fault == "drift":
        r.temperature += rng.uniform(0.5, 1.2)
    elif fault == "frozen":
        pass  # caller repeats previous value
    elif fault == "comm_loss":
        r.temperature = r.humidity = r.pressure = float("nan")
    elif fault == "pressure_drop":
        r.pressure -= rng.uniform(8, 14)
    return r


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------
STATIONS = [
    ("MUM-01", 18.906, 72.815, 29, 78, 1008),
    ("MUM-02", 19.088, 72.852, 30, 74, 1007),
    ("MUM-03", 19.055, 72.840, 30, 76, 1008),
    ("MUM-04", 19.136, 72.855, 31, 70, 1007),
    ("MUM-05", 19.180, 72.960, 29, 82, 1009),
    ("MUM-06", 19.033, 73.020, 31, 71, 1007),
]

def run_demo():
    rng = random.Random(42)
    engine = AnomalyEngine()
    for sid, lat, lng, *_ in STATIONS:
        engine.register_station(sid, lat, lng)

    t0 = datetime(2026, 8, 30, 0, 0)
    frozen_t = {}          # per-station frozen value while the fault is active
    drift_bias = {}        # accumulated sensor drift (degC) while drift fault is active
    meso_t = 0.0           # shared mesoscale temperature field (degC offset)
    meso_p = 0.0           # shared mesoscale pressure field (hPa offset)

    schedule = {
        40:  ("MUM-03", "spike"),
        70:  ("MUM-05", "frozen"),
        100: ("MUM-02", "pressure_drop"),
        130: ("MUM-04", "drift"),
        160: ("MUM-06", "comm_loss"),
    }
    active = {}
    tp = fp = fn = 0
    injected = 0
    anomalies_log = []

    print("=" * 78)
    print("SkyWatch / SkyGuard -  200 ticks, 6 stations, 5 injected faults")
    print("=" * 78)

    for tick in range(200):
        ts = t0 + timedelta(minutes=10 * tick)
        hour = ts.hour
        # Mesoscale shared fields give a physically coherent regional field:
        # neighbouring AWS stations track the same slow-moving weather, so
        # normal readings stay tightly correlated and genuine faults stand out.
        meso_t += rng.uniform(-0.4, 0.4)
        meso_t = max(-3.5, min(3.5, meso_t))
        meso_p += rng.uniform(-0.35, 0.35)
        meso_p = max(-2.5, min(2.5, meso_p))
        for sid, lat, lng, bt, bh, bp in STATIONS:
            t = (bt + meso_t
                 + 2.5 * math.sin((hour - 6) / 24 * 2 * math.pi)
                 + rng.uniform(-0.25, 0.25))
            # Humidity anti-correlates mildly with the temperature field.
            h = max(bh - 6, min(bh + 6, bh + rng.uniform(-2.0, 2.0) - 0.35 * meso_t))
            p = bp + meso_p + rng.uniform(-0.3, 0.3)

            if tick in schedule and schedule[tick][0] == sid:
                fault = schedule[tick][1]
                active[sid] = (fault, 10)
                injected += 1
            if sid in active:
                fault, left = active[sid]
                r = Reading(sid, ts, t, h, p)
                r = inject_fault(r, fault, rng)
                if fault == "frozen":
                    r.temperature = frozen_t.get(sid, t)
                    frozen_t[sid] = r.temperature
                elif fault == "drift":
                    # Slow sensor bias ACCUMULATES over time; the single-sample
                    # jitter from inject_fault is below threshold, so we carry
                    # the running bias here.
                    drift_bias[sid] = drift_bias.get(sid, 0.0) + rng.uniform(0.5, 1.2)
                    r.temperature += drift_bias[sid]
                t, h, p = r.temperature, r.humidity, r.pressure

                reading = Reading(sid, ts, t, h, p)
                out = engine.process(reading)
                expected_anomaly = True

                left -= 1
                if left <= 0:
                    active.pop(sid)
                    frozen_t.pop(sid, None)
                    drift_bias.pop(sid, None)
                    # The shared mesoscale fields guarantee the station resumes
                    # at a physically plausible value the moment the fault ends.
                else:
                    active[sid] = (fault, left)
            else:
                reading = Reading(sid, ts, t, h, p)
                out = engine.process(reading)
                expected_anomaly = False

            detected = out["verdict"] == "ANOMALY"
            if expected_anomaly and detected:
                tp += 1
            elif expected_anomaly and not detected:
                fn += 1
            elif not expected_anomaly and detected:
                fp += 1

            if detected:
                anomalies_log.append(out)

    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0

    print(f"\nInjected faults : {injected}")
    print(f"TP / FP / FN    : {tp} / {fp} / {fn}")
    print(f"Precision       : {precision*100:.1f}%")
    print(f"Recall          : {recall*100:.1f}%")
    print(f"F1 score        : {f1:.2f}")

    print("\n--- Sample detected anomalies ---")
    for a in anomalies_log[:5]:
        print(f"\n[{a['timestamp']}] {a['station_id']} -> {a['verdict']} "
              f"(confidence {a['confidence']}%)")
        print(f"  Root cause : {a['root_cause']['label']}")
        print(f"  Action     : {a['root_cause']['action']}")
        for e in a["evidence"]:
            print(f"  * {e}")
        pc = {k: (f"{v}%" if v is not None else " -") for k, v in a["param_confidence"].items()}
        print(f"  Param conf : {pc}")
        corr = {k: v for k, v in a["corrected"].items() if v is not None}
        if corr:
            print(f"  Corrected  : {corr}")
        print(f"  Health     : {a['health_score']}/100, maintenance in {a['maintenance_due_days']} days")

    print("\n--- Sensor health summary ---")
    for sid in engine.stations:
        print(f"  {sid}: health {engine.health_score(sid)}/100, "
              f"maintenance due in {engine.maintenance_days(sid)} days")


def run_csv(path: str):
    engine = AnomalyEngine()
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = row["station_id"]
            if sid not in engine.stations:
                engine.register_station(sid,
                    float(row.get("lat", 0) or 0),
                    float(row.get("lng", 0) or 0))
            ts = datetime.fromisoformat(row["timestamp"])
            r = Reading(sid, ts,
                        float(row["temperature"]),
                        float(row["humidity"]),
                        float(row["pressure"]))
            out = engine.process(r)
            flag = "ANOMALY" if out["verdict"] == "ANOMALY" else ("WARNING" if out["verdict"] == "WARNING" else "NORMAL")
            print(f"{flag:8s} {out['timestamp']} {sid:8s} "
                  f"conf={out['confidence']:2d}% {out['root_cause']['label']}")


def _setup_console():
    """Force UTF-8 output with 'replace' so unicode (°C, em-dashes) never crashes
    a console running under a legacy code page (e.g. Windows cp1252)."""
    for stream in (sys.stdout, sys.stderr):
        try:
            if stream is not None and hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


if __name__ == "__main__":
    _setup_console()
    ap = argparse.ArgumentParser(description="SkyWatch / SkyGuard AWS anomaly engine")
    ap.add_argument("--csv", help="CSV with station_id,timestamp,temperature,humidity,pressure")
    ap.add_argument("--demo", action="store_true", help="run built-in simulation demo")
    args = ap.parse_args()
    if args.csv:
        run_csv(args.csv)
    else:
        run_demo()
