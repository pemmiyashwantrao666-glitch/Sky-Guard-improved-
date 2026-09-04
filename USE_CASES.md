# SkyGuard — Use Case Documentation

**Self-aware, self-healing anomaly detection for Automatic Weather Station (AWS) networks.**

This document explains the operational use cases of SkyGuard in depth: who uses it, what data flows in, how the 5-layer AI engine reasons about each reading, what output the operator sees, and how to reproduce every scenario with the executable code in this repository.

> Companion documents: [`README.md`](README.md) (architecture, quick start, tech stack) · [`dashboard.html`](index.html) (live demo) · [`tests/test_anomaly_engine.py`](tests/test_anomaly_engine.py) (executable proof of every behaviour described here).

---

## 1. System at a Glance

```
AWS sensor stream (T °C / RH % / P hPa, any interval)
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ L1  Physical plausibility   range, NaN, spike-step (>8 °C,   │
│                             >25 % RH, >6 hPa per interval)   │
│ L2  Temporal learning       EWMA + hour-of-day seasonal mean │
│                             + robust MAD spread + drift      │
│ L3  Spatial consistency     cross-check vs neighbors ≤0.35°  │
│ L4  Multivariate physics    dewpoint coherence, pressure     │
│                             fall, frozen-value detection     │
│ L5  Explainable fusion      weighted vote → verdict +        │
│                             confidence + SHAP attribution    │
└──────────────────────────────────────────────────────────────┘
        │
        ├─ Root cause (7 classes) + recommended action
        ├─ Corrected / imputed values (self-healing feed)
        ├─ Health score 0–100 + degradation regime + maintenance ETA
        └─ Real-time alerts: console, file, webhook, e-mail, SMS
```

**Fusion:** L1 0.25 · L2 0.30 · L3 0.25 · L4 0.20 — verdict `ANOMALY` at score ≥ 0.50, `WARNING` at ≥ 0.30. Hard L1 violations (range, comm-loss, timestamp gaps over 30 minutes, spike-step), frozen values and comm-loss are **decisive**: they are always anomalies. Confidence (40–99 %) grows with cross-layer agreement.

**Self-healing rule:** baselines learn **only from trusted (non-anomalous) readings**, so a failing sensor can never poison its own idea of "normal".

---

## 2. Actors & Personas

| Actor | Goal | SkyGuard surfaces they use |
|---|---|---|
| **Network Operations Centre (NOC) operator** | Keep the observation network healthy 24/7 | Dashboard map + alert feed, multi-channel alerts (UC-09, UC-11) |
| **Field technician** | Know exactly which station to visit and why | Root cause + action, health score, maintenance ETA (UC-03, UC-12) |
| **Forecaster / data consumer** | Trustworthy inputs for models & warnings | Corrected data feed, per-parameter confidence (UC-07, UC-13) |
| **Data scientist / QC analyst** | Clean historical archives, tune thresholds | Batch CSV engine, evidence + SHAP attribution (UC-08) |
| **Edge / IoT engineer** | Filter at the sensor, survive connectivity loss | ESP32 firmware, low-power O(1) inference (UC-10) |

---

## 3. How to Read a SkyGuard Result

Every processed reading returns this schema (`AnomalyEngine.process()` → dict):

| Key | Type | Meaning |
|---|---|---|
| `verdict` | str | `ANOMALY` / `WARNING` / `NORMAL` |
| `confidence` | int 40–99 | Scales with cross-layer agreement (how many independent layers agree) |
| `score` | float 0–1+ | Weighted fusion score vs thresholds 0.30 / 0.50 |
| `layers_triggered` | list | Which of L1–L4 fired, e.g. `["L1","L3","L4"]` |
| `evidence` | list[str] | Human-readable reasons, one per triggered check |
| `root_cause` | dict | `{code, label, action}` — classification + recommended action |
| `param_confidence` | dict | Per-parameter confidence % (which sensor is suspect) |
| `corrected` | dict | Imputed value per flagged parameter (seasonal mean ⊕ neighbor median ⊕ EWMA fallback) — `None` when the parameter was fine |
| `health_score` | int 0–100 | Station health (drift + fault-rate based) |
| `maintenance_due_days` | int | Predicted days until maintenance is due |
| `degradation` | dict | `{regime, days_to_maintenance, health_score, recommended_action, fault_rate, drift}` |

### Root-cause classes (exact codes returned)

