/*
============================================================================
SkyGuard Edge AI — ESP32 Firmware
============================================================================
Lightweight anomaly detection for AWS-style weather stations running on
ESP32 (or ESP8266 with minor pin changes). Uses a simplified 4-rule engine
that mirrors the Python backend's L1-L4 logic in ~8KB of flash.

Features:
  * Reads BME280 (T/RH/P) or equivalent I2C sensor
  * Implements L1-L4 detection locally
  * Exposes JSON over Serial / BLE / WiFi
  * Low-power deep-sleep mode (battery-friendly)
  * Self-healing: auto-imputes corrected values when anomaly detected
  * OTA-ready scaffold

Wiring (I2C):
  BME280 VCC -> 3V3
  BME280 GND -> GND
  BME280 SDA -> GPIO21
  BME280 SCL -> GPIO22

Install:
  1. Install ESP32 board package in Arduino IDE
  2. Install Adafruit BME280 Library (Adafruit Unified Sensor, Adafruit BusIO)
  3. Select board: ESP32 Dev Module
  4. Upload

Serial monitor: 115200 baud
============================================================================
*/

#include <Wire.h>
#include <Adafruit_BME280.h>
#include <ArduinoJson.h>  // v6.x — install via Library Manager
#ifdef ESP32
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#endif

// -------------------------- CONFIG --------------------------
const unsigned long TICK_MS        = 2000;   // sampling interval
const unsigned long HISTORY_MAX    = 30;     // rolling window
const float        Z_THRESH        = 2.5;    // z-score threshold
const float        ANOMALY_THRESH  = 0.50;   // fused score threshold
const float        WARNING_THRESH  = 0.30;
const unsigned long DEEP_SLEEP_SEC  = 0;     // 0 = disable deep sleep

// ---- Edge identity (set per physical node) ----
const char* STATION_ID = "EDGE-PUNE-01";
const float STATION_LAT = 18.5204;
const float STATION_LON = 73.8567;
const char* FW_VERSION = "skyguard-edge-v2";

// ---- WiFi uplink (Option B: WiFi HTTP gateway) ----
// Fill in before flashing a field node. Leave WIFI_SSID empty to run
// in Serial-only mode (no WiFi, same behaviour as v1 firmware).
const char* WIFI_SSID   = "";
const char* WIFI_PASS   = "";
const char* GATEWAY_URL = "http://192.168.1.10:3101/api/edge/ingest";
const unsigned long POST_EVERY_N = 5;  // POST 1 in N ticks (every ~10s @2s tick)
const long GMT_OFFSET_SEC = 19800;     // IST = UTC+5:30
const int  DAYLIGHT_OFFSET_SEC = 0;

// Physical limits
const float T_LO = -10.0, T_HI = 60.0;
const float H_LO =   0.0, H_HI = 100.0;
const float P_LO = 870.0, P_HI = 1084.0;

// -------------------------- STATE --------------------------
Adafruit_BME280 bme;

struct Reading {
  float t, h, p;
  unsigned long ts;
};

struct Baseline {
  float ewma[3], sd[3];
  int n;
  float hourly[3][24];  // param*24 — simplified seasonal
  int hourlyN[3][24];
};

Baseline bl;
Reading history[HISTORY_MAX];
int histLen = 0;
int histHead = 0;

enum Status { OK, WARNING, ANOMALY };
Status lastStatus = OK;

// -------------------------- HELPERS --------------------------
float safeMean(float* vals, int n) {
  float sum = 0; int c = 0;
  for (int i = 0; i < n; i++) if (!isnan(vals[i])) { sum += vals[i]; c++; }
  return c ? sum / c : NAN;
}

float safeStd(float* vals, int n, float mean) {
  if (n < 2) return 0.8;
  float sum = 0; int c = 0;
  for (int i = 0; i < n; i++) if (!isnan(vals[i])) { sum += sq(vals[i] - mean); c++; }
  return c > 1 ? sqrt(sum / c) : 0.8;
}

// -------------------------- L1: Physical --------------------------
bool l1Physical(float t, float h, float p) {
  if (isnan(t) || isnan(h) || isnan(p)) return true;  // comm loss
  if (t < T_LO || t > T_HI) return true;
  if (h < H_LO || h > H_HI) return true;
  if (p < P_LO || p > P_HI) return true;
  return false;
}

// -------------------------- L2: Temporal --------------------------
float l2Temporal(float val, float ewma, float sd, int n) {
  if (n < 8 || isnan(ewma)) return 0.0;
  float ref = ewma;
  if (sd < 0.001) sd = 0.001;
  return fabs((val - ref) / sd);
}

