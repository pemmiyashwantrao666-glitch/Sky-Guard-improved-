/*
 * ============================================================================
 * Sky Guard AI — ESP32 + BME280 Weather Station Firmware
 * ============================================================================
 * 
 * Hardware:
 *   - ESP32 DevKit (38-pin)
 *   - BME280 sensor (I²C: SDA=21, SCL=22)
 *   - MicroSD card module (SPI: CS=5, MOSI=23, MISO=19, SCK=18)
 *   - Battery voltage monitor (GPIO34 via voltage divider)
 *   - Status LEDs (WiFi=2, MQTT=4, SD=15)
 * 
 * Features:
 *   - BME280 reading every 10 seconds (configurable)
 *   - Local SD card CSV logging with sequence numbers
 *   - MQTT publishing to gateway
 *   - HTTP POST fallback
 *   - NTP time synchronization
 *   - Offline buffering with auto-sync
 *   - Watchdog timer for reliability
 *   - Battery voltage monitoring
 * 
 * Output Format (JSON over MQTT):
 *   {
 *     "station_id": "SGA-ESP32-01",
 *     "sequence": 23891,
 *     "ts": "2026-09-26T18:30:00Z",
 *     "t": 31.7,
 *     "h": 74.2,
 *     "p": 997.8,
 *     "battery_v": 4.08,
 *     "rssi_dbm": -61,
 *     "uptime_s": 182930,
 *     "sensor_status": "ok",
 *     "offline_buffered": false
 *   }
 * 
 * Installation:
 *   1. Install libraries: Adafruit_BME280, PubSubClient, NTPClient, ArduinoJson
 *   2. Format SD card as FAT32
 *   3. Update config section below (WiFi, MQTT, Station ID)
 *   4. Upload to ESP32
 * 
 * License: MIT
 * ============================================================================
 */

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <SD.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>

// ============================================================================
// CONFIGURATION — Update these values before uploading
// ============================================================================

// Station Identity
const char* STATION_ID = "SGA-ESP32-01";

// WiFi Configuration
const char* WIFI_SSID = "YourWiFiSSID";
const char* WIFI_PASSWORD = "YourWiFiPassword";
const int WIFI_TIMEOUT_SEC = 30;

// MQTT Configuration
const char* MQTT_BROKER = "192.168.1.100";  // Gateway IP address
const int MQTT_PORT = 1883;
const char* MQTT_TOPIC = "skyguard/readings";
const char* MQTT_CLIENT_ID = "SGA-ESP32-01";
const char* MQTT_USER = "";  // Leave empty if no auth
const char* MQTT_PASS = "";

// HTTP Fallback (if MQTT fails)
const char* HTTP_ENDPOINT = "http://192.168.1.100:3101/api/edge/ingest";

// Sampling Configuration
const unsigned long SAMPLE_INTERVAL_MS = 10000;  // 10 seconds
const int MAX_OFFLINE_BUFFER = 500;               // Max readings to buffer

// Hardware Pin Definitions
const int SD_CS_PIN = 5;
const int LED_WIFI = 2;
const int LED_MQTT = 4;
const int LED_SD = 15;
const int BATTERY_PIN = 34;  // ADC1_CH6

// NTP Configuration
const long UTC_OFFSET_SEC = 0;
const char* NTP_SERVER = "pool.ntp.org";

// Watchdog Timeout
const int WDT_TIMEOUT_SEC = 60;

// ============================================================================
// Global Objects
// ============================================================================

Adafruit_BME280 bme;
WiFiClient espClient;
PubSubClient mqttClient(espClient);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, NTP_SERVER, UTC_OFFSET_SEC, 60000);

// State Variables
unsigned long sequence = 0;
unsigned long lastSampleTime = 0;
unsigned long startTime = 0;
bool sdAvailable = false;
bool wifiConnected = false;
bool mqttConnected = false;
bool ntpSynced = false;
String offlineBuffer[MAX_OFFLINE_BUFFER];
int offlineBufferCount = 0;