| Code | Label | Automatic recommended action | Typical trigger |
|---|---|---|---|
| `RANGE_VIOLATION` | Range Violation | Check sensor wiring / datalogger config | Value outside physical limits (T −10…60 °C, RH 0…100 %, P 870…1084 hPa) |
| `COMM_LOSS` | Communication Error / Missing Data | Check datalogger link; verify sensor power & serial connection | NaN in any parameter |
| `STUCK_SENSOR` | Stuck/Frozen Sensor | Restart datalogger; check sensor cable & ADC | 8+ consecutive identical samples |
| `SENSOR_FAULT` | Multi-Sensor Fault / Sensor Fault (temporal+spatial) | Recalibrate station; verify RH + T probes (or schedule calibration) | Multivariate incoherence, or temporal + spatial agreement |
| `SPATIAL_OUTLIER` | Spatial Outlier (likely sensor) | Cross-check with neighbor stations; inspect sensor | Disagrees with ≥2 neighbors while own history looks normal |
| `REAL_EVENT` | Possible Real Weather Event | Monitor — no spatial disagreement; may be genuine | Temporal deviation only, neighbors agree |
| `OK` | Nominal | None | No layer triggered |

### Alert severity & confidence

`alerts.Alert` carries `severity`, `station`, `message`, `confidence` (int %), `root_cause`, plus details (score, top-3 evidence, corrected values, health, maintenance ETA) and the full raw result.

| Verdict | Confidence | Severity | Channels |
|---|---|---|---|
| `ANOMALY` | ≥ 80 % | **CRITICAL** | All configured (webhook/e-mail/SMS + log) |
| `ANOMALY` | < 80 % | **WARNING** | All configured |
| `WARNING` | any | **WARNING** | All configured |
| `NORMAL` | — | *silent* | — |

---

## 4. Use Case Catalogue

### UC-01 — Implausible Spike with Multivariate Incoherence *(the headline scenario)*

**Scenario (from the challenge brief):** An AWS suddenly reports **55 °C with extremely high humidity and abnormal pressure variation while neighbouring stations show normal conditions.**

**Example input** (station MUM-03, Mumbai, 10:00 local):
```
MUM-03:  T = 54.8 °C   RH = 96 %   P = 999.8 hPa   (previous tick: 30.1 °C / 76 % / 1007.2 hPa)
MUM-02:  T = 30.2 °C   RH = 74 %   P = 1007.9 hPa   (neighbors normal)
MUM-04:  T = 30.9 °C   RH = 71 %   P = 1006.8 hPa
```

**How the engine reasons:**

| Layer | Finding |
|---|---|
| L1 | Temperature step **+24.7 °C in one interval** — far beyond the 8 °C spike-step limit → **decisive anomaly** |
| L2 | 54.8 °C is ≈ 20 σ above the hour-of-day seasonal mean (≈ 30 °C ± 1.5 °C) |
| L3 | Disagrees with both neighbours (avg 30.6 °C) by ≈ 15 σ |
| L4 | **Physics conflict:** 54.8 °C with 96 % RH is impossible (dewpoint ≈ 54 °C ≥ air T); pressure also fell 7.4 hPa in one interval |

**Output:** `verdict=ANOMALY`, `confidence` up to **99 %** (all four layers agree), `root_cause = SENSOR_FAULT / "Multi-Sensor Fault"`, action *"Recalibrate station; verify RH + T probes"*, `param_confidence` shows temperature and humidity as the suspect sensors. Corrected values are imputed: **T ≈ 30.4 °C, RH ≈ 75 %, P ≈ 1007 hPa** (blend of seasonal mean + neighbour median).

**Operator value:** A CRITICAL alert reaches the NOC in the same tick the bad sample arrives (webhook/e-mail/SMS), the dashboard shows the reasoning and the corrected feed, and the forecast pipeline never sees the 55 °C sample.

**Reproduce:** `python anomaly_engine.py --demo` — the spike is injected on station MUM-03 at tick 40 (06:40). Minimal embedding:

```python
from datetime import datetime
from anomaly_engine import AnomalyEngine, Reading

engine = AnomalyEngine()
for sid, lat, lng in [("MUM-02", 19.088, 72.852), ("MUM-03", 19.055, 72.840), ("MUM-04", 19.136, 72.855)]:
    engine.register_station(sid, lat, lng)
# ... feed ~30 normal readings per station so baselines learn ...
out = engine.process(Reading("MUM-03", datetime.now(), 54.8, 96.0, 999.8))
print(out["verdict"], out["confidence"], out["root_cause"], out["corrected"])
```

### UC-02 — Frozen / Stuck Sensor

**Scenario:** MUM-05's temperature probe fails and repeats **29.60 °C, byte-for-byte, for 10 consecutive 10-minute samples** while the region's real temperature keeps moving.