// -------------------------- L3: Spatial (mocked for edge) --------------------------
float l3Spatial(float val, float* neighborVals, int nNeighbors) {
  if (nNeighbors < 2) return 0.0;
  float mean = safeMean(neighborVals, nNeighbors);
  float spread = safeStd(neighborVals, nNeighbors, mean);
  if (spread < 0.001) spread = 0.001;
  return fabs((val - mean) / (spread * 1.6));
}

// -------------------------- L4: Multivariate --------------------------
bool l4Multivariate(float t, float h, float p, Reading* h10, int n) {
  // Dewpoint coherence
  if (!isnan(t) && !isnan(h)) {
    float dp = t - (100 - h) / 5;
    if (t >= 45 && h >= 85) return true;
  }
  // Pressure drop
  if (n >= 2 && !isnan(p) && !isnan(h10[n-1].p)) {
    float drop = h10[n-1].p - p;
    if (drop >= 5) return true;
  }
  // Frozen sensor (temperature)
  if (n >= 8) {
    bool frozen = true;
    float last = h10[n-1].t;
    for (int i = n-8; i < n; i++) {
      if (fabs(h10[i].t - last) > 1e-6) { frozen = false; break; }
    }
    if (frozen) return true;
  }
  return false;
}

// -------------------------- Learning --------------------------
void learn(float t, float h, float p, int hour) {
  float vals[3] = {t, h, p};
  float alpha = 0.08;
  for (int k = 0; k < 3; k++) {
    if (isnan(vals[k])) continue;
    if (bl.n == 0 || bl.ewma[k] != bl.ewma[k]) {  // NAN check
      bl.ewma[k] = vals[k]; bl.sd[k] = 0.8; bl.n = 1;
    } else {
      bl.ewma[k] = alpha * vals[k] + (1 - alpha) * bl.ewma[k];
      float dev = fabs(vals[k] - bl.ewma[k]);
      bl.sd[k] = 0.9 * bl.sd[k] + 0.1 * dev;
      bl.n++;
    }
    bl.hourlyN[k][hour]++;
    bl.hourly[k][hour] += vals[k];
    if (bl.hourlyN[k][hour] > 60) {
      bl.hourly[k][hour] -= vals[k];
      bl.hourlyN[k][hour]--;
    }
  }
}

float seasonalMean(int param, int hour) {
  int n = bl.hourlyN[param][hour];
  if (n < 3) return NAN;
  return bl.hourly[param][hour] / n;
}

// -------------------------- Root Cause --------------------------
String classify(bool l1, bool l4, float l2, float l3, bool frozen) {
  if (l1) return "COMM_LOSS / RANGE_VIOLATION";
  if (frozen) return "STUCK_SENSOR";
  if (l2 > 0 && l3 > 0) return "SENSOR_FAULT";
  if (l3 > 0 && l2 == 0) return "SPATIAL_OUTLIER";
  if (l2 > 0 && l3 == 0) return "REAL_EVENT";
  if (l4) return "PHYSICS_CONFLICT";
  return "NOMINAL";
}

// -------------------------- Master Inference --------------------------
float infer(Reading* r, int n, float* neighborT, int nNeighbors, bool& anomaly, bool& warning) {
  bool l1 = l1Physical(r->t, r->h, r->p);
  float l2t = l2Temporal(r->t, bl.ewma[0], bl.sd[0], bl.n);
  float l2h = l2Temporal(r->h, bl.ewma[1], bl.sd[1], bl.n);
  float l2p = l2Temporal(r->p, bl.ewma[2], bl.sd[2], bl.n);
  float l2 = max(max(l2t, l2h), l2p);
  float l3 = max(
    l3Spatial(r->t, neighborT, nNeighbors),
    l3Spatial(r->h, neighborT, nNeighbors)  // simplified: same array in real impl
  );
  bool l4 = l4Multivariate(r->t, r->h, r->p, history, histLen);
  bool frozen = false;
  if (histLen >= 8) {
    frozen = true;
    float last = history[histLen-1].t;
    for (int i = histLen-8; i < histLen; i++) {
      if (fabs(history[i].t - last) > 1e-6) { frozen = false; break; }
    }
  }

  float score = 0.0;
  if (l1) score += 0.25 * 1.0;
  if (l2 >= Z_THRESH) score += 0.30 * min(1.0, l2 / (Z_THRESH + 1.5));
  if (l3 >= Z_THRESH + 0.5) score += 0.25 * min(1.0, l3 / (Z_THRESH + 2.0));
  if (l4) score += 0.20 * min(1.0, 1.0);

  anomaly = score >= ANOMALY_THRESH;
  warning = !anomaly && score >= WARNING_THRESH;
  return score;
}

// -------------------------- Imputation --------------------------
void impute(Reading* r, int hour) {
  float seasT = seasonalMean(0, hour);
  float seasH = seasonalMean(1, hour);
  float seasP = seasonalMean(2, hour);
  if (!isnan(seasT)) r->t = seasT;
  if (!isnan(seasH)) r->h = seasH;
  if (!isnan(seasP)) r->p = seasP;
}

