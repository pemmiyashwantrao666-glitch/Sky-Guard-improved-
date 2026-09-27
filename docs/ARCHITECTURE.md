# Sky Guard AI — System Architecture

**AWS Health Monitoring System**  
**Version:** 1.0  
**Last Updated:** 2026-09-26

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Details](#component-details)
4. [Data Flow](#data-flow)
5. [TRUST-AWS Detection Engine](#trust-aws-detection-engine)
6. [Database Schema](#database-schema)
7. [API Contracts](#api-contracts)
8. [Deployment Topologies](#deployment-topologies)
9. [Security Considerations](#security-considerations)
10. [Scalability & Performance](#scalability--performance)

---

## System Overview

Sky Guard AI is a three-tier architecture for real-time Automatic Weather Station (AWS) health monitoring:

```
┌─────────────────┐
│  Edge Layer     │  ESP32 + BME280 sensors (10s sampling)
│  (Field)        │  Local SD logging, MQTT/HTTP transmission
└────────┬────────┘
         │ WiFi/MQTT
         ▼
┌─────────────────┐
│  Gateway Layer  │  Python FastAPI server (anomaly detection)
│  (Server)       │  SQLite/TimescaleDB storage
└────────┬────────┘
         │ REST/SSE
         ▼
┌─────────────────┐
│  Client Layer   │  React dashboard (real-time visualization)
│  (Browser)      │  Leaflet maps, charts, alerts
└─────────────────┘
```

**Key Characteristics:**
- **Edge-first:** All readings logged locally (survive network outages)
- **Stdlib-only detector:** No ML library dependencies (portable)
- **Real-time:** <50ms anomaly detection latency
- **Explainable:** Per-parameter confidence scores + human-readable evidence
- **Self-healing:** Corrected value estimation + operator workflow

---

## Architecture Diagram

### System Context

```
                    ┌──────────────────────────┐
                    │  External Data Sources   │
                    │  (Training/Validation)   │
                    ├──────────────────────────┤
                    │  • NOAA ISD archives     │
                    │  • IMD AWS files         │
                    │  • ERA5 NetCDF           │
                    │  • ESP32 local logs      │
                    └───────────┬──────────────┘
                                │ Manual ingestion
                                ▼
┌────────────────────────────────────────────────────────┐
│                    Data Pipeline                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ NOAA Parser  │  │  IMD Parser  │  │ ERA5 Reader  │ │
│  │ (Python)     │  │  (Python)    │  │ (xarray)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         └──────────────────┴──────────────────┘         │
│                            │                            │
│                            ▼                            │
│              ┌──────────────────────────┐               │
│              │  Common Schema Converter │               │
│              │  (Parquet output)        │               │
│              └─────────────┬────────────┘               │
└────────────────────────────┼───────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   data/processed/        │
              │   station_hourly.parquet │
              └──────────────────────────┘


┌─────────────────────────────────────────────────────────┐
│                   Edge Layer (ESP32)                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │           ESP32 Weather Station                    │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │ │
│  │  │   BME280    │  │   MicroSD    │  │  Battery │ │ │
│  │  │ (I²C sensor)│  │   (CSV log)  │  │ Monitor  │ │ │
│  │  └──────┬──────┘  └──────┬───────┘  └────┬─────┘ │ │
│  │         └────────┬────────┴───────────────┘       │ │
│  │                  │                                 │ │
│  │         ┌────────▼────────┐                       │ │
│  │         │  WiFi Manager   │                       │ │
│  │         │  NTP Sync       │                       │ │
│  │         │  Offline Buffer │                       │ │
│  │         └────────┬────────┘                       │ │
│  │                  │                                 │ │
│  │         ┌────────▼────────┐                       │ │
│  │         │  Edge Rules     │ ← L1: Range checks   │ │
│  │         │  (Lightweight)  │   Spike detection    │ │
│  │         └────────┬────────┘   Frozen sensor      │ │
│  │                  │                                 │ │
│  │         ┌────────▼────────┐                       │ │
│  │         │  MQTT Client    │                       │ │
│  │         │  HTTP Fallback  │                       │ │
│  │         └────────┬────────┘                       │ │
│  └──────────────────┼───────────────────────────────┘ │
└────────────────────┼────────────────────────────────────┘
                     │ WiFi/MQTT
                     │ JSON: {station_id, ts, t, h, p, ...}
                     ▼
┌──────────────────────────────────────────────────────────┐
│              Gateway Layer (Python/FastAPI)              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              FastAPI Server                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │ │
│  │  │ /api/edge/   │  │ /api/edge/   │  │ /api/   │ │ │
│  │  │ ingest       │  │ stream (SSE) │  │ health  │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └─────────┘ │ │
│  │         │                 │                        │ │
│  │         └────────┬────────┘                        │ │
│  │                  ▼                                  │ │
│  │         ┌────────────────────┐                     │ │
│  │         │  Anomaly Engine    │                     │ │
│  │         │  (anomaly_engine.py)│                    │ │
│  │         └────────┬────────────┘                    │ │
│  │                  │                                  │ │
│  │    ┌─────────────┼─────────────┐                  │ │
│  │    │             │             │                   │ │
│  │    ▼             ▼             ▼                   │ │
│  │  ┌───┐        ┌───┐        ┌───┐                 │ │
│  │  │L1 │        │L2 │        │L3 │  ← 5 Detection  │ │
│  │  │Phy│        │Tmp│        │Spt│    Layers       │ │
│  │  └─┬─┘        └─┬─┘        └─┬─┘                 │ │
│  │    │            │            │                     │ │
│  │    │     ┌──────▼──────┐    │                     │ │
│  │    │     │     L4      │    │                     │ │
│  │    │     │  Multivar   │    │                     │ │
│  │    │     └──────┬──────┘    │                     │ │
│  │    │            │            │                     │ │
│  │    └────────────┼────────────┘                     │ │
│  │                 ▼                                   │ │
│  │         ┌───────────────┐                          │ │
│  │         │      L5       │ ← Explainable Fusion    │ │
│  │         │  XAI Fusion   │   Confidence scores     │ │
│  │         │  Root-cause   │   Evidence messages     │ │
│  │         │  Correction   │   Health prediction     │ │
│  │         └───────┬───────┘                          │ │
│  │                 │                                   │ │
│  │                 ▼                                   │ │
│  │         ┌───────────────┐                          │ │
│  │         │  Alert System │                          │ │
│  │         │  (alerts.py)  │                          │ │
│  │         └───────┬───────┘                          │ │
│  │                 │                                   │ │
│  └─────────────────┼──────────────────────────────────┘ │
│                    │                                     │
│         ┌──────────┼──────────┐                         │
│         ▼          ▼          ▼                         │
│  ┌──────────┐ ┌────────┐ ┌────────┐                   │
│  │  SQLite  │ │  MQTT  │ │ Email/ │                    │
│  │ /Timesca │ │ Broker │ │  SMS   │                    │
│  │  leDB    │ │        │ │        │                    │
│  └──────────┘ └────────┘ └────────┘                    │
└──────────────────┬──────────────────────────────────────┘
                   │ REST API + SSE
                   │ JSON: {station_id, verdict, score, ...}
                   ▼
┌──────────────────────────────────────────────────────────┐
│            Client Layer (React Dashboard)                │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              React Application                     │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │  Pages                                       │ │ │
│  │  │  • Overview Dashboard                        │ │ │
│  │  │  • Station Map (MapLibre)                    │ │ │
│  │  │  • Health Dashboard                          │ │ │
│  │  │  • Anomaly Investigation                     │ │ │
│  │  │  • Maintenance Schedule                      │ │ │
│  │  │  • Analytics & Reports                       │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │  Components                                  │ │ │
│  │  │  • Real-time charts (Recharts)              │ │ │
│  │  │  • Alert feed                                │ │ │
│  │  │  • Station cards                             │ │ │
│  │  │  • Evidence breakdown                        │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │  Services                                    │ │ │
│  │  │  • edge-api.ts (REST client)                │ │ │
│  │  │  • station-service.ts (state management)    │ │ │
│  │  │  • sse-stream.ts (real-time updates)        │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Component Details

### Edge Layer: ESP32 Weather Station

**Hardware:**
- ESP32-WROOM-32 (WiFi + BT, 520KB RAM, 4MB flash)
- BME280 sensor (I²C, ±1°C temp, ±3% RH, ±1 hPa pressure)
- MicroSD card (4-32GB, FAT32, CSV logging)
- LiPo battery (3.7V, 2000-5000mAh, optional solar charging)

**Firmware:** `edge_ai/esp32/skyguard_bme280.ino`

**Responsibilities:**
1. **Sensor Management**
   - BME280 forced-mode reading (low power)
   - 10-second sampling interval (configurable 5s-5min)
   - NaN detection (communication errors)
   - Self-heating mitigation

2. **Local Logging**
   - CSV format: `sequence,timestamp_utc,t,h,p,battery_v,rssi_dbm,uptime_s,sensor_status`
   - Sequence numbers (monotonic, survive reboots)
   - Timestamp from NTP (fallback to millis-based)
   - Continuous logging even when offline

3. **Network Communication**
   - WiFi connection with auto-reconnect
   - MQTT publishing (JSON payload, QoS 0)
   - HTTP POST fallback (if MQTT fails)
   - Offline buffering (up to 500 readings)
   - Auto-sync when reconnected

4. **Edge Detection (Lightweight)**
   - L1 range checks (temp -10 to 60°C, humidity 0-100%, pressure 870-1084 hPa)
   - Spike detection (>8°C, >25% RH, >6 hPa per interval)
   - Immediate alert flag for critical faults
   - <1KB flash, <256 bytes RAM

5. **Health Monitoring**
   - Battery voltage (via ADC + voltage divider)
   - WiFi RSSI (signal strength)
   - Uptime tracking
   - Watchdog timer (60s, auto-reset on hang)
   - LED status indicators (WiFi, MQTT, SD)

**Output Format (MQTT/HTTP JSON):**
```json
{
  "station_id": "SGA-ESP32-01",
  "sequence": 23891,
  "ts": "2026-09-26T19:00:00Z",
  "t": 31.7,
  "h": 74.2,
  "p": 997.8,
  "battery_v": 4.08,
  "rssi_dbm": -61,
  "uptime_s": 182930,
  "sensor_status": "ok",
  "offline_buffered": false
}
```

### Gateway Layer: Python Anomaly Detection

**Technology Stack:**
- Python 3.9+ (stdlib-only core, optional pandas/shap/paho-mqtt)
- FastAPI (async REST + SSE)
- SQLite (development) / TimescaleDB (production)
- Uvicorn (ASGI server)

**Core Module:** `anomaly_engine.py` (1200 lines, no external ML dependencies)

**Architecture:**
```python
class AnomalyEngine:
    def __init__(self, stations: List[Station]):
        self.L1 = PhysicalLayer()      # Range + spike checks
        self.L2 = TemporalLayer()      # EWMA + seasonal learning
        self.L3 = SpatialLayer()       # Neighbor cross-validation
        self.L4 = MultivariateLayer()  # Physics coherence
        self.L5 = ExplainableLayer()   # Fusion + XAI
        
        self.state = {}  # Per-station state (baselines, history)
    
    def process(self, reading: Reading) -> Verdict:
        # 5-layer cascade
        L1_result = self.L1.check(reading)
        L2_result = self.L2.check(reading, self.state)
        L3_result = self.L3.check(reading, nearby_stations)
        L4_result = self.L4.check(reading)
        
        # Weighted fusion
        verdict = self.L5.fuse(L1_result, L2_result, L3_result, L4_result)
        
        # Update state (only from trusted readings)
        if verdict.label != "ANOMALY":
            self.L2.update_baseline(reading, self.state)
        
        return verdict
```

**Layer Details:**

**L1: Physical Plausibility (Weight: 0.25)**
- Hard range limits (temperature, humidity, pressure)
- NaN detection (communication errors)
- Spike detection (max jump per interval)
- Timestamp validation (gaps >30min, <24h)
- **Decisive:** Range violations are always anomalies

**L2: Temporal Learning (Weight: 0.30)**
- EWMA baseline (`alpha=0.05`, tracks slow drift)
- Seasonal hour-of-day profiles (24 bins)
- MAD robust spread estimation (σ floors: 2°C, 5% RH, 3 hPa)
- Warmup period (12 samples before activation)
- Z-score calculation: `z = (value - baseline) / MAD`
- **Self-healing:** Only trusted readings update baselines

**L3: Spatial Consistency (Weight: 0.25)**
- Neighbor search (within 0.35° radius, ~40km at equator)
- Robust median of neighbor values
- Elevation adjustment (optional, -0.65°C per 100m)
- Minimum 2 neighbors required
- Spatial disagreement score: `|value - neighbor_median| / MAD`
- **Genuine weather detection:** If all neighbors changed, it's real

**L4: Multivariate Physics (Weight: 0.20)**
- T/RH dewpoint coherence (Magnus-Tetens formula)
- Frozen sensor detection (8+ identical consecutive readings)
- Rapid pressure drop (>6 hPa/hour, storm warning)
- Cross-parameter drift correlation
- **Physics violations:** Flag impossible combinations

**L5: Explainable Fusion (Weight: fusion logic)**
- Weighted vote: `score = 0.25×L1 + 0.30×L2 + 0.25×L3 + 0.20×L4`
- Verdict thresholds: ANOMALY ≥0.50, WARNING ≥0.30, NORMAL <0.30
- Confidence: `40% + 59% × (1 - disagreement_variance)`
- Per-parameter confidence (temperature, humidity, pressure independent)
- Root-cause classification (7 classes):
  - `COMM_LOSS` — NaN values, missing data
  - `STUCK_SENSOR` — 8+ identical readings
  - `SENSOR_FAULT` — Range violation, spike
  - `SPATIAL_OUTLIER` — Disagrees with neighbors
  - `REAL_EVENT` — All stations changed together
  - `RANGE_VIOLATION` — Outside physical limits
  - `OK` — Nominal operation
- Human-readable evidence messages per layer
- Corrected value estimation (neighbor median + seasonal baseline blend)
- Sensor health score (0-100, based on fault frequency)
- Maintenance prediction (days to recommended service)

**Performance:**
- Latency: <50ms per reading (single-threaded)
- Throughput: 100+ readings/sec (tested on i5-8250U)
- Memory: <100MB for 1000 stations
- Precision: 88.9% (on demo fault-injection dataset)
- Recall: 80.0%
- F1 Score: 0.84

**API Server:** `gateway/server.py`

**Endpoints:**
```python
GET  /api/health                    # Health check
GET  /api/edge/latest               # Latest from all stations
GET  /api/edge/latest/{station_id}  # Latest from one station
GET  /api/edge/history/{station_id} # Historical readings (paginated)
GET  /api/edge/stream               # SSE real-time broadcast
POST /api/edge/ingest               # Ingest from ESP32
POST /api/edge/simulate             # Demo data injection
```

**Storage:** `gateway/edge_store.py`

**SQLite Schema:**
```sql
CREATE TABLE edge_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT NOT NULL,
    ts TEXT NOT NULL,              -- ISO 8601 UTC
    t REAL,                         -- temperature °C
    h REAL,                         -- humidity %
    p REAL,                         -- pressure hPa
    score REAL,                     -- anomaly score 0-1
    verdict TEXT,                   -- NORMAL | WARNING | ANOMALY
    root_cause TEXT,                -- 7 classes
    confidence REAL,                -- 40-99%
    evidence TEXT,                  -- JSON array of messages
    corrected_t REAL,               -- optional
    corrected_h REAL,
    corrected_p REAL,
    health_score INTEGER,           -- 0-100
    maintenance_eta_days INTEGER,   -- null if healthy
    lat REAL,                       -- station coordinates
    lon REAL,
    fw TEXT,                        -- firmware version
    received_at TEXT NOT NULL,      -- server timestamp
    
    INDEX idx_station_ts (station_id, ts DESC),
    INDEX idx_verdict (verdict),
    INDEX idx_received (received_at DESC)
);
```

**Production Migration (TimescaleDB):**
```sql
SELECT create_hypertable('edge_readings', 'received_at');

-- Continuous aggregates (hourly rollups)
CREATE MATERIALIZED VIEW edge_readings_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', received_at) AS hour,
    station_id,
    AVG(t) AS avg_t,
    AVG(h) AS avg_h,
    AVG(p) AS avg_p,
    COUNT(*) FILTER (WHERE verdict = 'ANOMALY') AS anomaly_count,
    AVG(health_score) AS avg_health
FROM edge_readings
GROUP BY hour, station_id;

-- Data retention policy (90 days raw, 1 year aggregated)
SELECT add_retention_policy('edge_readings', INTERVAL '90 days');
```

### Client Layer: React Dashboard

**Technology Stack:**
- React 19 (with concurrent features)
- TypeScript 5.3
- Vite (build tool, HMR dev server)
- TailwindCSS 3 (utility-first styling)
- shadcn/ui (component library)
- MapLibre GL JS (GIS visualization)
- Recharts (time-series charts)
- React Query (server state management)

**Directory Structure:**
```
skyguard-app/
├── src/
│   ├── pages/                  # Top-level routes
│   │   ├── Overview.tsx        # Main dashboard (KPIs, alerts, charts)
│   │   ├── StationMap.tsx      # GIS map (TODO)
│   │   ├── HealthDashboard.tsx # Health overview (TODO)
│   │   ├── AnomalyDetail.tsx   # Investigation deep-dive
│   │   ├── Analytics.tsx       # Trends, statistics
│   │   ├── MaintenanceSchedule.tsx # Work orders (TODO)
│   │   └── Settings.tsx        # Configuration
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx     # Navigation
│   │   │   └── header.tsx      # Top bar
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── charts/             # Recharts wrappers
│   │   └── alerts/             # Alert feed
│   │
│   ├── lib/
│   │   ├── edge-api.ts         # REST API client
│   │   ├── station-service.ts  # State management
│   │   ├── sse-stream.ts       # SSE client
│   │   └── utils.ts            # Helpers
│   │
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # TypeScript definitions
│   └── assets/                 # Images, icons
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

**Real-time Updates:**
```typescript
// SSE streaming client
const eventSource = new EventSource('/api/edge/stream');

eventSource.onmessage = (event) => {
  const reading = JSON.parse(event.data);
  
  // Update station state
  updateStation(reading.station_id, reading);
  
  // Show alert notification
  if (reading.verdict === 'ANOMALY') {
    showToast({
      title: `Anomaly: ${reading.station_id}`,
      description: reading.root_cause,
      variant: 'destructive'
    });
  }
  
  // Update charts (React Query auto-refetch)
  queryClient.invalidateQueries(['stations', reading.station_id]);
};
```

**Deployment:**
- Development: `npm run dev` → Vite dev server (port 5173)
- Production: `npm run build` → Static files in `dist/`
- Hosting: GitHub Pages, Vercel, Netlify, or any static host
- Backend proxy: Vite proxy or Nginx reverse proxy

---

## Data Flow

### Real-time Ingestion Flow

```
ESP32 Sensor                Gateway Server              Dashboard
    │                             │                          │
    │ 1. Read BME280             │                          │
    │    (temp, humidity, press) │                          │
    │                             │                          │
    │ 2. Log to SD card          │                          │
    │    sequence=N              │                          │
    │                             │                          │
    │ 3. MQTT publish            │                          │
    ├─────────JSON payload───────>│                          │
    │                             │                          │
    │                             │ 4. Anomaly detection    │
    │                             │    (5-layer cascade)     │
    │                             │                          │
    │                             │ 5. Store to DB          │
    │                             │    (SQLite/TimescaleDB)  │
    │                             │                          │
    │                             │ 6. Broadcast SSE        │
    │                             ├───────JSON verdict──────>│
    │                             │                          │
    │                             │                          │ 7. Update UI
    │                             │                          │    (chart, alert)
    │                             │                          │
    │ 8. HTTP fallback (if MQTT fails)                      │
    ├─────────POST /ingest───────>│                          │
    │                             │                          │
    │                             │<──── 200 OK ─────────────│
    │                             │                          │
```

### Offline Recovery Flow

```
ESP32 (No WiFi)            Gateway Server              Dashboard
    │                             │                          │
    │ 1. WiFi disconnected        │                          │
    │                             │                          │
    │ 2. Log to SD only           │                          │
    │    (buffer N readings)      │                          │
    │    sequence=1000..1050      │                          │
    │                             │                          │
    │ ... (offline period) ...    │                          │
    │                             │                          │
    │ 3. WiFi reconnected         │                          │
    │                             │                          │
    │ 4. Flush offline buffer     │                          │
    ├─────────MQTT (batch)───────>│                          │
    │    {"offline_buffered": true}│                         │
    │                             │                          │
    │                             │ 5. Process backlog      │
    │                             │    (anomaly detection)   │
    │                             │                          │
    │                             │ 6. Broadcast catch-up   │
    │                             ├───────SSE stream────────>│
    │                             │                          │
    │                             │                          │ 7. Backfill charts
    │                             │                          │    (historical gaps)
```

---

## TRUST-AWS Detection Engine

### Mathematical Foundation

**Anomaly Score (Weighted Fusion):**

```
S_total = w₁×S_L1 + w₂×S_L2 + w₃×S_L3 + w₄×S_L4

Where:
  S_L1 = Physical plausibility score (0-1, 1=anomaly)
  S_L2 = Temporal deviation score (0-1)
  S_L3 = Spatial disagreement score (0-1)
  S_L4 = Multivariate inconsistency score (0-1)
  
  w₁ = 0.25  (Physical layer weight)
  w₂ = 0.30  (Temporal layer weight — highest)
  w₃ = 0.25  (Spatial layer weight)
  w₄ = 0.20  (Multivariate layer weight)
  
  Σw = 1.00
```

**Verdict Classification:**

```
verdict = {
  ANOMALY   if S_total ≥ 0.50
  WARNING   if 0.30 ≤ S_total < 0.50
  NORMAL    if S_total < 0.30
}
```

**Confidence Score:**

```
Confidence = 40% + 59% × (1 - layer_disagreement)

Where:
  layer_disagreement = variance([S_L1, S_L2, S_L3, S_L4])
  
  High agreement (all layers vote similar) → High confidence (~99%)
  High disagreement (layers vote differently) → Low confidence (~40%)
```

### Layer Algorithms

**L1: Physical Plausibility**

```python
def L1_check(reading):
    score = 0.0
    
    # Hard range checks (decisive)
    if not (-10 <= reading.t <= 60):
        return 1.0, "Range violation: temperature"
    if not (0 <= reading.h <= 100):
        return 1.0, "Range violation: humidity"
    if not (870 <= reading.p <= 1084):
        return 1.0, "Range violation: pressure"
    
    # NaN detection (communication error)
    if math.isnan(reading.t) or math.isnan(reading.h) or math.isnan(reading.p):
        return 1.0, "Communication loss: NaN values"
    
    # Spike detection
    prev = state[reading.station_id].prev_reading
    if prev:
        dt = abs(reading.t - prev.t)
        dh = abs(reading.h - prev.h)
        dp = abs(reading.p - prev.p)
        
        if dt > 8.0:   # °C
            score = max(score, 0.8)
        if dh > 25.0:  # %
            score = max(score, 0.7)
        if dp > 6.0:   # hPa
            score = max(score, 0.75)
    
    # Timestamp gap check
    time_gap_hours = (reading.ts - prev.ts).total_seconds() / 3600
    if 0.5 < time_gap_hours <= 24:
        score = max(score, 0.6)
    
    return score, evidence_messages
```

**L2: Temporal Learning**

```python
def L2_check(reading, state):
    station_state = state[reading.station_id]
    
    # Warmup guard
    if len(station_state.history) < 12:
        return 0.0, "Warmup period"
    
    # EWMA baseline (only from trusted readings)
    alpha = 0.05
    baseline = station_state.ewma
    
    # Seasonal adjustment (hour-of-day)
    hour = reading.ts.hour
    seasonal_mean = station_state.hourly_profiles[hour].mean
    seasonal_mad = station_state.hourly_profiles[hour].mad
    
    # MAD-based z-score with physical floors
    MIN_SD_T = 2.0   # °C
    MIN_SD_H = 5.0   # %
    MIN_SD_P = 3.0   # hPa
    
    mad_t = max(seasonal_mad.t, MIN_SD_T)
    mad_h = max(seasonal_mad.h, MIN_SD_H)
    mad_p = max(seasonal_mad.p, MIN_SD_P)
    
    z_t = abs(reading.t - seasonal_mean.t) / mad_t
    z_h = abs(reading.h - seasonal_mean.h) / mad_h
    z_p = abs(reading.p - seasonal_mean.p) / mad_p
    
    # Score = max z-score, clamped to [0, 1]
    z_max = max(z_t, z_h, z_p)
    score = min(1.0, z_max / 5.0)  # 5-sigma → score=1.0
    
    return score, f"Temporal: {z_max:.1f}σ from seasonal baseline"
```

**L3: Spatial Consistency**

```python
def L3_check(reading, all_stations):
    # Find neighbors within 0.35° (~40km)
    neighbors = [
        s for s in all_stations 
        if haversine_distance(reading, s) <= 0.35 
        and s.station_id != reading.station_id
    ]
    
    if len(neighbors) < 2:
        return 0.0, "Insufficient neighbors for spatial check"
    
    # Robust median of neighbor values
    neighbor_t = [s.latest.t for s in neighbors]
    neighbor_h = [s.latest.h for s in neighbors]
    neighbor_p = [s.latest.p for s in neighbors]
    
    median_t = statistics.median(neighbor_t)
    median_h = statistics.median(neighbor_h)
    median_p = statistics.median(neighbor_p)
    
    # MAD of neighbors
    mad_t = median_absolute_deviation(neighbor_t)
    mad_h = median_absolute_deviation(neighbor_h)
    mad_p = median_absolute_deviation(neighbor_p)
    
    # Spatial z-score
    z_t = abs(reading.t - median_t) / max(mad_t, 2.0)
    z_h = abs(reading.h - median_h) / max(mad_h, 5.0)
    z_p = abs(reading.p - median_p) / max(mad_p, 3.0)
    
    z_spatial = max(z_t, z_h, z_p)
    score = min(1.0, z_spatial / 5.0)
    
    # Genuine weather detection
    all_changed = all(abs(s.latest.t - s.prev.t) > 3.0 for s in neighbors)
    if all_changed and z_spatial < 3.0:
        return 0.0, "Genuine weather: all neighbors changed"
    
    return score, f"Spatial: {z_spatial:.1f}σ from {len(neighbors)} neighbors"
```

**L4: Multivariate Physics**

```python
def L4_check(reading):
    score = 0.0
    evidence = []
    
    # Frozen sensor detection (8+ identical readings)
    history = state[reading.station_id].history[-8:]
    if len(history) == 8:
        if all(abs(r.t - history[0].t) < 0.01 for r in history):
            score = 1.0
            evidence.append("Frozen sensor: 8+ identical temperature readings")
    
    # T/RH dewpoint coherence (Magnus-Tetens)
    try:
        dewpoint = calculate_dewpoint(reading.t, reading.h)
        if dewpoint > reading.t + 0.5:  # Impossible
            score = max(score, 0.9)
            evidence.append("Physics conflict: dewpoint > temperature")
    except ValueError:
        score = max(score, 0.8)
        evidence.append("Physics conflict: invalid T/RH combination")
    
    # Rapid pressure drop (storm detection)
    prev = state[reading.station_id].prev_reading
    if prev:
        dp_per_hour = (prev.p - reading.p) / ((reading.ts - prev.ts).total_seconds() / 3600)
        if dp_per_hour > 6.0:
            score = max(score, 0.7)
            evidence.append(f"Rapid pressure drop: {dp_per_hour:.1f} hPa/hour")
    
    return score, evidence
```

**L5: Explainable Fusion**

```python
def L5_fuse(L1_result, L2_result, L3_result, L4_result):
    # Weighted vote
    score = (
        0.25 * L1_result.score +
        0.30 * L2_result.score +
        0.25 * L3_result.score +
        0.20 * L4_result.score
    )
    
    # Verdict classification
    if score >= 0.50:
        verdict = "ANOMALY"
    elif score >= 0.30:
        verdict = "WARNING"
    else:
        verdict = "NORMAL"
    
    # Confidence (based on layer agreement)
    layer_scores = [L1_result.score, L2_result.score, L3_result.score, L4_result.score]
    disagreement = statistics.variance(layer_scores)
    confidence = 40 + 59 * (1 - disagreement)
    
    # Root-cause classification
    root_cause = classify_root_cause(L1_result, L2_result, L3_result, L4_result)
    
    # Evidence aggregation
    evidence = (
        L1_result.evidence +
        L2_result.evidence +
        L3_result.evidence +
        L4_result.evidence
    )
    
    # Corrected value estimation (if anomaly)
    corrected = None
    if verdict == "ANOMALY":
        corrected = estimate_corrected_value(reading, L2_result.seasonal_mean, L3_result.neighbor_median)
    
    # Sensor health prediction
    health_score, maintenance_eta = predict_sensor_health(state[reading.station_id])
    
    return Verdict(
        verdict=verdict,
        score=score,
        confidence=confidence,
        root_cause=root_cause,
        evidence=evidence,
        corrected=corrected,
        health_score=health_score,
        maintenance_eta_days=maintenance_eta
    )
```

---

## Database Schema

### SQLite (Development)

**edge_readings table:**
```sql
CREATE TABLE edge_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT NOT NULL,
    ts TEXT NOT NULL,              -- ISO 8601 UTC
    t REAL,                         -- temperature °C
    h REAL,                         -- humidity %
    p REAL,                         -- pressure hPa
    score REAL,                     -- anomaly score 0-1
    verdict TEXT CHECK(verdict IN ('NORMAL', 'WARNING', 'ANOMALY')),
    root_cause TEXT,                -- COMM_LOSS | STUCK_SENSOR | SENSOR_FAULT | ...
    confidence REAL CHECK(confidence BETWEEN 40 AND 99),
    evidence TEXT,                  -- JSON array of messages
    corrected_t REAL,               -- optional corrected values
    corrected_h REAL,
    corrected_p REAL,
    health_score INTEGER CHECK(health_score BETWEEN 0 AND 100),
    maintenance_eta_days INTEGER,
    lat REAL,
    lon REAL,
    fw TEXT,                        -- firmware version
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Indexes
    INDEX idx_station_ts (station_id, ts DESC),
    INDEX idx_verdict (verdict),
    INDEX idx_received (received_at DESC)
);
```

**station_metadata table:**
```sql
CREATE TABLE station_metadata (
    station_id TEXT PRIMARY KEY,
    name TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    elevation_m REAL,
    installation_date TEXT,
    last_calibration TEXT,
    firmware_version TEXT,
    hardware_model TEXT,
    status TEXT CHECK(status IN ('active', 'maintenance', 'decommissioned')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### TimescaleDB (Production)

**Migration:**
```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create hypertable (partitioned by time)
SELECT create_hypertable(
    'edge_readings',
    'received_at',
    chunk_time_interval => INTERVAL '1 day'
);

-- Continuous aggregates (hourly rollups)
CREATE MATERIALIZED VIEW edge_readings_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', received_at) AS hour,
    station_id,
    COUNT(*) AS reading_count,
    AVG(t) AS avg_t,
    STDDEV(t) AS stddev_t,
    AVG(h) AS avg_h,
    AVG(p) AS avg_p,
    COUNT(*) FILTER (WHERE verdict = 'ANOMALY') AS anomaly_count,
    AVG(health_score) AS avg_health,
    AVG(confidence) AS avg_confidence
FROM edge_readings
GROUP BY hour, station_id;

-- Refresh policy (refresh every hour, with 1-hour lag)
SELECT add_continuous_aggregate_policy(
    'edge_readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- Data retention policy (90 days raw, delete older)
SELECT add_retention_policy(
    'edge_readings',
    INTERVAL '90 days'
);

-- Compression (compress chunks older than 7 days)
ALTER TABLE edge_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'station_id'
);

SELECT add_compression_policy(
    'edge_readings',
    INTERVAL '7 days'
);
```

**Query Examples:**
```sql
-- Latest reading per station
SELECT DISTINCT ON (station_id) *
FROM edge_readings
ORDER BY station_id, received_at DESC;

-- Anomaly rate per station (last 24h)
SELECT 
    station_id,
    COUNT(*) AS total_readings,
    COUNT(*) FILTER (WHERE verdict = 'ANOMALY') AS anomalies,
    ROUND(100.0 * COUNT(*) FILTER (WHERE verdict = 'ANOMALY') / COUNT(*), 2) AS anomaly_rate_pct
FROM edge_readings
WHERE received_at > NOW() - INTERVAL '24 hours'
GROUP BY station_id
ORDER BY anomaly_rate_pct DESC;

-- Health degradation trend (last 7 days)
SELECT 
    station_id,
    DATE_TRUNC('day', received_at) AS day,
    AVG(health_score) AS avg_health
FROM edge_readings
WHERE received_at > NOW() - INTERVAL '7 days'
GROUP BY station_id, day
ORDER BY station_id, day;

-- Spatial query (stations within bounding box)
SELECT DISTINCT ON (station_id) *
FROM edge_readings
WHERE lat BETWEEN 18.0 AND 20.0
  AND lon BETWEEN 72.0 AND 74.0
  AND received_at > NOW() - INTERVAL '5 minutes'
ORDER BY station_id, received_at DESC;
```

---

## API Contracts

### REST Endpoints

#### `GET /api/health`
**Description:** Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-09-26T19:00:00Z",
  "version": "1.0.0",
  "uptime_seconds": 125487
}
```

#### `GET /api/edge/latest`
**Description:** Latest reading from all stations

**Query Parameters:**
- `limit` (optional): Max stations to return (default: 100)

**Response:**
```json
{
  "stations": [
    {
      "station_id": "SGA-MUM-01",
      "ts": "2026-09-26T18:59:50Z",
      "t": 31.5,
      "h": 72.3,
      "p": 1008.2,
      "verdict": "NORMAL",
      "score": 0.15,
      "confidence": 87,
      "health_score": 95,
      "lat": 19.076,
      "lon": 72.877
    }
  ],
  "count": 15,
  "timestamp": "2026-09-26T19:00:00Z"
}
```

#### `GET /api/edge/latest/{station_id}`
**Description:** Latest reading from specific station

**Response:**
```json
{
  "station_id": "SGA-MUM-01",
  "ts": "2026-09-26T18:59:50Z",
  "t": 31.5,
  "h": 72.3,
  "p": 1008.2,
  "verdict": "NORMAL",
  "score": 0.15,
  "confidence": 87,
  "root_cause": "OK",
  "evidence": [
    "Physical: All parameters in range",
    "Temporal: 0.8σ from seasonal baseline",
    "Spatial: 0.5σ from 5 neighbors"
  ],
  "health_score": 95,
  "maintenance_eta_days": null,
  "lat": 19.076,
  "lon": 72.877,
  "fw": "1.0.0",
  "received_at": "2026-09-26T18:59:51Z"
}
```

#### `GET /api/edge/history/{station_id}`
**Description:** Historical readings

**Query Parameters:**
- `start` (optional): ISO 8601 start time
- `end` (optional): ISO 8601 end time
- `limit` (optional): Max readings (default: 1000)
- `verdict` (optional): Filter by verdict (NORMAL|WARNING|ANOMALY)

**Response:**
```json
{
  "station_id": "SGA-MUM-01",
  "readings": [
    {
      "ts": "2026-09-26T18:59:50Z",
      "t": 31.5,
      "h": 72.3,
      "p": 1008.2,
      "verdict": "NORMAL",
      "score": 0.15
    }
  ],
  "count": 287,
  "start": "2026-09-26T00:00:00Z",
  "end": "2026-09-26T19:00:00Z"
}
```

#### `POST /api/edge/ingest`
**Description:** Ingest reading from ESP32

**Request Body:**
```json
{
  "station_id": "SGA-MUM-01",
  "sequence": 23891,
  "ts": "2026-09-26T19:00:00Z",
  "t": 31.7,
  "h": 74.2,
  "p": 997.8,
  "battery_v": 4.08,
  "rssi_dbm": -61,
  "uptime_s": 182930,
  "sensor_status": "ok",
  "offline_buffered": false
}
```

**Response:**
```json
{
  "success": true,
  "verdict": "NORMAL",
  "score": 0.18,
  "confidence": 89,
  "root_cause": "OK",
  "timestamp": "2026-09-26T19:00:01Z"
}
```

#### `GET /api/edge/stream` (Server-Sent Events)
**Description:** Real-time reading stream

**Response Format (text/event-stream):**
```
data: {"station_id":"SGA-MUM-01","ts":"2026-09-26T19:00:00Z","t":31.7,"h":74.2,"p":997.8,"verdict":"NORMAL","score":0.18}

data: {"station_id":"SGA-DEL-02","ts":"2026-09-26T19:00:01Z","t":28.3,"h":65.1,"p":1012.5,"verdict":"ANOMALY","score":0.75,"root_cause":"SPATIAL_OUTLIER"}
```

**Client Example:**
```javascript
const eventSource = new EventSource('/api/edge/stream');
eventSource.onmessage = (event) => {
  const reading = JSON.parse(event.data);
  console.log(`${reading.station_id}: ${reading.verdict}`);
};
```

---

## Deployment Topologies

### 1. Single-Server Development

```
┌──────────────────────────────────────┐
│      Development Machine              │
│                                       │
│  ┌──────────────┐  ┌──────────────┐ │
│  │   ESP32      │  │  Gateway     │ │
│  │ (WiFi local) │  │  (Python)    │ │
│  │              │  │  Port 3101   │ │
│  └──────┬───────┘  └──────┬───────┘ │
│         │                 │          │
│         └────────┬────────┘          │
│                  │                   │
│         ┌────────▼────────┐          │
│         │   SQLite DB     │          │
│         │   edge_store.db │          │
│         └─────────────────┘          │
│                                       │
│  ┌──────────────┐                    │
│  │  Dashboard   │                    │
│  │  (Vite dev)  │                    │
│  │  Port 5173   │                    │
│  └──────────────┘                    │
└──────────────────────────────────────┘

Access: http://localhost:5173
```

**Setup:**
```bash
# Terminal 1: Gateway
python gateway/server.py --port 3101 --demo

# Terminal 2: Dashboard
cd skyguard-app && npm run dev

# Terminal 3: ESP32 (upload firmware)
arduino --upload skyguard_bme280.ino
```

### 2. Production Cloud Deployment

```
┌────────────────────────────────────────────────────┐
│                 Cloud Provider                      │
│                 (AWS/GCP/Azure)                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │          Application Server (VM/Container)    │ │
│  │                                               │ │
│  │  ┌────────────────┐  ┌────────────────────┐ │ │
│  │  │  FastAPI       │  │  Nginx             │ │ │
│  │  │  (Uvicorn)     │  │  (Reverse Proxy)   │ │ │
│  │  │  Port 8000     │  │  Port 80/443       │ │ │
│  │  └────────┬───────┘  └────────┬───────────┘ │ │
│  │           │                   │              │ │
│  │           └───────┬───────────┘              │ │
│  │                   │                          │ │
│  │          ┌────────▼────────┐                │ │
│  │          │  TimescaleDB    │                │ │
│  │          │  (PostgreSQL)   │                │ │
│  │          │  Port 5432      │                │ │
│  │          └─────────────────┘                │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │          Static CDN (Dashboard)               │ │
│  │          (CloudFront/Cloud CDN)               │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
         ▲
         │ HTTPS
         │
┌────────┴────────┐
│  ESP32 Stations │
│  (Field sites)  │
│  WiFi/LTE       │
└─────────────────┘
```

**Docker Compose:**
```yaml
version: '3.8'

services:
  gateway:
    image: skyguard/gateway:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@timescaledb:5432/skyguard
      - MQTT_BROKER=mosquitto:1883
    depends_on:
      - timescaledb
      - mosquitto
  
  timescaledb:
    image: timescale/timescaledb:latest-pg14
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=changeme
  
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./skyguard-app/dist:/usr/share/nginx/html
    depends_on:
      - gateway

volumes:
  pgdata:
```

### 3. Edge-Only Deployment (No Internet)

```
┌──────────────────────────────────────┐
│      Local Site (Offline)             │
│                                       │
│  ┌──────────────┐                    │
│  │   ESP32      │                    │
│  │ (SD logging) │                    │
│  │  No WiFi     │                    │
│  └──────────────┘                    │
│                                       │
│  Manual SD card download weekly      │
│                                       │
│  ┌──────────────┐                    │
│  │ Laptop       │                    │
│  │ (Batch QC)   │                    │
│  │ anomaly_     │                    │
│  │ engine.py    │                    │
│  │ --csv        │                    │
│  └──────────────┘                    │
└──────────────────────────────────────┘
```

**Workflow:**
1. ESP32 logs to SD card (CSV, 10-day buffer @ 10s interval = ~86,400 readings)
2. Weekly site visit: swap SD card
3. Laptop batch processing: `python anomaly_engine.py --csv readings.csv`
4. Upload results to central system (when internet available)

---

## Security Considerations

### 1. Authentication & Authorization

**Current Status:** No authentication (development only)

**Production Requirements:**
- JWT tokens for API access
- Role-based access control (admin, operator, viewer)
- API keys for ESP32 devices
- OAuth2 integration (optional)

**Implementation:**
```python
# FastAPI + JWT
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/edge/latest")
async def get_latest(user=Depends(verify_token)):
    # Only authenticated users
    ...
```

### 2. Data Encryption

**In Transit:**
- HTTPS/TLS 1.3 for dashboard
- MQTTS (MQTT over TLS) for ESP32
- Certificate pinning for ESP32 clients

**At Rest:**
- Database encryption (PostgreSQL pg_crypto)
- SD card encryption (optional, FatFs with AES)

### 3. Input Validation

**Gateway API:**
```python
from pydantic import BaseModel, Field, validator

class ReadingIngest(BaseModel):
    station_id: str = Field(pattern="^SGA-[A-Z]{3}-\d{2}$")
    sequence: int = Field(ge=0)
    ts: datetime
    t: float = Field(ge=-50, le=70)  # Sensor absolute limits
    h: float = Field(ge=0, le=100)
    p: float = Field(ge=800, le=1100)
    
    @validator('ts')
    def ts_not_future(cls, v):
        if v > datetime.utcnow() + timedelta(minutes=5):
            raise ValueError('Timestamp too far in future')
        return v
```

### 4. Rate Limiting

**FastAPI middleware:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/edge/ingest")
@limiter.limit("100/minute")  # Max 100 readings/min per IP
async def ingest(request: Request, reading: ReadingIngest):
    ...
```

### 5. SQL Injection Prevention

**Parameterized queries only:**
```python
# ✅ Safe
cursor.execute(
    "SELECT * FROM edge_readings WHERE station_id = ?",
    (station_id,)
)

# ❌ Unsafe (never do this)
cursor.execute(f"SELECT * FROM edge_readings WHERE station_id = '{station_id}'")
```

### 6. CORS Policy

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dashboard.skyguard.example.com"],  # Specific origin
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

## Scalability & Performance

### Performance Metrics (Tested)

| Metric | Value | Hardware |
|--------|-------|----------|
| Detection latency | <50ms | i5-8250U @ 1.6GHz |
| Throughput | 100+ readings/sec | Single-threaded Python |
| Memory usage | <100MB | 1000 stations |
| SQLite write rate | 500+ inserts/sec | SSD |
| Dashboard FPS | 60fps | Chrome, 100 stations |

### Horizontal Scaling

**Load Balancer + Multiple Gateways:**

```
                  ┌────────────────┐
                  │ Load Balancer  │
                  │ (Nginx/HAProxy)│
                  └────────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
   │ Gateway 1 │     │ Gateway 2 │     │ Gateway 3 │
   │ (Worker)  │     │ (Worker)  │     │ (Worker)  │
   └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
         └─────────────────┼─────────────────┘
                           │
                  ┌────────▼───────┐
                  │  TimescaleDB   │
                  │  (Shared state)│
                  └────────────────┘
```

**Session affinity:** ESP32 stations can connect to any gateway (stateless design)

### Database Optimization

**TimescaleDB partitioning:**
- 1-day chunks (default)
- Compression after 7 days
- Retention policy: 90 days raw, 1 year aggregated

**Index strategy:**
```sql
-- Primary queries
CREATE INDEX idx_station_ts ON edge_readings (station_id, received_at DESC);
CREATE INDEX idx_verdict ON edge_readings (verdict, received_at DESC);

-- Spatial queries
CREATE INDEX idx_latlon ON edge_readings USING GIST (ll_to_earth(lat, lon));
```

**Query optimization:**
```sql
-- Use continuous aggregates for hourly/daily queries
SELECT * FROM edge_readings_hourly WHERE hour > NOW() - INTERVAL '7 days';

-- Avoid SELECT * (fetch only needed columns)
SELECT station_id, ts, t, verdict FROM edge_readings WHERE ...;
```

### Caching Strategy

**Redis caching (optional):**
```python
import redis

cache = redis.Redis(host='localhost', port=6379)

@app.get("/api/edge/latest/{station_id}")
async def get_latest(station_id: str):
    # Check cache first
    cached = cache.get(f"latest:{station_id}")
    if cached:
        return json.loads(cached)
    
    # Query DB
    reading = db.get_latest(station_id)
    
    # Cache for 10 seconds
    cache.setex(f"latest:{station_id}", 10, json.dumps(reading))
    
    return reading
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-26T19:00:00Z  
**Maintainer:** Sky Guard AI Team  
**License:** MIT