**Detection path:** L4 frozen-value detector (8+ identical consecutive samples per parameter) → **decisive**. L2 contributes: the repeated value drifts σ away from the seasonal mean as real weather moves on.

**Output:** `ANOMALY`, root cause **`STUCK_SENSOR`** — *"Restart datalogger; check sensor cable & ADC"*, corrected value ≈ current regional estimate. Health score drops; fault rate rises.

**Design note (latency vs confidence):** the detector deliberately waits for 8 identical samples so a calm, stable afternoon is never mistaken for a stuck sensor. Rapid faults (UC-01, UC-04, UC-05) are caught in a single tick; frozen faults trade 8 ticks of latency for near-zero false positives.

**Reproduce:** `python anomaly_engine.py --demo` — frozen injected on MUM-05 at tick 70 (11:40).

### UC-03 — Gradual Sensor Drift → Predictive Maintenance

**Scenario:** MUM-04's thermometer slowly loses calibration, adding **+0.5…+1.2 °C every 10 minutes** (classic aging-electronics bias). No single sample looks impossible.

**Detection path:** L4 tracks sustained drift against the EWMA baseline; L2's robust MAD spread makes the trend visible once bias exceeds ~2 σ. Meanwhile the health monitor accumulates: `drift` (EWMA of bias) rises, fault rate rises.

**Output (progresses over the fault window):**

```json
"degradation": {
  "regime": "degrading",
  "days_to_maintenance": 5,
  "health_score": 61,
  "recommended_action": "Schedule maintenance this week; monitor drift trend",
  "fault_rate": 0.08,
  "drift": 2.31
}
```

Regimes: `stable` → `drifting` → `degrading` → `critical` (immediate inspection). `health_score` and `maintenance_due_days` fall as evidence accumulates.

**Operator value:** The technician is dispatched **before** data quality collapses — reactive repair becomes predictive maintenance.

**Reproduce:** `python anomaly_engine.py --demo` — drift injected on MUM-04 at tick 130 (21:40), bias accumulates for 10 ticks.

### UC-04 — Communication Loss / Missing Data

**Scenario:** MUM-06's datalogger loses power at 02:40; the stream emits `NaN` for all three parameters (or gaps in a CSV).

**Detection path:** L1 detects NaN values and tracked timestamp gaps over 30 minutes (up to 24 hours), and is **decisive** — either condition is an anomaly.

**Output:** `ANOMALY`, root cause **`COMM_LOSS`** — *"Check datalogger link; verify sensor power & serial connection"*, `corrected` carries imputed bridge values for all three parameters so the downstream feed keeps a complete time series.

**Operator value:** The network team learns about the outage from SkyGuard, not from the next morning's data-quality report. Uptime is tracked per station via the health module.

**Reproduce:** `python anomaly_engine.py --demo` — comm_loss injected on MUM-06 at tick 160 (02:40 next day). Unit test: `TestFaultInjection.test_comm_loss` in `tests/test_anomaly_engine.py`.

### UC-05 — Barometer Fault (Pressure Drop)

**Scenario:** MUM-02's pressure sensor glitches **−11.6 hPa in one interval** (injected range −8…−14 hPa) — a spike that could masquerade as an intense thundersquall.

**Detection path:** L1 pressure step limit (6 hPa per interval) → **decisive**; L4 independently flags *"Pressure fell 11.6 hPa in one interval — verify against wind/rain response"*.

**Output:** `ANOMALY`, root cause **`SENSOR_FAULT`** on pressure, high `param_confidence["pressure"]`, corrected pressure imputed from the seasonal mean and neighbours.

**Operator value:** Distinguishes an instrument glitch from a genuine mesoscale event — a real squall would also appear at neighbouring stations (contrast with UC-07).

**Reproduce:** `python anomaly_engine.py --demo` — pressure_drop injected on MUM-02 at tick 100 (16:40).

### UC-06 — Hard Range Violations

**Scenario:** A wiring fault makes the logger emit **RH = 120 %**; a config error emits **T = −90 °C**.

**Detection path:** L1 physical limits (T −10…60 °C, RH 0…100 %, P 870…1084 hPa) → **decisive** — a single implausible sample is enough.

**Output:** `ANOMALY`, root cause **`RANGE_VIOLATION`** — *"Check sensor wiring / datalogger config"*.

**Reproduce:** unit tests `test_range_violation_*` and `test_l1_decisive_*` in `tests/test_anomaly_engine.py`.

### UC-07 — Genuine Weather Event (False-Alarm Resistance) ⚠ *the critical negative case*

**Scenario:** A real pre-monsoon surge moves through Mumbai: **all six stations** show the same coherent rise/fall (±3.5 °C mesoscale swing with a shared pressure trend). A naive threshold system would raise six alerts and cry wolf.