// ============================================================================
// Setup
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n====================================");
  Serial.println("Sky Guard AI — ESP32 Weather Station");
  Serial.println("====================================\n");
  
  // Initialize LEDs
  pinMode(LED_WIFI, OUTPUT);
  pinMode(LED_MQTT, OUTPUT);
  pinMode(LED_SD, OUTPUT);
  digitalWrite(LED_WIFI, LOW);
  digitalWrite(LED_MQTT, LOW);
  digitalWrite(LED_SD, LOW);
  
  // Initialize Watchdog
  Serial.println("[WDT] Enabling watchdog timer...");
  esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL);
  
  // Initialize BME280
  Serial.print("[BME280] Initializing sensor...");
  Wire.begin();
  if (!bme.begin(0x76)) {
    Serial.println(" FAILED!");
    Serial.println("[BME280] Could not find sensor. Check wiring.");
    blinkError(LED_SD);
    ESP.restart();
  }
  Serial.println(" OK");
  
  // Configure BME280
  bme.setSampling(Adafruit_BME280::MODE_FORCED,
                  Adafruit_BME280::SAMPLING_X1,   // Temperature
                  Adafruit_BME280::SAMPLING_X1,   // Pressure
                  Adafruit_BME280::SAMPLING_X1,   // Humidity
                  Adafruit_BME280::FILTER_OFF);
  
  // Initialize SD Card
  Serial.print("[SD] Initializing card...");
  if (!SD.begin(SD_CS_PIN)) {
    Serial.println(" FAILED!");
    Serial.println("[SD] No card detected or initialization failed.");
    sdAvailable = false;
  } else {
    Serial.println(" OK");
    sdAvailable = true;
    digitalWrite(LED_SD, HIGH);
    
    // Create header if new file
    if (!SD.exists("/readings.csv")) {
      File csvFile = SD.open("/readings.csv", FILE_WRITE);
      if (csvFile) {
        csvFile.println("sequence,timestamp_utc,temperature_c,humidity_pct,pressure_hpa,battery_v,rssi_dbm,uptime_s,sensor_status");
        csvFile.close();
        Serial.println("[SD] Created readings.csv with header");
      }
    }
    
    // Load last sequence number
    sequence = loadLastSequence();
    Serial.printf("[SD] Resuming from sequence %lu\n", sequence);
  }
  
  // Connect to WiFi
  connectWiFi();
  
  // Initialize MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  
  // Sync NTP time
  if (wifiConnected) {
    syncNTP();
  }
  
  startTime = millis();
  Serial.println("\n[READY] Station operational\n");
}

// ============================================================================
// Main Loop
// ============================================================================

void loop() {
  esp_task_wdt_reset();  // Feed watchdog
  
  unsigned long now = millis();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("[WiFi] Connection lost. Reconnecting...");
      wifiConnected = false;
      digitalWrite(LED_WIFI, LOW);
    }
    connectWiFi();
  } else {
    if (!wifiConnected) {
      wifiConnected = true;
      digitalWrite(LED_WIFI, HIGH);
      syncNTP();
      flushOfflineBuffer();  // Send buffered readings
    }
  }
  
  // Maintain MQTT connection
  if (wifiConnected) {
    if (!mqttClient.connected()) {
      if (mqttConnected) {
        Serial.println("[MQTT] Connection lost. Reconnecting...");
        mqttConnected = false;
        digitalWrite(LED_MQTT, LOW);
      }
      connectMQTT();
    } else {
      if (!mqttConnected) {
        mqttConnected = true;
        digitalWrite(LED_MQTT, HIGH);
      }
      mqttClient.loop();
    }
  }
  
  // Resync NTP every 6 hours
  if (wifiConnected && ntpSynced && (now - timeClient.getEpochTime() * 1000UL > 21600000)) {
    syncNTP();
  }
  
  // Sample sensor at interval
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;
    sampleAndPublish();
  }
  
  delay(100);
}

// ============================================================================
// WiFi Functions
// ============================================================================

void connectWiFi() {
  Serial.printf("[WiFi] Connecting to %s...", WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < WIFI_TIMEOUT_SEC) {
    delay(500);
    Serial.print(".");
    timeout++;
    if (timeout % 10 == 0) {
      Serial.println();
      Serial.print("[WiFi] Still connecting...");
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" CONNECTED");
    Serial.printf("[WiFi] IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi] RSSI: %d dBm\n", WiFi.RSSI());
    wifiConnected = true;
    digitalWrite(LED_WIFI, HIGH);
  } else {
    Serial.println(" TIMEOUT");
    wifiConnected = false;
    digitalWrite(LED_WIFI, LOW);
  }
}

