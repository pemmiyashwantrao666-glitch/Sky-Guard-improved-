# ESP32 Hardware Setup Guide — Sky Guard AI

**Weather Station Hardware Integration**  
**Version:** 1.0  
**Last Updated:** 2026-09-26

---

## Table of Contents

1. [Hardware Overview](#hardware-overview)
2. [Bill of Materials](#bill-of-materials)
3. [Wiring Diagram](#wiring-diagram)
4. [Assembly Instructions](#assembly-instructions)
5. [Firmware Installation](#firmware-installation)
6. [Configuration](#configuration)
7. [Testing & Validation](#testing--validation)
8. [Field Deployment](#field-deployment)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

---

## Hardware Overview

The Sky Guard AI ESP32 weather station is a low-cost, low-power sensor node that:

- **Measures:** Temperature, humidity, atmospheric pressure
- **Logs:** All readings to local MicroSD card (CSV format)
- **Transmits:** JSON payloads via MQTT/HTTP to gateway
- **Buffers:** Up to 500 readings offline with auto-sync
- **Monitors:** Battery voltage, WiFi signal strength, sensor health
- **Detects:** Edge-level anomalies (range checks, spikes, frozen sensors)

**Operating Modes:**
- **Normal:** WiFi connected, real-time transmission + SD logging
- **Offline:** No WiFi, SD-only logging with sequence tracking
- **Edge-Anomaly:** Lightweight fault detection on device
- **Low-Power:** Deep sleep between samples (future feature)

---

## Bill of Materials

### Core Components

| Item | Specification | Quantity | Approx. Cost (USD) | Link/Part Number |
|------|--------------|----------|-------------------|------------------|
| **ESP32 DevKit** | 38-pin, WiFi + BT | 1 | $6-10 | ESP32-WROOM-32 |
| **BME280 Sensor** | I²C, 3.3V | 1 | $4-8 | Adafruit BME280 or GY-BME280 |
| **MicroSD Module** | SPI, 3.3V logic | 1 | $2-4 | Standard SPI SD card module |
| **MicroSD Card** | 4-32GB, FAT32 | 1 | $5-10 | Class 10 recommended |
| **LiPo Battery** | 3.7V, 2000-5000mAh | 1 | $8-15 | 18650 with protection circuit |
| **Battery Holder** | 18650 holder with leads | 1 | $1-2 | — |
| **Voltage Regulator** | 3.3V LDO, optional if using USB power | 1 | $1 | AMS1117-3.3 |

### Electronics Components

| Item | Value | Quantity | Purpose |
|------|-------|----------|---------|
| Resistor | 100kΩ | 1 | Battery voltage divider (high side) |
| Resistor | 10kΩ | 1 | Battery voltage divider (low side) |
| LED | Red | 1 | WiFi status (GPIO 2) |
| LED | Green | 1 | MQTT status (GPIO 4) |
| LED | Blue | 1 | SD card status (GPIO 15) |
| Resistor | 220Ω | 3 | LED current limiting |
| Capacitor | 100µF | 1 | Power supply decoupling |
| Capacitor | 10µF | 2 | Sensor/SD power smoothing |
| Push Button | SPST | 1 | Reset switch |
| Jumper Wires | Male-Female | 15-20 | Connections |
| Breadboard | Full-size | 1 | Prototyping (or custom PCB) |

### Enclosure & Mounting

| Item | Specification | Quantity | Purpose |
|------|--------------|----------|---------|
| Weatherproof Box | IP65 rated, 150×100×70mm | 1 | Outdoor protection |
| Cable Glands | PG7, 2-pack | 1 | Sealed cable entry |
| Mounting Bracket | Adjustable, stainless steel | 1 | Pole/wall mounting |
| Desiccant Pack | Silica gel, 10g | 2 | Moisture control |
| Solar Panel | 6V 1W (optional) | 1 | Battery charging |

**Total Cost:** ~$50-80 per station (without solar panel)

---

## Wiring Diagram

### Pin Connections

#### ESP32 ↔ BME280 (I²C)
```
ESP32               BME280
-----               ------
3.3V       ───────► VCC
GND        ───────► GND
GPIO 21    ───────► SDA
GPIO 22    ───────► SCL
```

#### ESP32 ↔ MicroSD Module (SPI)
```
ESP32               SD Module
-----               ---------
3.3V       ───────► VCC
GND        ───────► GND
GPIO 5     ───────► CS  (Chip Select)
GPIO 23    ───────► MOSI
GPIO 19    ───────► MISO
GPIO 18    ───────► SCK (Clock)
```

#### ESP32 ↔ Battery Monitor
```
Battery (+) ──┬─────────────► VIN (5V pin if using USB, or 3.3V rail)
              │
              └── 100kΩ ──┬── GPIO 34 (ADC1_CH6)
                          │
                          └── 10kΩ ──► GND

Voltage divider ratio: 110kΩ total
ADC reads: (Battery voltage × 10kΩ) / 110kΩ
```

#### ESP32 ↔ Status LEDs
```
GPIO 2  ──── 220Ω ──── LED Red (+)   ──── GND  (WiFi status)
GPIO 4  ──── 220Ω ──── LED Green (+) ──── GND  (MQTT status)
GPIO 15 ──── 220Ω ──── LED Blue (+)  ──── GND  (SD card status)
```

### Fritzing Diagram

```
         ┌──────────────────────────┐
         │      ESP32 DevKit        │
         │                          │
    3.3V ├──┬───────┬────────┬──────┤
         │  │       │        │      │
         │  │   ┌───▼────┐   │   ┌──▼──────┐
         │  │   │ BME280 │   │   │ SD Card │
         │  │   │  I²C   │   │   │  SPI    │
         │  │   └───┬────┘   │   └──┬──────┘
         │  │       │        │      │
     GND ├──┴───────┴────────┴──────┤
         │                          │
  GPIO21 ├────► SDA                 │
  GPIO22 ├────► SCL                 │
         │                          │
  GPIO23 ├────► MOSI ───────────────┤
  GPIO19 ├────► MISO ───────────────┤
  GPIO18 ├────► SCK ────────────────┤
   GPIO5 ├────► CS ─────────────────┤
         │                          │
   GPIO2 ├────► 220Ω ──► LED (WiFi) │
   GPIO4 ├────► 220Ω ──► LED (MQTT) │
  GPIO15 ├────► 220Ω ──► LED (SD)   │
         │                          │
  GPIO34 ├────► Battery monitor     │
         │       (via divider)      │
         │                          │
      EN ├────► Reset button ──► GND│
         └──────────────────────────┘
```

---

## Assembly Instructions

### Step 1: Prepare Components
1. Verify all components against BOM
2. Test ESP32 by connecting to USB and uploading blink sketch
3. Format MicroSD card as **FAT32** (not exFAT)
4. Label components with masking tape to avoid confusion

### Step 2: BME280 Sensor
1. If using breakout board with 3.3V regulator, connect VCC to 3.3V
2. If bare module (1.8-3.6V), connect directly to 3.3V
3. Solder 4-pin male header to BME280 if needed
4. Connect: VCC→3.3V, GND→GND, SDA→GPIO21, SCL→GPIO22
5. Add 10µF capacitor near VCC/GND pins

### Step 3: MicroSD Module
1. Verify module is 3.3V compatible (some require level shifters)
2. Connect: VCC→3.3V, GND→GND
3. Connect SPI pins: CS→GPIO5, MOSI→GPIO23, MISO→GPIO19, SCK→GPIO18
4. Add 10µF capacitor near VCC/GND pins
5. Insert formatted MicroSD card

### Step 4: Battery Monitor
1. Solder 100kΩ resistor between Battery+ and GPIO34
2. Solder 10kΩ resistor between GPIO34 and GND
3. **Important:** Measure actual resistor values with multimeter
4. Calculate expected voltage at GPIO34:
   ```
   V_ADC = V_Battery × (10kΩ / 110kΩ)
   For 4.2V LiPo: V_ADC = 0.38V (safe for ESP32's 0-3.3V range)
   ```

### Step 5: Status LEDs
1. Connect anodes (+) to GPIO pins via 220Ω resistors
2. Connect cathodes (-) to GND
3. Test by touching GPIO to 3.3V (LED should light)
4. Color coding:
   - Red (GPIO2): WiFi status
   - Green (GPIO4): MQTT connection
   - Blue (GPIO15): SD card activity

### Step 6: Power Supply
1. **Option A (USB):** Use micro-USB cable for development
2. **Option B (Battery):** 
   - Connect LiPo to VIN pin (with voltage regulator)
   - Or use dedicated 3.3V LDO regulator
3. **Option C (Solar):** Add TP4056 charging module + 6V panel

### Step 7: Final Assembly
1. Mount all components on breadboard for testing
2. Double-check all connections against wiring diagram
3. Verify no shorts between VCC and GND
4. Secure loose wires with zip ties

---

## Firmware Installation

### Prerequisites

**Software:**
- Arduino IDE 2.x or higher
- ESP32 board package v2.0.0+
- USB drivers (CP2102 or CH340 depending on your board)

**Arduino Libraries (install via Library Manager):**
```
- Adafruit Unified Sensor (v1.1.14+)
- Adafruit BME280 Library (v2.2.4+)
- PubSubClient (v2.8.0+) — for MQTT
- NTPClient (v3.2.1+) — for time sync
- ArduinoJson (v7.0.0+) — for JSON serialization
```

### Installation Steps

1. **Install ESP32 Board Package**
   - Open Arduino IDE
   - File → Preferences
   - Additional Board Manager URLs: 
     ```
     https://espressif.github.io/arduino-esp32/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager
   - Search "esp32" → Install "esp32 by Espressif Systems"

2. **Install Libraries**
   - Sketch → Include Library → Manage Libraries
   - Search and install each library listed above
   - Restart Arduino IDE

3. **Open Firmware**
   - File → Open
   - Navigate to: `Sky-guard-ai/edge_ai/esp32/skyguard_bme280.ino`

4. **Configure Settings** (see [Configuration](#configuration) section below)

5. **Select Board**
   - Tools → Board → ESP32 Arduino → **ESP32 Dev Module**
   - Tools → Port → (select your ESP32's COM port)
   - Tools → Upload Speed → 115200

6. **Upload Firmware**
   - Click **Upload** button (→)
   - Wait for "Connecting..." message
   - Press **BOOT** button on ESP32 if upload fails
   - Watch for "Hard resetting via RTS pin..." (success)

7. **Monitor Output**
   - Tools → Serial Monitor
   - Set baud rate to **115200**
   - You should see startup messages

---

## Configuration

### Edit Firmware Before Upload

Open `skyguard_bme280.ino` and update the configuration section:

```cpp
// Station Identity
const char* STATION_ID = "SGA-ESP32-01";  // ← Change to unique ID

// WiFi Configuration
const char* WIFI_SSID = "YourWiFiSSID";       // ← Your WiFi name
const char* WIFI_PASSWORD = "YourWiFiPassword"; // ← Your WiFi password

// MQTT Configuration
const char* MQTT_BROKER = "192.168.1.100";  // ← Gateway IP address
const int MQTT_PORT = 1883;
const char* MQTT_TOPIC = "skyguard/readings";

// HTTP Fallback
const char* HTTP_ENDPOINT = "http://192.168.1.100:3101/api/edge/ingest";

// Sampling Interval
const unsigned long SAMPLE_INTERVAL_MS = 10000;  // 10 seconds (adjust as needed)
```

### Configuration Options

| Parameter | Default | Description | Valid Range |
|-----------|---------|-------------|-------------|
| `STATION_ID` | SGA-ESP32-01 | Unique station identifier | Alphanumeric + hyphens |
| `WIFI_SSID` | — | WiFi network name | — |
| `WIFI_PASSWORD` | — | WiFi password | — |
| `WIFI_TIMEOUT_SEC` | 30 | WiFi connection timeout | 10-60 seconds |
| `MQTT_BROKER` | 192.168.1.100 | Gateway IP or hostname | Valid IP/hostname |
| `MQTT_PORT` | 1883 | MQTT broker port | 1-65535 |
| `MQTT_TOPIC` | skyguard/readings | MQTT publish topic | Valid MQTT topic |
| `MQTT_USER` | (empty) | MQTT username | Leave empty if no auth |
| `MQTT_PASS` | (empty) | MQTT password | Leave empty if no auth |
| `HTTP_ENDPOINT` | (see above) | Fallback HTTP POST URL | Valid URL |
| `SAMPLE_INTERVAL_MS` | 10000 | Sensor read interval (ms) | 5000-300000 (5s-5min) |
| `MAX_OFFLINE_BUFFER` | 500 | Max readings to buffer offline | 10-1000 |
| `WDT_TIMEOUT_SEC` | 60 | Watchdog timer timeout | 30-120 seconds |

### Station Naming Convention

Recommended format: `SGA-<LOCATION>-<NUMBER>`

Examples:
- `SGA-MUM-01` — Mumbai station #1
- `SGA-DEL-02` — Delhi station #2
- `SGA-BLR-05` — Bangalore station #5

---

## Testing & Validation

### Pre-Deployment Tests

#### 1. Serial Monitor Check
```
Expected output:
====================================
Sky Guard AI — ESP32 Weather Station
====================================

[BME280] Initializing sensor... OK
[SD] Initializing card... OK
[SD] Created readings.csv with header
[SD] Resuming from sequence 0
[WiFi] Connecting to MyNetwork... CONNECTED
[WiFi] IP: 192.168.1.150
[WiFi] RSSI: -45 dBm
[MQTT] Connecting to broker... CONNECTED
[NTP] Synchronizing time... OK
[NTP] UTC: 2026-09-26T18:58:17Z

[READY] Station operational

[1] T=31.5°C H=72.3% P=1008.2hPa Bat=4.12V RSSI=-45dBm
[MQTT] Published OK
```

#### 2. SD Card Validation
1. Let station run for 5 minutes
2. Remove MicroSD card (power off first!)
3. Insert into computer
4. Open `readings.csv` — should show header + data rows

**Expected format:**
```csv
sequence,timestamp_utc,temperature_c,humidity_pct,pressure_hpa,battery_v,rssi_dbm,uptime_s,sensor_status
1,2026-09-26T18:58:17.000Z,31.50,72.30,1008.20,4.12,-45,15,ok
2,2026-09-26T18:58:27.000Z,31.48,72.45,1008.18,4.12,-45,25,ok
```

#### 3. MQTT Verification
Use MQTT client (e.g., `mosquitto_sub`) to verify publishing:

```bash
mosquitto_sub -h 192.168.1.100 -t "skyguard/readings" -v
```

**Expected output:**
```json
skyguard/readings {"station_id":"SGA-ESP32-01","sequence":1,"ts":"2026-09-26T18:58:17Z","t":31.5,"h":72.3,"p":1008.2,"battery_v":4.12,"rssi_dbm":-45,"uptime_s":15,"sensor_status":"ok","offline_buffered":false}
```

#### 4. Gateway Integration Test
Check gateway receives data:

```bash
curl http://192.168.1.100:3101/api/edge/latest/SGA-ESP32-01
```

**Expected response:**
```json
{
  "station_id": "SGA-ESP32-01",
  "ts": "2026-09-26T18:58:17Z",
  "t": 31.5,
  "h": 72.3,
  "p": 1008.2,
  "verdict": "NORMAL",
  "score": 0.15
}
```

#### 5. Offline Buffer Test
1. Disconnect WiFi router (or change SSID in firmware to invalid)
2. Let station run for 1 minute (collect 6 readings with 10s interval)
3. Reconnect WiFi
4. Watch Serial Monitor — should show "Flushing 6 buffered readings"
5. Verify all readings arrive at gateway with `"offline_buffered": true`

#### 6. LED Status Verification
| LED | Color | State | Meaning |
|-----|-------|-------|---------|
| WiFi | Red | Solid | WiFi connected |
| WiFi | Red | Off | WiFi disconnected |
| MQTT | Green | Solid | MQTT connected |
| MQTT | Green | Off | MQTT disconnected |
| SD | Blue | Solid | SD card ready |
| SD | Blue | Off | SD card failed/missing |

#### 7. Battery Monitor Test
1. Measure actual battery voltage with multimeter
2. Compare to Serial Monitor output
3. Tolerance: ±0.1V is acceptable
4. If off by >0.2V, recalcrate voltage divider code

---

## Field Deployment

### Site Selection

**Criteria:**
- Open area, minimum 10m from buildings/trees
- Mounting height: 1.5-2m above ground (standard AWS height)
- Avoid heat sources (AC units, exhaust vents)
- Avoid irrigation sprinklers (humidity contamination)
- Clear sky view for temperature accuracy
- Access to WiFi signal (test with phone first)
- Secure from tampering/theft

### Installation Checklist

- [ ] Site survey completed, GPS coordinates recorded
- [ ] WiFi signal strength tested (RSSI > -70 dBm)
- [ ] Enclosure weatherproofing verified
- [ ] Desiccant packs installed
- [ ] BME280 ventilation holes drilled (top of enclosure)
- [ ] Cable glands sealed
- [ ] Station mounted securely (vibration test)
- [ ] Power supply connected (battery or solar)
- [ ] Station ID label affixed (waterproof)
- [ ] Initial readings validated (compare to reference thermometer)
- [ ] Gateway connectivity confirmed
- [ ] Added to station registry (spreadsheet/database)

### Post-Installation
1. Monitor for 24 hours
2. Check SD card has continuous readings
3. Verify no anomalies flagged (unless genuine weather event)
4. Photograph installation for records
5. Update station metadata in system:
   - Exact GPS coordinates (decimal degrees)
   - Elevation (meters ASL)
   - Installation date
   - Responsible operator
   - Maintenance schedule

---

## Troubleshooting

### BME280 Not Found
```
[BME280] Could not find sensor. Check wiring.
```
**Solutions:**
- Verify I²C address (0x76 or 0x77) — try both in code
- Check SDA/SCL connections (GPIO 21/22)
- Test with I²C scanner sketch
- Verify 3.3V power supply
- Try different BME280 breakout board

### SD Card Initialization Failed
```
[SD] No card detected or initialization failed.
```
**Solutions:**
- Reformat card as FAT32 (not exFAT)
- Try different SD card (some are incompatible)
- Check SPI pin connections
- Verify 3.3V logic level (some modules need level shifters)
- Clean SD card contacts
- Reduce SPI clock speed in code

### WiFi Connection Timeout
```
[WiFi] Connecting to MyNetwork... TIMEOUT
```
**Solutions:**
- Verify SSID/password (case-sensitive)
- Check 2.4GHz WiFi (ESP32 doesn't support 5GHz)
- Move closer to router
- Check router allows new devices (MAC filter)
- Restart router
- Use WiFi analyzer app to check channel congestion

### MQTT Connection Failed
```
[MQTT] Connecting to broker... FAILED (state=-2)
```
**Solutions:**
- Verify broker IP address and port
- Check broker is running: `systemctl status mosquitto`
- Test with `mosquitto_pub -h 192.168.1.100 -t "test" -m "hello"`
- Check firewall rules (allow port 1883)
- Verify username/password if authentication enabled
- Check MQTT client ID conflicts

### NTP Sync Failed
```
[NTP] Synchronizing time... FAILED
```
**Solutions:**
- Check internet connectivity
- Try different NTP server: `time.google.com` or `time.windows.com`
- Verify firewall allows UDP port 123
- Use local NTP server if available
- Not critical — station uses millis() timestamps as fallback

### Readings Look Wrong
**Temperature too high:**
- BME280 self-heating (sample less frequently)
- Enclosure in direct sunlight (add radiation shield)
- BME280 near ESP32 (heat transfer — add spacing)

**Humidity too high:**
- Condensation inside enclosure (add desiccant, vent holes)
- BME280 exposed to rain (improve sealing)

**Pressure looks wrong:**
- BME280 reads absolute pressure (not sea-level adjusted)
- Convert to sea-level pressure: `P_sea = P_abs × (1 - 0.0065 × h / 288.15)^(-5.255)`
- Where `h` = elevation in meters

### Battery Drains Too Fast
- Reduce sampling interval (10s → 30s or 60s)
- Implement deep sleep mode (future firmware feature)
- Use larger battery (5000mAh)
- Add solar panel with TP4056 charger
- Check for excessive MQTT reconnections (WiFi instability)

### Station Reboots Randomly
- Watchdog timer triggered (increase `WDT_TIMEOUT_SEC`)
- Brown-out detection (power supply too weak)
- Add larger capacitor (470µF) to VCC/GND
- Use dedicated 3.3V regulator (not USB power)
- Check for loose wiring

---

## Maintenance

### Weekly Checks (First Month)
- [ ] Verify station is online (dashboard shows recent data)
- [ ] Check battery voltage (should be > 3.6V)
- [ ] Download SD card data, verify continuous logging
- [ ] Check for anomalies (review alerts)

### Monthly Maintenance
- [ ] Clean BME280 sensor (soft brush, no liquids)
- [ ] Inspect enclosure seals (replace if cracked)
- [ ] Replace desiccant packs if saturated (blue → pink)
- [ ] Check mounting hardware (tighten bolts)
- [ ] Verify WiFi RSSI (should be > -75 dBm)
- [ ] Backup SD card data to computer
- [ ] Compare readings to nearby reference station

### Quarterly Maintenance
- [ ] Full sensor calibration (compare to reference)
- [ ] Firmware update if available
- [ ] Clean solar panel (if installed)
- [ ] Check battery health (capacity test)
- [ ] Inspect all wiring for corrosion
- [ ] Update station metadata if needed

### Sensor Calibration
**Temperature offset:**
1. Place station next to calibrated thermometer
2. Record both readings for 1 hour
3. Calculate offset: `offset = T_reference - T_BME280`
4. Apply offset in firmware or post-processing

**Humidity calibration:**
1. Salt calibration: Place BME280 + saturated NaCl solution in sealed bag
2. Wait 6 hours (should stabilize at 75% RH at 25°C)
3. Calculate offset: `offset = 75.0 - RH_measured`

**Pressure calibration:**
1. Compare to airport METAR or official station
2. Apply sea-level pressure conversion
3. BME280 is typically accurate to ±1 hPa (no calibration needed)

### Replacement Schedule
| Component | Lifespan | Replacement Indicator |
|-----------|----------|----------------------|
| BME280 sensor | 5+ years | Drift > ±2°C, ±5% RH |
| MicroSD card | 2-3 years | Write errors, corruption |
| LiPo battery | 1-2 years | Won't hold charge, < 3.0V |
| Desiccant | 3-6 months | Color change (blue → pink) |
| Enclosure seals | 1 year | Visible cracks, leaks |

---

## Additional Resources

### Documentation
- [ESP32 Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf)
- [BME280 Datasheet](https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bme280-ds002.pdf)
- [MQTT Protocol Specification](https://mqtt.org/mqtt-specification/)

### Community
- GitHub Issues: [Sky Guard AI Issues](https://github.com/pemmiyashwantrao666-glitch/Sky-guard-ai/issues)
- ESP32 Forum: [ESP32.com](https://www.esp32.com/)

### Support
For hardware questions, create an issue with:
- Serial Monitor output (full log)
- Photos of wiring
- Firmware version
- Hardware model numbers

---

**Guide Version:** 1.0  
**Last Updated:** 2026-09-26  
**Maintainer:** Sky Guard AI Team  
**License:** MIT