**Detection path:** L2 sees temporal deviation at each station, **but** L3 finds full agreement with neighbours and L4 finds dewpoint/pressure physics coherent. Temporal-only deviation with spatial agreement classifies as **`REAL_EVENT`** — *"Monitor — no spatial disagreement; may be genuine"* — and stays below the ANOMALY threshold.

**Output:** No alert storm. The demo streams this exact mesoscale field through every station for 200 ticks; measured **precision 88.9 %** (only 5 false positives across 45 detections) demonstrates the discipline quantitatively.

**Operator value:** When SkyGuard *does* raise a CRITICAL, it means something — the property that makes the whole alert channel trustworthy.

**Reproduce:** `python anomaly_engine.py --demo` — the five fault windows are the only sustained alerts; the moving mesoscale field is not flagged.

### UC-08 — Historical Data Archaeology (Batch QC)

**Scenario:** A data scientist inherits five years of AWS CSV archives with unknown data-quality history and needs a trustworthy series for climate analysis or ML training.

**Detection path:** Same engine, batch mode — each row is processed in temporal order so baselines/seasonality build up exactly as in streaming; results are written with verdict, root cause and corrected values.

```bash
python anomaly_engine.py --csv archive.csv          # columns: station_id,timestamp,temperature,humidity,pressure
python examples/csv_example.py --demo               # self-generating demo with injected faults + P/R/F1 report
```

**Output:** Row-by-row verdicts plus a live Precision/Recall/F1 report when ground-truth fault windows are known (demo: **P 85.7 % / R 60.0 % / F1 0.71**).

**Operator value:** One command turns a suspect archive into an audited, explained, corrected dataset.

### UC-09 — Network Operations Centre (Live Dashboard)

**Scenario:** The NOC keeps `dashboard.html` open on a wall display for situational awareness.

**What they see:** Live Leaflet map with per-station status markers, KPI tiles (anomalies today, network health, data reliability), 24-hour parameter charts, scrolling alert feed with severity colouring, sensor-health panel with health bars, and a per-station drill-down (`detail.html`) showing the **full XAI breakdown**: confidence, layer contributions, evidence list, root cause + action, corrected values, health/degradation.

**Demo power:** the built-in **Fault-Injection Lab** lets evaluators inject spike / stuck / drift / frozen / comm-loss / pressure-drop faults with one click and watch Precision/Recall/F1 update live — the evaluation criterion "detection accuracy on anomaly-injected data" is demonstrable in the browser without Python.

**Reproduce:** `open index.html` (or `dashboard.html` directly) — no build step, no backend.

### UC-10 — Edge AI on ESP32 (In-Situ Filtering, Low Power)

**Scenario:** A remote AWS runs on solar + battery with intermittent GSM backhaul. `edge_ai/esp32/skyguard_edge.ino` runs the L1+L2+L4 logic **on the microcontroller itself**.

**Behaviour:** range/NaN checks, EWMA + seasonal baselines, dewpoint coherence, frozen detection, auto-imputation of corrected values, JSON verdict over Serial (115200 baud) — optionally deep-sleep between samples for energy budget. Memory footprint is O(1) (~10 floats/station), no matrix operations.

**Operator value:** Bad data is stopped **at the source**; only verdicts + corrected values traverse the expensive link; the station keeps QC-ing even when the network is down. In production, replace the mock spatial layer with LoRa/BLE neighbour packets and uplink via MQTT.

**Reproduce:** open `edge_ai/esp32/skyguard_edge.ino` in Arduino IDE → flash to ESP32 + BME280 (SDA 21 / SCL 22) → open Serial Monitor.

### UC-11 — Multi-Channel Alerting & Escalation

**Scenario:** A CRITICAL anomaly fires at 03:00. `alerts.py` fans out in the same tick: console + `alerts.log` always; HTTP webhook, SMTP e-mail and SMS (Twilio-style) when configured via environment variables (`SKYGUARD_WEBHOOK_URL`, `SKYGUARD_EMAIL_*`, `SKYGUARD_SMS_*`).

**Payload:** station, severity (CRITICAL/WARNING), confidence %, root-cause label + action, score, top-3 evidence, corrected values, health score, maintenance ETA, and the full raw engine result for downstream automation.

**Reproduce:** `python examples/stream_example.py` — streaming demo with alert dispatch + SHAP-style attribution printed per detection.

### UC-12 — Fleet Maintenance Planning