// ============================================================================
// MQTT Functions
// ============================================================================

void connectMQTT() {
  if (!wifiConnected) return;
  
  Serial.print("[MQTT] Connecting to broker...");
  
  bool connected = false;
  if (strlen(MQTT_USER) > 0) {
    connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS);
  } else {
    connected = mqttClient.connect(MQTT_CLIENT_ID);
  }
  
  if (connected) {
    Serial.println(" CONNECTED");
    mqttConnected = true;
    digitalWrite(LED_MQTT, HIGH);
  } else {
    Serial.printf(" FAILED (state=%d)\n", mqttClient.state());
    mqttConnected = false;
    digitalWrite(LED_MQTT, LOW);
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Handle incoming MQTT messages (future: remote commands)
}

// ============================================================================
// NTP Functions
// ============================================================================

void syncNTP() {
  Serial.print("[NTP] Synchronizing time...");
  timeClient.begin();
  
  int retries = 0;
  while (!timeClient.update() && retries < 10) {
    timeClient.forceUpdate();
    delay(500);
    retries++;
  }
  
  if (retries < 10) {
    Serial.println(" OK");
    Serial.printf("[NTP] UTC: %s\n", timeClient.getFormattedDate().c_str());
    ntpSynced = true;
  } else {
    Serial.println(" FAILED");
    ntpSynced = false;
  }
}

String getTimestamp() {
  if (ntpSynced) {
    return timeClient.getFormattedDate();
  } else {
    // Fallback to millis-based timestamp
    unsigned long sec = millis() / 1000;
    char buf[32];
    snprintf(buf, sizeof(buf), "1970-01-01T00:%02lu:%02lu.000Z", 
             (sec / 60) % 60, sec % 60);
    return String(buf);
  }
}

// ============================================================================
// Sensor Reading
// ============================================================================

void sampleAndPublish() {
  sequence++;
  
  // Force BME280 measurement
  bme.takeForcedMeasurement();
  
  float temp = bme.readTemperature();
  float humidity = bme.readHumidity();
  float pressure = bme.readPressure() / 100.0F;  // Convert Pa to hPa
  float batteryVoltage = readBatteryVoltage();
  int rssi = WiFi.RSSI();
  unsigned long uptime = (millis() - startTime) / 1000;
  String timestamp = getTimestamp();
  
  // Validate readings
  String sensorStatus = "ok";
  if (isnan(temp) || isnan(humidity) || isnan(pressure)) {
    sensorStatus = "error";
    Serial.println("[ERROR] BME280 read failed - NaN values");
  }
  
  // Print to serial
  Serial.printf("[%lu] T=%.1f°C H=%.1f%% P=%.1fhPa Bat=%.2fV RSSI=%ddBm\n",
                sequence, temp, humidity, pressure, batteryVoltage, rssi);
  
  // Build JSON payload
  StaticJsonDocument<384> doc;
  doc["station_id"] = STATION_ID;
  doc["sequence"] = sequence;
  doc["ts"] = timestamp;
  doc["t"] = roundf(temp * 10) / 10.0;
  doc["h"] = roundf(humidity * 10) / 10.0;
  doc["p"] = roundf(pressure * 10) / 10.0;
  doc["battery_v"] = roundf(batteryVoltage * 100) / 100.0;
  doc["rssi_dbm"] = rssi;
  doc["uptime_s"] = uptime;
  doc["sensor_status"] = sensorStatus;
  doc["offline_buffered"] = false;
  
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  // Log to SD card
  if (sdAvailable) {
    logToSD(sequence, timestamp, temp, humidity, pressure, batteryVoltage, rssi, uptime, sensorStatus);
  }
  
  // Publish via MQTT
  bool published = false;
  if (mqttConnected) {
    published = mqttClient.publish(MQTT_TOPIC, jsonPayload.c_str());
    if (published) {
      Serial.println("[MQTT] Published OK");
    } else {
      Serial.println("[MQTT] Publish FAILED");
    }
  }
  
  // HTTP POST fallback
  if (!published && wifiConnected) {
    Serial.println("[HTTP] Trying fallback...");
    published = postHTTP(jsonPayload);
  }
  
  // Buffer offline if both failed
  if (!published) {
    bufferOffline(jsonPayload);
  }
}

// ============================================================================
// SD Card Functions
// ============================================================================

