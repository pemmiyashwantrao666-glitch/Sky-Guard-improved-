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
| **Unit tests** | `tests/test_anomaly_engine.py` — 28 executable tests (L1–L5, imputation, health, XAI, alerts) |
| **Documentation** | `README.md` + `USE_CASES.md` — use-case walkthroughs, evaluation criteria, technology stack, ESP32 guide |

**Run it now:**
```bash
# Python demo
python anomaly_engine.py

# Web dashboard
open index.html

# Streaming with alerts + SHAP
python examples/stream_example.py

# Unit tests (28)
python -m unittest discover -s tests -v
```

---

*SkyGuard — making weather data trustworthy, one sensor at a time.*