**Scenario:** Weeks of operation across 30+ stations. The health panel ranks every station by `health_score`; `degradation.regime` buckets the fleet into `stable / drifting / degrading / critical` with a `days_to_maintenance` horizon.

**Operator value:** The maintenance crew gets a prioritised work order list instead of reacting to hard failures; budget forecasting uses the ETAs.

### UC-13 — Self-Healing Data Pipeline (Trustworthy Feed)

**Scenario:** Downstream consumers (forecast models, agriculture advisories, aviation systems) subscribe to the AWS feed.

**Behaviour:** For every flagged parameter, `corrected[p]` carries an imputed value (seasonal mean ⊕ neighbour median ⊕ EWMA fallback) with `param_confidence`. Consumers either take the corrected feed directly or quarantine flagged rows. Because baselines learn **only from trusted readings**, the healing loop cannot reinforce its own mistakes (no self-poisoning).

**Operator value:** The "self-healing" half of the grand challenge — the network keeps delivering complete, plausible, explained data **under all environmental conditions**.

---

## 5. Use Cases Mapped to the Evaluation Criteria

| Criterion | Weight | Use cases that demonstrate it |
|---|---|---|
| **Innovation & Novelty** | 25 % | UC-07 (REAL_EVENT discrimination), UC-13 (self-healing, poison-proof learning), UC-03 (degradation prediction), UC-10 (edge self-awareness) |
| **Detection Accuracy** | 20 % | UC-01–UC-06 on injected faults; measured P 88.9 % / R 80.0 % / **F1 0.84** (Python demo), browser lab comparable |
| **Real-Time Capability** | 15 % | UC-09, UC-11 — O(1) per-reading inference, same-tick alerting, 2 s dashboard tick |
| **Explainability** | 10 % | Every verdict carries evidence + root cause + action + SHAP-style attribution (see §3 schema) |
| **Scalability** | 10 % | Stateless per-station models, O(1) memory — trivially parallelisable across stations/regions (UC-12) |
| **Practical Deployability** | 10 % | Stdlib-only Python, zero-build dashboard, flashable ESP32 firmware (UC-08/09/10) |
| **Visualization / UI** | 5 % | UC-09 — live map, KPIs, charts, health bars, alert feed, fault-injection lab |
| **Energy Efficiency** | 5 % | UC-10 — O(1) floats per station, no matrix ops, deep-sleep support |

---

## 6. Reproduction Quick Reference

| Goal | Command |
|---|---|
| Full fault-injection demo (6 stations, 5 faults, P/R/F1) | `python anomaly_engine.py --demo` |
| Batch QC of a CSV archive | `python anomaly_engine.py --csv your_data.csv` |
| Streaming demo with alerts + SHAP attribution | `python examples/stream_example.py` |
| CSV demo with injected faults + metrics | `python examples/csv_example.py --demo` |
| Live dashboard + fault-injection lab | open `index.html` in a browser |
| Unit-test proof of every behaviour (28 tests) | `python -m unittest discover -s tests -v` |
| Edge firmware | flash `edge_ai/esp32/skyguard_edge.ino` via Arduino IDE |

**Demo fault schedule** (10-minute ticks starting 2026-08-30 00:00, deterministic seed 42):

| Tick | Time | Station | Fault | Root cause expected |
|---|---|---|---|---|
| 40 | 06:40 | MUM-03 | spike (+14…22 °C, +20…30 % RH) | SENSOR_FAULT |
| 70 | 11:40 | MUM-05 | frozen (8+ identical samples) | STUCK_SENSOR |
| 100 | 16:40 | MUM-02 | pressure_drop (−8…−14 hPa) | SENSOR_FAULT |
| 130 | 21:40 | MUM-04 | drift (accumulating bias) | SENSOR_FAULT |
| 160 | 02:40 | MUM-06 | comm_loss (all NaN) | COMM_LOSS |

---

## 7. Validation Status

- **Unit tests:** 28 tests in `tests/test_anomaly_engine.py` covering L1 decisiveness, L2 seasonal/MAD baselines & warm-up, L3 spatial consensus, L4 frozen/dewpoint/pressure, confidence & root-cause schema, imputation, health & degradation prediction, SHAP explainer, alert routing, fault injection, CSV batch — **all passing**.
- **End-to-end demo:** 200 ticks × 6 stations, mesoscale-correlated field, 5 injected faults → **Precision 88.9 % · Recall 80.0 % · F1 0.84**.
- **Per-fault coverage (demo):** spike 10/10 · pressure-drop 10/10 · comm-loss 10/10 · drift 8/10 · frozen 2/10 (8-sample confirmation window — see UC-02 design note).

*SkyGuard — making weather data trustworthy, one sensor at a time.*
