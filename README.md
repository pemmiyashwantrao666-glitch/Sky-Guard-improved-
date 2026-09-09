# SkyGuard — AWS Anomaly Detection Engine

A self-aware, self-healing weather observation network for Automatic Weather Stations (AWS).  
Detects anomalies in real-time sensor streams with **explainable AI**, **confidence scores**, **root-cause classification**, **sensor health prediction**, **corrected-data estimation**, and **real-time alerts** — delivered through an interactive visualization dashboard.

---

## Table of Contents

- [Running Locally](#running-locally) — prerequisites, Python engine, tests, and both dashboards
- [Project Structure](#project-structure)

1. [Features](#1-features)
2. [Architecture — 5-Layer Detection Stack](#2-architecture)
3. [Quick Start](#3-quick-start)
4. [Files & Modules](#4-files--modules)
5. [Example Use Cases](#5-example-use-cases)
6. [Evaluation Criteria & Weightage](#6-evaluation-criteria--weightage)
7. [Suggested Technologies](#7-suggested-technologies)
8. [Edge AI — ESP32 Deployment](#8-edge-ai--esp32-deployment)
9. [Grand Challenge](#9-grand-challenge)
10. [Output Summary](#10-output-summary)
11. [Code & Technology Explained (Deep Dive)](#11-code--technology-explained-deep-dive)

---

## Running Locally

### Prerequisites

| Tool | Minimum version | Needed for |
|---|---|---|
| Python | 3.9+ (tested on 3.12) | Anomaly engine, examples, unit tests |
| Node.js + npm | 18+ (tested on Node 24) | Modern React dashboard (`skyguard-app/`) only |
| Git | any | Cloning / restoring the source |
| Arduino IDE 2.x | — | Optional — ESP32 edge firmware |

The **Python engine runs on the standard library alone** — no `pip install` is required to run the demo, the examples, or the tests.

### 1. Get the source

```bash
git clone https://github.com/pemmiyashwantrao666-glitch/Sky-guard-ai.git
cd Sky-guard-ai
```

> If your working tree is missing the root source files (e.g. only `.gitignore` is present), restore them from git before running:
>
> ```bash
> git checkout HEAD -- . ':(exclude)node_modules'
> ```

### 2. (Optional) Install Python extras

```bash
pip install -r requirements.txt
```

`requirements.txt` lists **optional** extras only — `pandas` (large CSVs), `shap` / `lime` (richer explanations), `paho-mqtt` (MQTT streaming) and `requests` (webhook alerts). Everything below works without them.

### 3. Run the Python engine, examples & tests

```bash
# Built-in fault-injection demo — prints live Precision / Recall / F1
python anomaly_engine.py                # same as: python anomaly_engine.py --demo

# Batch quality-control of your own CSV
python anomaly_engine.py --csv data.csv
#   columns: station_id,timestamp,temperature,humidity,pressure[,lat,lng]

# Real-time streaming demo (alerts + SHAP attribution per tick)
python examples/stream_example.py

# Deterministic batch-evaluation demo (seed 42)
python examples/csv_example.py --demo

# Unit tests — stdlib unittest, no pytest needed
python -m unittest discover -s tests -v
```

### 4. Run a dashboard

SkyGuard ships **two** dashboards — use either or both:

**A. Legacy dashboard — zero build, zero dependencies (quickest to try).** Open the landing page directly in a browser — no server and no install required:

```bash
start index.html     # Windows   (macOS: open index.html · Linux: xdg-open index.html)
```

or simply double-click `index.html` in your file explorer. Flow: `index.html` (landing) → `login.html` (localStorage auth, no backend) → `dashboard.html` (Leaflet map, live KPIs, 24 h charts, health panel, alert feed, and the **Fault-Injection Lab** that recomputes Precision / Recall / F1 live as you inject faults).

> If any widget is blocked by the browser's `file://` sandbox, serve the folder instead: `python -m http.server 8000` → open `http://localhost:8000/index.html`.

**B. Modern React dashboard — Vite dev server with hot-reload (needs Node.js):**

```bash
cd skyguard-app
npm install        # one-time install into skyguard-app/node_modules
npm run dev        # Vite dev server, by default http://localhost:5173
```

A TypeScript + React 19 + Vite + Tailwind + Leaflet + Recharts + Three.js console. It includes a SkyGuard-branded landing page with a 3D sensor-network globe, Login, Overview, Live Network, Weather Stations, Anomalies, Analytics/Sensor Health, Alerts, Reports, Maintenance, Complaints & Support, Settings (including Users & Roles), About System, and Documentation. Dashboard data is simulated locally; the Overview anomaly panel refreshes from the three-second frontend stream. The Python engine remains the reference detector and is not connected to the React UI yet. Production build: `npm run build` (output in `skyguard-app/dist/`), preview with `npm run preview`.

### 5. (Optional) ESP32 edge firmware

See [§8 — Edge AI — ESP32 Deployment](#8-edge-ai--esp32-deployment) for full details. Short version: install the **esp32** board package and the **Adafruit BME280** library in Arduino IDE, open `edge_ai/esp32/skyguard_edge.ino`, select *ESP32 Dev Module*, upload, and watch JSON anomaly verdicts on the Serial Monitor at **115200 baud**. Wiring: BME280 VCC → 3V3, GND → GND, SDA → GPIO21, SCL → GPIO22.

---

## Project Structure

```
Sky-guard-ai/
├── anomaly_engine.py               # 5-layer anomaly engine (Python stdlib-only) — main entry point
├── alerts.py                       # Alerting: console / file / webhook / email / SMS
├── shap_explainer.py               # Lightweight SHAP-style explainability
├── requirements.txt                # Optional extras only (pandas, shap, lime, paho-mqtt, requests)
├── index.html · login.html · dashboard.html · app.js · *.css
│                                   # Legacy static dashboard (open index.html — no build step)
├── skyguard-app/                   # Modern React 19 + Vite dashboard
│   ├── package.json                #   scripts: dev | build | lint | preview
│   ├── public/                     #   SkyGuard logo and compact mark assets
│   └── src/                        #   pages/, components/, lib/ (mock data + stream)
├── examples/
│   ├── csv_example.py              # Batch CSV processing + live Precision/Recall/F1
│   └── stream_example.py           # Real-time streaming with alerts + SHAP
├── edge_ai/esp32/skyguard_edge.ino # ESP32 firmware: lightweight L1–L4 engine, deep-sleep
├── tests/test_anomaly_engine.py    # Unit tests (stdlib unittest)
├── USE_CASES.md                    # Use-case walkthroughs (UC-01 … UC-13)
└── README.md                       # This file
```

---

## 1. Features

| Requirement | Implementation |
|---|---|
| **Real-time anomaly alerts** | Severity-graded alerts (CRITICAL / WARNING / INFO) via console, file, webhook, email, and SMS |
| **Severity & confidence scores** | Per-alert confidence %; severity derived from confidence and layer agreement |
| **Root-cause classification** | 7 classes: `COMM_LOSS`, `STUCK_SENSOR`, `SENSOR_FAULT`, `SPATIAL_OUTLIER`, `REAL_EVENT`, `RANGE_VIOLATION`, `OK (Nominal)` |
| **Visualization dashboard** | Leaflet maps with English labels, live KPIs, 24h charts, alert feed, health panel, station table, and 3D landing-page sensor globe |
| **Sensor health status** | Drift tracking, fault-rate uptime, health score (0-100), maintenance ETA in days |
| **Corrected data estimation** | Imputed values blending seasonal mean + neighbor median + EWMA fallback |
| **Explainable AI (SHAP/LIME)** | `shap_explainer.py` — lightweight additive attribution with waterfall breakdown |
| **Edge AI for ESP32** | `edge_ai/esp32/skyguard_edge.ino` — lightweight L1-L4 engine for low-power microcontrollers |
| **Fault-injection evaluation** | Built-in lab with live Precision / Recall / F1 metrics |
| **Operational workflows** | Separate Alerts, Reports, Complaints, About System, Maintenance, and combined Settings / Users & Roles panels |

---

## 2. Architecture

```
AWS Stream
   │
   ├─► L1  Physical Plausibility      (hard range limits, NaN / comm-error detection)
   ├─► L2  Temporal Learning          (EWMA baseline + seasonal hour-of-day z-scores)
   ├─► L3  Spatial Consistency        (neighbor-station cross-validation, <0.35° radius)
   ├─► L4  Multivariate Physics       (T/RH dewpoint coherence, pressure coupling,
   │                                  frozen-value detection across all parameters)
   └─► L5  Explainable Fusion         (weighted vote → verdict + confidence + SHAP attribution)
            │
            ├─► Root-cause classifier (7 classes + actionable recommendations)
            ├─► Corrected-value imputation (optional)
            ├─► Sensor health & maintenance prediction
            └─► Real-time alerts (multi-channel)
```

**Fusion weights:** L1 = 0.25, L2 = 0.30, L3 = 0.25, L4 = 0.20  
**Verdict thresholds:** ANOMALY ≥ 0.50, WARNING ≥ 0.30  
**Confidence:** scales with cross-layer agreement (40%–99%)  
**Self-healing:** baselines learn *only from trusted (non-anomalous) readings* to prevent poisoning.

**Detection hardening:**
- **L1 is decisive** — a hard range violation, communication loss, tracked timestamp gap (>30 minutes and ≤24 hours), or spike step (>8 °C / >25 % RH / >6 hPa per interval) is always an anomaly, regardless of score scale.
- **L2** uses a warm-up guard (12 samples), trimmed seasonal (hour-of-day) means, and a **robust MAD-based spread** with physical σ floors (`MIN_SD`) so tiny sensor noise never becomes a false alarm.
- **L4** flags sustained sensor *drift* (not just single-sample jumps), frozen values (8+ identical samples), dewpoint impossibilities and rapid pressure falls.
- **Degradation prediction** classifies each station as `stable / drifting / degrading / critical` with a maintenance horizon and a recommended action.

---

## 3. Quick Start

### A. Web Dashboard (no build step)

```bash
# Open directly in browser
open index.html        # or double-click index.html
```

- Sign up → Dashboard launches.
- Click station markers → full XAI breakdown (confidence, layer contributions, evidence, root cause, corrected values, health).
- **🧪 Fault-Injection Lab** → inject spike/stuck/drift/frozen/comm-loss/pressure-drop faults; watch Precision/Recall/F1 update live.
- Adjust **Z-Score Threshold** slider for sensitivity.

### B. Python Engine

```bash
# Run built-in demo
python anomaly_engine.py

# Run with CSV
python anomaly_engine.py --csv data.csv

# Run streaming example with alerts + SHAP explanations
python examples/stream_example.py

# Run batch evaluation demo
python examples/csv_example.py --demo
```

CSV format: `station_id,timestamp,temperature,humidity,pressure`  
Optional columns: `lat,lng` (enable spatial layer).

### B2. Run the Test Suite

```bash
python -m unittest discover -s tests -v
```

29 tests cover every requirement: L1 range / NaN / step / timestamp-gap detection, L2 seasonal & drift learning, L3 spatial cross-validation, L4 frozen / dewpoint / pressure checks, confidence & root-cause schema, imputation, health & maintenance prediction, the SHAP-style explainer, alert routing, fault injection, and CSV batch processing.

### B3. Expected Demo Metrics

The built-in labs use deterministic fault-injection scenarios over a **physically correlated regional field** (all stations share a slow-moving mesoscale signal), so normal readings stay realistic and genuine faults stand out:

| Scenario | Precision | Recall | F1 | Per-fault coverage |
|---|---|---|---|---|
| `anomaly_engine.py --demo` (6 stations, 5 faults, 200 ticks) | 88.9 % | 80.0 % | **0.84** | spike 10/10, pressure-drop 10/10, comm-loss 10/10, drift 8/10, frozen 2/10* |
| `examples/csv_example.py --demo` (3 stations, 2 faults, 120 ticks) | 85.7 % | 60.0 % | 0.71 | spike 10/10, frozen 2/10* |

*Frozen sensors are declared only after 8 consecutive identical samples (a deliberate confidence-vs-latency trade-off); slow drift is caught after ≈2 ticks of cumulative bias.

### C. ESP32 Edge Firmware

1. Install ESP32 board package in Arduino IDE.
2. Install `Adafruit BME280` library.
3. Open `edge_ai/esp32/skyguard_edge.ino`.
4. Upload to ESP32.
5. Open Serial Monitor (115200 baud) to see JSON anomaly verdicts.

---

## 4. Files & Modules

| File / Folder | Purpose |
|---|---|
| `index.html` | Legacy landing page with SkyGuard branding and feature highlights |
| `login.html` | Auth page (localStorage-based) |
| `dashboard.html` | Main visualization dashboard |
| `styles.css`, `dashboard.css` | Styling, animations, dark theme |
| `app.js` | Cursor, background-shift, reveals, auth |
| `dashboard.js` | **Browser AI engine** — 5-layer detection, map, charts, fault lab |
| `anomaly_engine.py` | **Python reference engine** (stdlib-only) — demo + CSV + streaming |
| `shap_explainer.py` | **SHAP-style explainability** — additive attribution per parameter/layer |
| `alerts.py` | **Real-time alerting** — console, file, webhook, email, SMS |
| `edge_ai/esp32/skyguard_edge.ino` | **ESP32 firmware** — lightweight L1-L4 anomaly engine |
| `examples/stream_example.py` | Real-time streaming demo with alerts + SHAP |
| `examples/csv_example.py` | Batch CSV processing with evaluation metrics |
| `tests/test_anomaly_engine.py` | 29 unit tests — all layers, XAI, alerts, faults, and communication gaps |
| `skyguard-app/public/skyguard-logo.svg` | Full SkyGuard AI brand lockup |
| `skyguard-app/public/skyguard-mark.svg` | Compact SkyGuard navigation mark |
| `README.md` | This document |

---

## 5. Example Use Cases

> **Deep-dive:** detailed scenario walkthroughs with layer-by-layer reasoning, expected outputs and reproduction commands live in **[USE_CASES.md](USE_CASES.md)**.

### UC-1 — Sudden Temperature Spike (The Challenge Example)
**Scenario:** AWS reports **55 °C** with **90 % RH** and abnormal pressure variation; neighbors show **30 °C**.  
**Pipeline:** L1 passes → L2 flags +8σ vs baseline → L3 disagrees with 4 neighbors → L4 flags dewpoint impossibility.  
**Output:** `ANOMALY`, confidence **95 %**, root cause `SENSOR_FAULT`, corrected value ≈ **30 °C**, alert raised, health score drops, maintenance ETA shortens.

### UC-2 — Frozen / Stuck Sensor
**Scenario:** Identical temperature for 8+ consecutive samples.  
**Output:** L4 frozen-value rule fires → `STUCK_SENSOR` → action: *Restart datalogger; check sensor cable & ADC*.

### UC-3 — Slow Sensor Drift (Degradation Prediction)
**Scenario:** +0.9 °C per-tick bias over 25 ticks.  
**Output:** L2 EWMA tracks slowly; health engine accumulates drift → health score decays → maintenance ETA counts down **before** hard failure.

### UC-4 — Communication Error
**Scenario:** Station stops reporting (NaN values).  
**Output:** Marker turns grey (offline), excluded from spatial consensus so it cannot corrupt neighbors, uptime metric falls.

### UC-5 — Real Weather Event (No False Alarm)
**Scenario:** Genuine 42 °C heat spike at one station; neighbors 39–41 °C.  
**Output:** L2 flags but L3 does **not** disagree strongly → root cause `REAL_EVENT` → *"Monitor — no spatial disagreement; may be genuine"* — the system distinguishes weather from sensor faults.

### UC-6 — Pressure Drop Without Storm Response
**Scenario:** −10 hPa in 10 min but wind 5 km/h, rain 0 mm.  
**Output:** L4 coupling rule fires → sensor-suspect verdict instead of a false storm alert.

### UC-7 — Fleet Maintenance Planning
**Scenario:** Weeks of operation across 30+ stations.  
**Output:** Health panel ranks all stations; low-health stations get short maintenance ETAs → crew dispatch prioritization.

### UC-8 — Real-Time Alerting & Escalation
**Scenario:** Critical anomaly detected during night shift.  
**Output:** Console toast + webhook POST + email + SMS dispatched instantly with station ID, severity, confidence, root cause, and suggested action.

---

## 6. Evaluation Criteria & Weightage

| Criterion | Weight | How This Project Scores It |
|---|---|---|
| **Innovation & Novelty** | 25 % | 5-layer explainable fusion + self-healing learning loop + spatial consensus + imputation in a zero-dependency browser + SHAP attribution |
| **Detection Accuracy** | 20 % | Multi-layer voting; live Precision/Recall/F1 on injected faults (Python demo: **P 88.9 % / R 80.0 % / F1 0.84**; browser lab: comparable) |
| **Real-Time Capability** | 15 % | O(1) per-reading inference; 2 s tick in browser; streaming-ready Python engine |
| **Explainability** | 10 % | Per-layer contribution bars, evidence list, root-cause + action, SHAP-style additive attribution |
| **Scalability** | 10 % | Stateless per-station models; trivially parallelizable; region switcher demonstrates multi-region scale |
| **Practical Deployability** | 10 % | Stdlib-only Python (edge/ESP32/MicroPython-portable); no backend needed for web demo |
| **Visualization / UI** | 5 % | Animated dark dashboard, live map, charts, health bars, alert feed |
| **Energy Efficiency** | 5 % | O(1) memory per station, no matrix ops; L1+L2 alone run on microcontrollers |

**Measured on the built-in fault-injection demo (deterministic seed 42):**
- **Precision:** 88.9 %
- **Recall:** 80.0 %
- **F1 Score:** 0.84
- **Latency:** < 100 ms per reading (Python), < 2 s (browser)

**Targets:** Precision ≥ 85 % · Recall ≥ 75 % · F1 ≥ 0.80 — all met.

---

## 7. Suggested Technologies

| Layer | Technology | Rationale |
|---|---|---|
| **Edge Sensor Firmware** | Arduino / MicroPython on ESP32 | Low-power, WiFi/BLE, OTA updates |
| **Edge Inference** | C++ / MicroPython port of L1+L2 | Minimal memory (~10 floats/station), deterministic latency |
| **Gateway Aggregation** | Python `anomaly_engine.py` or Node.js | Runs L3 spatial + L4 multivariate + L5 fusion |
| **Explainability** | `shap_explainer.py` (custom) or SHAP/LIME | Lightweight additive attribution without heavy ML deps |
| **Real-Time Transport** | MQTT / WebSocket | Publish telemetry + alerts to dashboard |
| **Alerting** | `alerts.py` — webhook, SMTP, SMS (Twilio) | Multi-channel escalation |
| **Dashboard** | HTML + vanilla JS + Leaflet | Zero-build, portable, dark animated UI |
| **Storage** | SQLite / InfluxDB (gateway) | Historical baselines, health tracking |
| **Scalability** | Docker + Kubernetes | Horizontal scaling for 1000+ stations |

---

## 8. Edge AI — ESP32 Deployment

The file `edge_ai/esp32/skyguard_edge.ino` implements a **fully functional anomaly detection engine** on ESP32:

- **L1:** Range checks + NaN detection (comm loss)
- **L2:** EWMA baseline + hour-of-day seasonal mean
- **L3:** Mock spatial (replace with LoRa/BLE neighbor values in production)
- **L4:** Dewpoint coherence, pressure drop, frozen sensor detection
- **Self-healing:** Auto-imputes corrected values when anomaly detected
- **Low-power:** Optional deep-sleep mode (battery-friendly)
- **Output:** JSON over Serial (115200 baud)

**Wiring:**
- BME280 VCC → 3V3
- BME280 GND → GND
- BME280 SDA → GPIO21
- BME280 SCL → GPIO22

**Production extension:** replace mock neighbors with actual LoRa/BLE neighbor packets; send anomaly JSON to a central gateway via WiFi/MQTT.

---

## 9. Grand Challenge

> **Can AI build a self-aware and self-healing weather observation network capable of delivering trustworthy atmospheric data under all environmental conditions?**

SkyGuard answers **yes**:

1. **Self-aware:** Every reading is scored with confidence and explained in human terms — operators know *why* the AI flagged a value.
2. **Self-healing:** The engine learns baselines only from trusted readings. When a fault is detected, it imputes corrected values so downstream systems (forecasts, alerts) keep working.
3. **Trustworthy:** Spatial consistency (L3) and multivariate physics (L4) prevent false alarms from genuine weather events. The system says *"this is real weather, not a sensor fault"* when evidence supports it.
4. **Edge-capable:** The same logic runs on microcontrollers, enabling in-situ filtering even when connectivity fails.
5. **Maintainable:** Health scores and maintenance ETAs turn reactive repairs into proactive operations.

**Vision:** A network where sensors detect their own faults, correct their own data, alert humans with actionable explanations, and schedule their own maintenance — all autonomously, all in real time.

---

## 10. Output Summary

This repository delivers:

| Output | Description |
|---|---|
| **Fully executable code** | `anomaly_engine.py` (Python, stdlib-only), `dashboard.js` (browser), `skyguard_edge.ino` (ESP32) |
| **Example usage** | `examples/stream_example.py`, `examples/csv_example.py` |
| **Real-time alerts** | `alerts.py` — console, file, webhook, email, SMS |
| **Explainable AI** | `shap_explainer.py` — SHAP-style additive attribution |
| **Visualization dashboard** | `dashboard.html` + `dashboard.js` — live map, KPIs, charts, health, alert feed |
| **Evaluation framework** | Fault-Injection Lab with live Precision/Recall/F1 metrics |
| **Unit tests** | `tests/test_anomaly_engine.py` — 29 executable tests (L1–L5, imputation, health, XAI, alerts) |
| **Documentation** | `README.md` + `USE_CASES.md` — use-case walkthroughs, evaluation criteria, technology stack, ESP32 guide |

**Run it now:**
```bash
# Python demo
python anomaly_engine.py

# Web dashboard
open index.html

# Streaming with alerts + SHAP
python examples/stream_example.py

# Unit tests ( 29)
python -m unittest discover -s tests -v
```

---

## 11. Code & Technology Explained (Deep Dive)

This section walks through *how* SkyGuard works — module by module:the data flow,the math behind every detection layer,the alerts, the explainable AI, the examples, tests, the ESP32 edge firmware, both dashboards,and the complete technology stack — everything in one place.

### 11.1 — What SkyGuard Does

SkyGuard is a **self-aware,self-healing anomaly-detection engine** for networks of **Automatic Weather Stations (AWS)**. It ingests a stream of sensor readings (temperature / humidity / pressure)from many stations,and for every reading produces:

| Output | Meaning |
|---|---|
| `verdict` | `NORMAL` / `WARNING` / `ANOMALY` |
| `confidence` | percentage (40–99%),scales with cross-layer agreement |
| `score` | weighted fusion score (0–1+),vs thresholds 0.30 / 0.50 |
| `evidence` | human-readable reasons,one per triggered check |
| `root_cause` | 7 classes + recommended action |
| `corrected` | imputed (self-healing) values for flagged parameters |
| `degradation` | `stable` / `drifting` / `degrading` / `critical` + maintenance ETA (days) |

It answers the **Grand Challenge** — *"Can AI build a self-aware and self-healing weather observation network capable of delivering trustworthy atmospheric data under all environmental conditions?"* — with yes:sensors detect their own faults,correct their own data,alert humans with actionable explanations,and schedule their own maintenance — autonomously,in real time.

### 11.2 — The 5-Layer Detection Stack (the heart of the code

Every reading passes through four detectors,then an explainable fusion layer:

```
AWS sensor stream (T / RH / P)
   │
   ├─► L1  Physical plausibility      (hard ranges,NaN/comm-loss,spike steps,timestamp gaps)
   ├─► L2  Temporal learning           (EWMA baseline + hour-of-day seasonal z-scores + drift)
   ├─► L3  Spatial consistency         (cross-check vs neighbor stations within ~0.35°)
   ├─► L4  Multivariate physics         (dewpoint coherence,pressure coupling,frozen values)
   └─► L5  Explainable fusion(weighted vote → verdict + confidence + SHAP attribution)
             │
             ├─► Root-cause classifier + action
             ├─► Corrected-value imputation
             ├─► Sensor health & maintenance prediction
             └─► Real-time alerts(console / file / webhook / email / SMS)
```

**Fusion weights:** `L1 =  0.25`, `L2 =  0.30`, `L3 =  0.25`, `L4 =  0.20`. **Verdict thresholds:** `ANOMALY ≥ 0.50`, `WARNING ≥ 0.30`. **Confidence formula:** `round((0.55 + 0.45 · layer-agreement) · (100 if anomaly else 70))`,clamped to **[40, 99]** — the more independent layers agree,the higher the confidence.

---

### 11.3 — The detection layers in detail

#### L1: Physical plausibility
Hard physical limits — `temperature ∈ [−10, 60] °C`, `humidity ∈ [0, 100] %`, `pressure ∈ [870, 1084] hPa`. Any `NaN` param is treated as **communication loss / missing data**. Per-interval **spike-step limits** — `>8 °C`, `>25 % RH`, `>6 hPa` between consecutive readings. Tracked **timestamp gaps** — a gap between readings of `>30 min` (and ≤ 24 h), or a timestamp moving backwards, is flagged as a communication problem. **L1 violations are decisive**: one implausible reading is always an anomaly, regardless of how small the score would otherwise be (`score = max(score, 0.55))`.



#### L2: Temporal learning
Per station,per parameter,the engine learns a statistical model of "normal":

- **EWMA baseline** — `b = α·value + (1−α)·b` with smoothing `α = 0.08`,plus a deviation-based spread `sd`.
- **Hour-of-day seasonal mean** — keeps the last ≤ 90 values per hour slot and uses a **20 %-trimmed mean**,so a few outliers can't skew "normal".
- **Robust spread** — `max(EWMA σ,, MIN_SD physical floor,, 1.4826·MAD of the last 24 values)`; physical floors (`MIN_SD`) prevent tiny sensor noise from becoming false alarms.

- **z-score** — `|value − reference| / spread`,where reference is the seasonal mean when available,else the EWMA baseline; flagged when `z ≥ 2.5`.

A **warm-up guard** keeps temporal checks dormant until **12 samples** are seen. **Self-healing**: baselines learn **only from non-anomalous readings**, so a failing sensor can never poison its own idea of normal.





#### L3: Spatial consistency
Within a **`NEIGHBOR_RADIUS_DEG = 0.35`° lat/lng radius**,if at least **`MIN_NEIGHBORS = 2`** neighbors have a recent good value,the reading is z-scored against the neighbor **mean / spread**. The result is cross-referencedwith the temporal layer

- Temporal deviation **but no** spatial disagreement → `REAL_EVENT` (genuine weather — monitor,no action needed).
- Spatial disagreement **but no** temporal deviation → `SPATIAL_OUTLIER` (likely a bad sensor — verify against neighbors).
- Both agree something's wrong → `SENSOR_FAULT`( recalibrate / flag suspect.


This is how the system avoids false alarms from real weather events: genuine heatwaves and pressure systems affect *every* station in a region,so they fail L2 but pass L3.

)

#### L4: Multivariate physics
Checks physical consistency *across* parameters,and *over time*:

- **Dewpoint coherence** — computes an approximate dewpoint from T/RH;(using a Magnus-type formula,and flags combos where dewpoint ≥ T, ore.g. T ≈ 56 °C with RH ≈ 100 % — physically implausible.
- **Rapid pressure fall** — a drop of `≥5 hPa` in one interval is only trusted if weather (wind/rain) can explain it,otherwise it's sensor-suspect.
- **Frozen / stuck sensor** — if a parameter's value stays *identical*(tol `1e-6`)for **8+ consecutive samples**,the sensor is declared stuck — also a decisive anomaly(`score = max(score, 0.55)`.

- **Slow drift** — sustained bias accumulation(L2-level)that healthy degradation tracking catch early.



---

### 11.4 — L5: Explainable fusion — the `process()` pipeline

The master inference,`AnomalyEngine.process(readkeep)`,combines everything:

1. **Run all four layers** on the reading (L1→L4).
2. **Weighted fusion** — `score = Σ w_layer · strength_layer`;L1/L4 strength = `min(1, len(issues)/2)`,L2/L3 strength = `min(1, z_max / (z_threshold + 1.5))`.
3. **Decisive caps** — any L1 hard violation,communication loss,or frozen value raises the score to ≥ 0.55 regardless.
4. **Agreement bonus** — each extra triggered layer beyond the first adds `+0.15` to the score(agreement = layers_hit / 4).
5. **Verdict** — `ANOMALY` if `score ≥ 0.50`,else `WARNING` if `≥ 0.30`,else `NORMAL`.
6. **Root-cause classification**(`_classify()`)— 7 classes: `COMM_LOSS`, `STUCK_SENSOR`, `SENSOR_FAULT`, `SPATIAL_OUTLIER`, `REAL_EVENT`, `RANGE_VIOLATION`, `OK` — each with a human-readable label and actionable recommendation(e.g. `SENSOR_FAULT` → *"Recalibrate station; verify RH + T probes"*).
7. **Per-parameter confidence**(`_param_confidence()`)— derived from the max evidence z-score per parameter(e.g. temperature99%,humidity99%,pressure−).
8. **Self-healing imputation**(`corrected`)— flagged parameters get corrected values by blending(seasonal hour-of-day mean + neighbor median + EWMA fallback),rounded to 2 decimals — so downstream systems(forecasts,alerts)keep working on trustworthy data.
9. **State update** — learn only if the reading is *not* an anomaly;refresh `last_good` for spatial consensus;update the health model;append to the rolling window(≤ 30 readings);remember `last_timestamp` for gap detection.



Each result dict contains:`station_id`, `timestamp`, `verdict`, `confidence`, `score`, `layers_triggered`, `layers_detail`, `evidence`, `root_cause`, `param_confidence`, `corrected`, `health_score`, `maintenance_due_days`, `degradation`.

#### Health & maintenance prediction(self-aware)

`_update_health()` accumulates **drift**, **fault rate** and **sample count / uptime** into per-station state;`health_score()` returns a 0–100 score.`_degradation()` classifies each station,and predicts a maintenance horizon:

| Regime | Trigger | Maintenance ETA (days| Recommended action |
|---|---|---|---|---|
| `stable` | normal operation | ≈90 | Routine maintenance;no immediate action |
| `drifting` | drift ≥ 0.8 | `max(7, health/8)` | Calibrate at next visit;flag data as low-confidence |
| `degrading` | fault-rate ≥ 0.05 or health ≤ 70 | `max(3, health/12)` | Schedule maintenance this week;monitor drift |
| `critical` | fault-rate ≥ 0.15 or health ≤ 40 | ≈2 | Immediate inspection —recalibrate or replace failing probes |

This turns **reactive repairs into proactive operations** — you know *which* station to visit,*why*,and *how soon*,before hard failure occurs.



---

### 11.5 — `alerts.py` — Multi-channel alerting

`AlertManager.send(severity, station, message, details, ...)` dispatches toevery configured channel,in the same tick:

- **Console + file** — always on,writing to `alerts.log`(via Python `logging`).
- **HTTP webhook** — `POST` JSON to `SKYGUARD_WEBHOOK_URL`(stdlib `urllib.request`,5 s timeout).
- **Email (SMTP)** — `SKYGUARD_EMAIL_USER/PASS/TO`,via `smtplib` + STARTTLS on port 587(Gmail-compatible config).
- **SMS (Twilio-style)** — webhook `POST` with `to/from/text` + Bearer token(`SKYGUARD_SMS_URL/TOKEN/FROM/TO`).

The bridge `alert_from_engine_result()` translates an engine result dict into an alert:severity = `CRITICAL` when confidence ≥ 80,else `WARNING`;payload carry station,severity,confidence,root-cause label + action,score,top-3 evidence,corrected values,health score,maintenance ETA,and the full raw engine result for downstream automation.



### 11.6 — `shap_explainer.py` — SHAP-style Explainable AI

A lightweight **additive-attribution** explainer — zero external ML libraries(optional `shap`/`lime` remain supported via requirements.txt).For each triggered layer it recomputes the layer's weighted score contribution,then splits that layer's score across its issues **proportionally to their z-scores**,sorts all contributions by absolute value,and emits `FeatureContribution` items(`feature, layer, value, contribution, direction, evidence`)in a waterfall-style `SHAPExplanation`(`to_markdown()` / `to_dict()`),compatible with SHAP waterfall charts. Every anomaly's **top drivers** — the features that moved the score most — are printable per detection,so operators know *why* the system flagged a value in human terms.

#### Fault injection & evaluation

`inject_fault()` synthesizes deterministic faults(seeded `random.Random(42)` in the demos)into otherwise-clean readings:

| Fault | Mutation applied |
|---|---|
| `spike` | T += 14–22 °C;RH += 20–30 % |
| `drift` | T += 0.5–1.2 °C per tick |
| `stuck` / `frozen` | caller-freezed(returns identical previous values |
| `comm_loss` | all three parameters → `NaN` |
| `pressure_drop` | P −= 8–14 hPa |

The built-in demos inject faults into a **physically-correlated regional field**(all stations share a slow-moving mesoscale signal),so genuine faults stand out from realistic normal readings,and confusion-matrix metrics(Precision / Recall / F1)are computed against the known ground truth.**Measured on this repository**(Sept 2026):

```text
Injected faults : 5
TP / FP / FN    : 40 /  5 / 10
Precision       : 88.9 %
Recall          :  80.0 %
F1 score        :  0.84
```

— matching the documented targets(Precision ≥ 85 %·Recall ≥ 75 %·F1 ≥ 0.80),and the **Fault-Injection Lab**(browser)recomputes these metrics live as you inject faults.



#### Unit tests(`tests/test_anomaly_engine.py`)

**29 stdlib-`unittest` tests** covering every requirement — L1 range / NaN / spike-step / timestamp-gap;L2 warm-up / drift / spike / self-healing baseline;L3 spatial cross-validation;L4 frozen / dewpoint / pressure-drop;L5 result schema / root-cause / confidence bounds / imputation / health & degradation / SHAP-style explainer / alert routing / fault injection / CSV batch. Run them with:

```bash
python -m unittest discover -s tests -v
```



---

### 11.7 — Example programs

| Example | What it demonstrates |
|---|---|
| `examples/stream_example.py` | Real-time stream — 3 stations,100 ticks every 5 s,injecting `spike` / `frozen` / `comm_loss` faults at ticks 20/45/70;per tick it runs the engine,dispatches alerts,and prints a full SHAP-style explanation for every `ANOMALY` |
| `examples/csv_example.py` | Batch mode — process any CSV with per-row verdicts(`station_id,timestamp,temperature,humidity,pressure[,lat,lng]`),or `--demo` for a deterministic seeded 2-fault evaluation that prints Precision / Recall / F1 |



### 11.8 — Edge AI — ESP32 firmware(`edge_ai/esp32/skyguard_edge.ino`)

The **same L1–L4 logic ported to C++** for an ESP32 + BME280(I²C:SDA → GPIO21,SCL → GPIO22;Serial 115200 baud).It implements:

- **L1** — range checks + NaN detection(communication loss).
- **L2** — EWMA baseline + 24-slot hour-of-day seasonal means(simplified —— exact power-of-two-free float math,~10 floats per station.
- **L3** — mock spatial layer(swap with LoRa / BLE neighbor packets in production).
- **L4** — dewpoint coherence,pressure-drop,anden frozen-sensor detection.
- **Self-healing** — `impute()` auto-replaces flagged values with seasonal means.
- **JSON output** — `ArduinoJson` verdicts(`{ts,t,h,p,score,verdict,root_cause}`)over Serial.
- **Low power** — optional **deep-sleep** mode(battery-friendly essay).Memory footprint is **O(1)**(~8 KB flash(),no matrix operations — so it runson cheap,remote,solar-powered hardware and keeps QC-ing writes even when connectivity fails;only verdicts + corrected values traverse the expensive uplink.



### 11.9 — The two dashboards

**A. Legacy static dashboard(zero build,no backend)** — `index.html` → `login.html` → `dashboard.html`(+ `dashboard.js`, `app.js`, and themed CSS files).Features:

- **3D sensor-network globe**(Three.js r128,loaded from CDN)on the landing page with pulsing station nodes,and live-status overlay.

- **Leaflet map** of 31 stations across 5 Indian regions(Mumbai,Delhi,Bengaluru,Chennai,Kolkata)with per-station status markers.

- **Live KPIs**,**24 h parameter charts**,**alert feed**,**sensor-health panel**,and a per-station drill-down(`detail.html`,`workflow.html`,`mobile.html`).
- **Built-in browser AI engine** — `dashboard.js` is an **independent JavaScript port** of the 5-layer engine(EWMA + seasonal baselines,spatial cross-validation,dewpoint physics)with local baselines per station.
- **Fault-Injection Lab** — inject `spike / stuck / drift / frozen / comm-loss / pressure-drop` with one click,and watch **Precision / Recall / F1** recompute live;plus a **Z-Score Threshold** sensitivity slider.Just double-click `index.html` — no server,no install(optionally `python -m http.server 8000`).

**B. Modern React dashboard(`skyguard-app/`)** — **TypeScript + React 19 + Vite + Tailwind CSS v4 + Leaflet + Recharts + Three.js** SPA(`npm install` → `npm run dev` → `http://localhost:5173`).

- **Routing**(`src/App.tsx`)— React Router v7,14 routes,route-level **code splitting**(`React.lazy` + `Suspense`)—— Landing,Login,Overview,Network,Anomalies(+ detail),Stations(+ detail),Analytics,Alerts,Reports,Maintenance,Docs,Complaints,About System,and Settings.
- **UI layer**(`components/layout`, `components/ui`)— app shell(Sidebar / Header / Notifications / User Menu / Settings Popover)+ shadcn-style primitives(Button,Card,Badge,Table,Tabs,Select,Progress,Avatar,Collapsible,Input,Toggle)built on `class-variance-authority` + `clsx` + `tailwind-merge` + `tailwindcss-animate`.
- **Landing page** — animated **Three.js globe**(wireframe sphere + atmosphere glow + pulsing sensor points + connecting link lines)with IntersectionObserver-aware pause for performance.
- **Overview page** — KPI cards,sparklines,Leaflet map(react-leaflet with cached `L.divIcon` markers),live anomaly panels,Recharts line charts,and Framer-Motion micro-animations;the anomaly panel refreshes from the **3-second simulated stream**.
- **Data layer** — `lib/mock-data.ts`(rich domain model:stations with health/battery/drift,anomalies with SHAP-style feature contributions,maintenance tasks,region stats),`lib/imd-stations.ts`(a **1,150-station real IMD station catalog**,generated from `ShagunDwivedi/IndianWeatherAPI` city-links and resolved via Open-Meteo geocoding),`lib/stream.ts`(`StreamService` emitting live jittered readings every 3 s),and `lib/imd-api.ts`(fetch client for a local IMD gateway at `http://localhost:5000`(or `VITE_IMD_API_URL`)exposing `/weather`, `/detailed_weather`, `/forecast` for real Indian Meteorological Department-style data).

> **Note:** the React dashboard's data is currently simulated locally,and the **Python engine is the reference detector** — it it is not yet wired into the React UI;both demonstrate the same concept independently(see §4 for the quick start).



---

### 11.10 — Technology & tools used(full stack table)

| Layer | Technology / Tool | Where |
|---|---|---|---|
| **Anomaly engine** | Python 3.9+ — **stdlib only**(`statistics`, `math`, `dataclasses`, `argparse`, `csv`, `logging`, `unittest`) — EWMA,robust MAD stats,z-scores,dewpoint physics | `anomaly_engine.py` |
| **Explainability** | SHAP-style additive attribution(own implementation;optional `shap` / `lime`)| `shap_explainer.py`, `requirements.txt` |
| **Alerting** | SMTP email,HTTP webhook,Twilio-style SMS,console + file logging(stdlib `smtplib` / `urllib.request`;optional `paho-mqtt`, `requests`)| `alerts.py` |
| **Evaluation** | Deterministic fault-injection lab — Precision / Recall / F1,seeded demos | engine + `examples/` + `tests/` |
| **Testing** | Python `unittest`(29 tests,no pytest needed)| `tests/test_anomaly_engine.py` |
| **Edge AI** | C++ / Arduino — **ESP32**,Adafruit BME280,ArduinoJson v6,I²C,ESP-IDF deep-sleep | `edge_ai/esp32/skyguard_edge.ino` |
| **Legacy dashboard** | HTML5,vanilla JavaScript,CSS3(custom design-system theme),Three.js r128(3D globe — CDN),Leaflet(maps — CDN)| `index.html`, `login.html`, `dashboard.html`, `detail.html`, `app.js`, `dashboard.js`, `*.css` |
| **Modern dashboard** | **React 19**,**TypeScript**,**Vite 8**,**Tailwind CSS v4**,shadcn-style UI(cva / clsx / tailwind-merge),Framer Motion,Recharts,react-leaflet + Leaflet,Three.js,lucide-react icons,React Router v7,oxlint,Vercel | `skyguard-app/` |
| **Data / integration** | Mock + simulated real-time stream(browser),IMD API integration(`imd-api.ts` — real Indian weather via a local gateway),CSV batch via Python,1,150-station IMD catalog | `skyguard-app/src/lib/*`,engine CLI |
| **Docs / DevOps** | `README.md`(this file),`USE_CASES.md`(13 use-case walkthroughs),Git / GitHub,`package-lock.json`,Vercel deploy config | repo root |

**Quick-start recap:**

```bash
python anomaly_engine.py                   # 5-layer engine,built-in fault-injection demo
python anomaly_engine.py --csv data.csv     # batch QC of your own AWS data
python examples/stream_example.py           # real-time streaming + alerts + SHAP
python examples/csv_example.py --demo       # seeded Precision / Recall / F1 evaluation
python -m unittest discover -s tests -v   # 29 unit tests
start index.html                             # legacy dashboard(double-click — no server)
cd skyguard-app && npm install && npm run dev   # modern React dashboard
# ESP32: open edge_ai/esp32/skyguard_edge.ino in Arduino IDE
#   BME280 wiring — VCC→3V3,GND→GND,SDA→GPIO21,SCL→GPIO22,Serial 115200 baud
```

*Summary:* a 5-layer,physics-grounded,explainable anomaly-detection AI for weather-station networks — Python stdlib-only reference engine(+ SHAP-style XAI,multi-channel alerts,self-healing imputation,health/maintenance prediction,29 passing tests),a browser port of the same engine with zero-build dashboard and fault-injection lab,a modern React/TS dashboard with 3D globe,and the ESP32 edge-C firmware — the complete"self-aware,self-healing weather network" system,in one repository.

---

*SkyGuard — making weather data trustworthy, one sensor at a time.*