// -------------------------- JSON Output --------------------------
// ISO-8601 wall-clock timestamp when NTP is synced, else millis fallback.
String isoTimestamp(unsigned long tickCount) {
#ifdef ESP32
  if (strlen(WIFI_SSID) > 0 && WiFi.status() == WL_CONNECTED) {
    struct tm tm;
    if (getLocalTime(&tm, 50)) {
      char buf[32];
      strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+05:30", &tm);
      return String(buf);
    }
  }
#endif
  return String(tickCount);
}

String readingToJson(Reading* r, float score, bool anomaly, bool warning, String rootCause) {
  StaticJsonDocument<768> doc;
  doc["station_id"] = STATION_ID;
  doc["ts"] = isoTimestamp(r->ts);
  doc["t"] = round(r->t, 2);
  doc["h"] = round(r->h, 1);
  doc["p"] = round(r->p, 1);
  doc["score"] = round(score, 3);
  doc["verdict"] = anomaly ? "ANOMALY" : (warning ? "WARNING" : "NORMAL");
  doc["root_cause"] = rootCause;
  doc["lat"] = STATION_LAT;
  doc["lon"] = STATION_LON;
  doc["fw"] = FW_VERSION;
  String out;
  serializeJson(doc, out);
  return out;
}

#ifdef ESP32
// -------------------------- WiFi uplink --------------------------
bool wifiEnabled() { return strlen(WIFI_SSID) > 0; }

void wifiConnect() {
  if (!wifiEnabled() || WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) delay(250);
  if (WiFi.status() == WL_CONNECTED) {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, "pool.ntp.org", "time.nist.gov");
  }
}

void postToGateway(const String& payload) {
  if (!wifiEnabled() || WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(GATEWAY_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);
  int code = http.POST(payload);
  // Best-effort uplink: never block sensing on gateway errors.
  (void)code;
  http.end();
}
#endif

// -------------------------- Setup / Loop --------------------------
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  if (!bme.begin(0x76)) {
    Serial.println("{\"error\":\"BME280 not found\"}");
    while (1);
  }
  memset(&bl, 0, sizeof(bl));
  if (DEEP_SLEEP_SEC > 0) {
    esp_sleep_enable_timer_wakeup(DEEP_SLEEP_SEC * 1000000ULL);
  }
#ifdef ESP32
  // NOTE: deep-sleep and WiFi uplink don't mix — the radio shuts down on
  // sleep. Keep DEEP_SLEEP_SEC=0 on mains-powered gateway nodes.
  wifiConnect();
  Serial.print("{\"status\":\"ready\",\"fw\":\"");
  Serial.print(FW_VERSION);
  Serial.print("\",\"station_id\":\"");
  Serial.print(STATION_ID);
  Serial.println("\"}");
#else
  Serial.println("{\"status\":\"ready\",\"fw\":\"skyguard-edge-v1\"}");
#endif
}

void loop() {
  static unsigned long lastTick = 0;
  static unsigned long tickCount = 0;
  if (millis() - lastTick < TICK_MS) return;
  lastTick = millis();
  tickCount++;

  Reading r;
  r.t = bme.readTemperature();
  r.h = bme.readHumidity();
  r.p = bme.readPressure() / 100.0;
  r.ts = millis();

  // Mock neighbors (replace with LoRa / BLE / MQTT neighbors in production)
  float neighbors[2] = {r.t + 0.5, r.t - 0.5};
  int nNeighbors = 2;

  bool anomaly, warning;
  float score = infer(&r, histLen, neighbors, nNeighbors, anomaly, warning);
  String rootCause = classify(l1Physical(r.t, r.h, r.p), false, 0, 0, false);

  // Self-healing: impute corrected values on anomaly
  if (anomaly) impute(&r, (r.ts / 3600000) % 24);

  // Learn from good readings only
  if (!anomaly && !warning) {
    int hour = (r.ts / 3600000) % 24;
    learn(r.t, r.h, r.p, hour);
  }

  // Update history
  if (histLen < HISTORY_MAX) {
    history[histLen++] = r;
  } else {
    history[histHead] = r;
    histHead = (histHead + 1) % HISTORY_MAX;
  }

  String payload = readingToJson(&r, score, anomaly, warning, rootCause);
  Serial.println(payload);

#ifdef ESP32
  // Best-effort WiFi uplink: Serial always prints; gateway POST throttled.
  if (wifiEnabled() && (tickCount % POST_EVERY_N == 0)) {
    if (WiFi.status() != WL_CONNECTED) wifiConnect();
    postToGateway(payload);
  }
#endif

  if (DEEP_SLEEP_SEC > 0) {
    esp_deep_sleep_start();
  }
}