void logToSD(unsigned long seq, String ts, float t, float h, float p, 
             float bat, int rssi, unsigned long uptime, String status) {
  if (!sdAvailable) return;
  
  File csvFile = SD.open("/readings.csv", FILE_APPEND);
  if (!csvFile) {
    Serial.println("[SD] Failed to open file for writing");
    sdAvailable = false;
    digitalWrite(LED_SD, LOW);
    return;
  }
  
  csvFile.printf("%lu,%s,%.2f,%.2f,%.2f,%.2f,%d,%lu,%s\n",
                 seq, ts.c_str(), t, h, p, bat, rssi, uptime, status.c_str());
  csvFile.close();
}

unsigned long loadLastSequence() {
  if (!sdAvailable) return 0;
  
  File csvFile = SD.open("/readings.csv", FILE_READ);
  if (!csvFile) return 0;
  
  unsigned long lastSeq = 0;
  String line;
  
  while (csvFile.available()) {
    line = csvFile.readStringUntil('\n');
    if (line.startsWith("sequence")) continue;  // Skip header
    
    int commaPos = line.indexOf(',');
    if (commaPos > 0) {
      unsigned long seq = line.substring(0, commaPos).toInt();
      if (seq > lastSeq) lastSeq = seq;
    }
  }
  
  csvFile.close();
  return lastSeq;
}

// ============================================================================
// Offline Buffer
// ============================================================================

void bufferOffline(String payload) {
  if (offlineBufferCount >= MAX_OFFLINE_BUFFER) {
    Serial.println("[BUFFER] Full, dropping oldest");
    // Shift buffer left
    for (int i = 0; i < MAX_OFFLINE_BUFFER - 1; i++) {
      offlineBuffer[i] = offlineBuffer[i + 1];
    }
    offlineBufferCount--;
  }
  
  offlineBuffer[offlineBufferCount++] = payload;
  Serial.printf("[BUFFER] Stored reading (%d buffered)\n", offlineBufferCount);
}

void flushOfflineBuffer() {
  if (offlineBufferCount == 0) return;
  
  Serial.printf("[BUFFER] Flushing %d buffered readings...\n", offlineBufferCount);
  
  int sent = 0;
  for (int i = 0; i < offlineBufferCount; i++) {
    bool success = false;
    
    // Mark as buffered
    StaticJsonDocument<384> doc;
    deserializeJson(doc, offlineBuffer[i]);
    doc["offline_buffered"] = true;
    String payload;
    serializeJson(doc, payload);
    
    if (mqttConnected) {
      success = mqttClient.publish(MQTT_TOPIC, payload.c_str());
    }
    
    if (!success && wifiConnected) {
      success = postHTTP(payload);
    }
    
    if (success) {
      sent++;
      delay(100);  // Rate limit
    } else {
      break;  // Stop on first failure
    }
  }
  
  // Shift remaining items
  if (sent > 0) {
    for (int i = 0; i < offlineBufferCount - sent; i++) {
      offlineBuffer[i] = offlineBuffer[i + sent];
    }
    offlineBufferCount -= sent;
  }
  
  Serial.printf("[BUFFER] Sent %d, %d remaining\n", sent, offlineBufferCount);
}

// ============================================================================
// HTTP Functions
// ============================================================================

bool postHTTP(String payload) {
  HTTPClient http;
  http.begin(HTTP_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(payload);
  bool success = (httpCode == 200);
  
  if (success) {
    Serial.printf("[HTTP] POST OK (%d)\n", httpCode);
  } else {
    Serial.printf("[HTTP] POST FAILED (%d)\n", httpCode);
  }
  
  http.end();
  return success;
}

// ============================================================================
// Battery Voltage
// ============================================================================

float readBatteryVoltage() {
  // Read ADC (12-bit: 0-4095)
  int adcValue = analogRead(BATTERY_PIN);
  
  // Convert to voltage (assuming 3.3V reference, 2:1 voltage divider)
  float voltage = (adcValue / 4095.0) * 3.3 * 2.0;
  
  return voltage;
}

// ============================================================================
// Utility Functions
// ============================================================================

void blinkError(int pin) {
  for (int i = 0; i < 10; i++) {
    digitalWrite(pin, HIGH);
    delay(200);
    digitalWrite(pin, LOW);
    delay(200);
  }
}
