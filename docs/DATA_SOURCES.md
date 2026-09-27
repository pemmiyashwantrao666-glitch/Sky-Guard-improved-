# Sky Guard AI — Data Sources Guide

**Training Data Acquisition for AWS Anomaly Detection**  
**Version:** 1.0  
**Last Updated:** 2026-09-26

---

## Table of Contents

1. [Overview](#overview)
2. [Primary Data Sources](#primary-data-sources)
3. [NOAA ISD (Integrated Surface Database)](#noaa-isd-integrated-surface-database)
4. [IMD AWS (India Meteorological Department)](#imd-aws-india-meteorological-department)
5. [ERA5 Reanalysis (Optional)](#era5-reanalysis-optional)
6. [ESP32 Local Logs](#esp32-local-logs)
7. [Common Data Schema](#common-data-schema)
8. [Data Quality Validation](#data-quality-validation)
9. [Storage Organization](#storage-organization)
10. [No API Dependency Principle](#no-api-dependency-principle)

---

## Overview

Sky Guard AI **does not depend on live weather APIs** for model training or validation. All training data comes from:

1. **Downloaded archives** — NOAA ISD, IMD AWS (historical files)
2. **Local ESP32 logs** — CSV files from SD cards
3. **ERA5 reanalysis** — NetCDF files (for spatial validation only, not training)
4. **Simulated faults** — Injected anomalies for evaluation

This approach ensures:
- **Reproducibility** — Same dataset, same results
- **Offline capability** — Works without internet
- **No API limits** — No rate limiting or quotas
- **Privacy** — No data sent to third parties

---

## Primary Data Sources

### Data Source Summary

| Source | Format | Coverage | Variables | Update Frequency | Cost |
|--------|--------|----------|-----------|------------------|------|
| NOAA ISD | Fixed-width text (.gz) | Global, 1901-present | T, P, RH, Wind, Visibility | Daily | Free |
| IMD AWS | CSV | India only, 2010-present | T, P, RH, Wind, Rainfall | Hourly (on request) | Free |
| ERA5 | NetCDF (GRIB) | Global grid, 1940-present | All variables, 0.25° | Monthly | Free |
| ESP32 | CSV | Local stations only | T, RH, P, Battery, RSSI | Real-time | Hardware cost |

### Data Volume Estimates

**NOAA ISD:**
- Single station, 1 year: ~500KB compressed, ~5MB uncompressed
- 100 stations, 10 years: ~500MB compressed, ~5GB uncompressed

**IMD AWS:**
- Single station, 1 year: ~10MB CSV
- 100 stations, 5 years: ~5GB

**ERA5:**
- Global hourly, 1 month, single variable: ~5GB
- India region (60-100°E, 5-40°N), 1 year, 3 variables: ~15GB

---

## NOAA ISD (Integrated Surface Database)

### Overview

**NOAA Integrated Surface Database (ISD)** is the world's largest collection of hourly and synoptic surface weather observations.

- **Coverage:** 35,000+ stations globally (1901-present)
- **Resolution:** Hourly (most stations), some sub-hourly
- **Latency:** ~1 day (updated daily)
- **Format:** Fixed-width ASCII text, gzip compressed
- **License:** Public domain (U.S. government data)

### Download Instructions

#### 1. Find Stations

**Station List:**
```bash
# Download station metadata (all stations, all years)
wget https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt

# Or via HTTPS
curl -O https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt
```

**File format:** Fixed-width columns
```
USAF   WBAN  STATION NAME                  CTRY ST CALL  LAT      LON       ELEV(M) BEGIN    END
007018 99999 WXPOD 7018                     AF      +00.000  +000.000  +7018.0 20110309 20130730
007026 99999 WXPOD 7026                     AF      +00.000  +000.000  +7026.0 20120713 20170822
007070 99999 WXPOD 7070                     AF      +00.000  +000.000  +7070.0 20150925 20150925
```

**Filter stations** (example: India only):
```bash
# Extract Indian stations (CTRY = IN)
grep " IN " isd-history.txt > india_stations.txt

# Example stations in Mumbai area
grep -E "MUMBAI|BOMBAY" isd-history.txt
# 430030 99999 MUMBAI/SANTACRUZ            IN      +19.117 +072.850 +0011.0 19510101 20261231
```

#### 2. Download Station Data

**FTP structure:**
```
ftp://ftp.ncei.noaa.gov/pub/data/noaa/
  ├── 2024/
  │   ├── 430030-99999-2024.gz
  │   ├── 430470-99999-2024.gz
  │   └── ...
  ├── 2023/
  │   └── ...
  └── isd-format-document.pdf
```

**Download single station, single year:**
```bash
# Mumbai Santacruz, 2024
USAF="430030"
WBAN="99999"
YEAR="2024"

wget ftp://ftp.ncei.noaa.gov/pub/data/noaa/${YEAR}/${USAF}-${WBAN}-${YEAR}.gz

# Or via HTTPS
curl -O https://www.ncei.noaa.gov/pub/data/noaa/${YEAR}/${USAF}-${WBAN}-${YEAR}.gz
```

**Bulk download (multiple years):**
```bash
#!/bin/bash
USAF="430030"
WBAN="99999"

for YEAR in {2020..2024}; do
  echo "Downloading $YEAR..."
  wget -q ftp://ftp.ncei.noaa.gov/pub/data/noaa/${YEAR}/${USAF}-${WBAN}-${YEAR}.gz
done

echo "Download complete. Extracting..."
gunzip *.gz
```

#### 3. Parse ISD Format

**File format:** Fixed-width fields (see `isd-format-document.pdf`)

**Key fields:**
```
Positions  Field
---------  -----
0-3        USAF station ID
5-9        WBAN station ID
11-14      Year
15-16      Month
17-18      Day
19-20      Hour
21-22      Minute
...
88-92      Temperature (scaled by 10, e.g., 0287 = 28.7°C)
93         Temperature quality code
...
```

**Python parser** (see Phase 4: `scripts/ingest_noaa_isd.py`)

**Quick test:**
```bash
# Extract first 5 records
gunzip -c 430030-99999-2024.gz | head -5
```

**Sample record:**
```
0070-99999202409260000...+99999+99999FM-15+0287+1...
```

### NOAA ISD Data Dictionary

| Variable | Field Positions | Scale | Missing Value | Unit |
|----------|----------------|-------|---------------|------|
| Year | 15-18 | 1 | — | YYYY |
| Month | 19-20 | 1 | — | MM |
| Day | 21-22 | 1 | — | DD |
| Hour | 23-24 | 1 | — | HH |
| Temperature | 88-92 | ÷10 | +9999 | °C |
| Dewpoint | 94-98 | ÷10 | +9999 | °C |
| Sea Level Pressure | 100-104 | ÷10 | 99999 | hPa |
| Wind Speed | 66-69 | ÷10 | 9999 | m/s |
| Wind Direction | 61-63 | 1 | 999 | degrees |

### Quality Flags

Temperature quality codes (position 93):
- `1` = Passed all quality checks
- `2` = Passed gross limits check
- `3` = Passed climate check
- `5` = Failed quality check
- `9` = Missing

**Filter for quality:**
```python
if temp != '+9999' and quality_code in ['1', '2', '3']:
    # Use this reading
```

---

## IMD AWS (India Meteorological Department)

### Overview

**India Meteorological Department (IMD)** operates ~700 Automatic Weather Stations across India.

- **Coverage:** India only (all states/UTs)
- **Resolution:** 10-minute, hourly, daily
- **Variables:** Temperature, humidity, pressure, rainfall, wind
- **License:** Government of India Open Data (CC BY 4.0)

### Data Access

**Option 1: IMD Website (Manual Download)**

1. Visit: https://mausam.imd.gov.in/
2. Navigate to: Data → AWS Data
3. Select: Date range, state, district
4. Download CSV

**Limitations:**
- Manual download only (no bulk API)
- Date range limited to 1 month per download
- Requires CAPTCHA/login for large requests

**Option 2: Data.gov.in Portal**

1. Visit: https://data.gov.in/
2. Search: "AWS weather data IMD"
3. Download available datasets (usually 1-2 years old)

**Option 3: Request Bulk Data**

**Email:** aws@imd.gov.in  
**Request template:**

```
Subject: Request for AWS Historical Data (Research/Education)

Dear Sir/Madam,

I am working on a project titled "Sky Guard AI: AWS Anomaly Detection System" 
for Smart India Hackathon 2026 (Problem Statement 73).

I request access to AWS data for the following:
- Location: [State/District/Station name]
- Date range: [Start date] to [End date]
- Variables: Temperature, Humidity, Pressure, Rainfall, Wind
- Purpose: Research and education (non-commercial)

The data will be used to train an anomaly detection system for weather station 
health monitoring. No data will be redistributed or used commercially.

Please let me know the procedure and any forms required.

Thank you,
[Your name]
[Institution]
[Contact]
```

**Typical response time:** 1-2 weeks

### IMD AWS CSV Format

**Example structure:**
```csv
Station_ID,Station_Name,District,State,Datetime,Temperature_C,Humidity_Pct,Pressure_hPa,Rainfall_mm,Wind_Speed_kmh,Wind_Direction_deg
IN-MH-MUM-01,Mumbai Colaba,Mumbai,Maharashtra,2024-09-26 19:00:00,31.5,72.3,1008.2,0.0,12.5,270
IN-MH-MUM-02,Mumbai Santacruz,Mumbai,Maharashtra,2024-09-26 19:00:00,32.1,68.9,1007.8,0.0,15.2,285
```

**Notes:**
- Datetime in IST (UTC+5:30) — convert to UTC
- Missing values: `-999`, `NA`, or empty string
- Quality flags: Usually absent (assume good quality)

### Coordinate Lookup

IMD station coordinates are not always in CSV. Use:

**IMD Station List:**
```bash
# Download from IMD website or use cached list
curl -O https://mausam.imd.gov.in/imd_latest/contents/aws_station_list.pdf
# (Manual extraction required)
```

**Fallback: OpenStreetMap Nominatim**
```bash
# Geocode station name
curl "https://nominatim.openstreetmap.org/search?q=Mumbai+Colaba&format=json&limit=1"
```

---

## ERA5 Reanalysis (Optional)

### Overview

**ERA5** is the fifth generation ECMWF atmospheric reanalysis (1940-present).

- **Resolution:** 0.25° × 0.25° (~31km at equator), hourly
- **Variables:** 100+ (temperature, pressure, humidity, wind, radiation, etc.)
- **Use case:** Spatial validation only (NOT for training)
- **License:** Copernicus C3S (free for non-commercial)

### Why ERA5 for Validation Only?

From architectural requirements:

> "Do not depend on a weather API for model training. Use downloaded AWS files, 
> locally logged ESP32 data, and archived datasets as the primary data sources."

**ERA5 usage in Sky Guard AI:**
- ✅ Spatial consistency validation (compare station vs gridded value)
- ✅ Fill missing neighbor station data (emergency fallback)
- ❌ NOT used for training temporal/spatial baselines
- ❌ NOT used to generate synthetic training data

**Rationale:** ERA5 is model-generated (not observations), so training on it would 
be circular reasoning. Stations should learn from real observations only.

### Download ERA5

**Option 1: CDS API (Climate Data Store)**

1. Register: https://cds.climate.copernicus.eu/
2. Install CDS API:
```bash
pip install cdsapi
```

3. Configure credentials:
```bash
cat > ~/.cdsapirc << EOF
url: https://cds.climate.copernicus.eu/api/v2
key: YOUR_UID:YOUR_API_KEY
EOF
```

4. Download data:
```python
import cdsapi

c = cdsapi.Client()

c.retrieve(
    'reanalysis-era5-single-levels',
    {
        'product_type': 'reanalysis',
        'variable': [
            '2m_temperature',
            '2m_dewpoint_temperature',
            'surface_pressure'
        ],
        'year': '2024',
        'month': '09',
        'day': ['01', '02', '03'],  # Repeat for all days
        'time': [
            '00:00', '01:00', '02:00', '03:00',
            '04:00', '05:00', '06:00', '07:00',
            '08:00', '09:00', '10:00', '11:00',
            '12:00', '13:00', '14:00', '15:00',
            '16:00', '17:00', '18:00', '19:00',
            '20:00', '21:00', '22:00', '23:00'
        ],
        'area': [40, 60, 5, 100],  # North, West, South, East (India bounding box)
        'format': 'netcdf'
    },
    'era5_india_2024_09.nc'
)
```

**Option 2: Google Earth Engine (Faster)**

ERA5 is available on GEE with no API key required (for small requests).

```python
import ee
ee.Initialize()

era5 = ee.ImageCollection('ECMWF/ERA5/DAILY')
temp = era5.select('mean_2m_air_temperature').filterDate('2024-09-01', '2024-09-30')
```

### Extract ERA5 at Station Locations

See Phase 4: `scripts/ingest_era5.py`

---

## ESP32 Local Logs

### SD Card CSV Format

**File:** `readings.csv` (auto-created by firmware)

**Structure:**
```csv
sequence,timestamp_utc,temperature_c,humidity_pct,pressure_hpa,battery_v,rssi_dbm,uptime_s,sensor_status
1,2026-09-26T19:00:00.000Z,31.50,72.30,1008.20,4.12,-45,15,ok
2,2026-09-26T19:00:10.000Z,31.48,72.45,1008.18,4.12,-45,25,ok
3,2026-09-26T19:00:20.000Z,31.52,72.28,1008.19,4.11,-46,35,ok
```

### Data Collection Workflow

#### 1. Field Deployment
- ESP32 logs continuously to SD card
- 10-second interval (default) → 8,640 readings/day
- 32GB SD card → ~500 days buffer (at 10s interval)

#### 2. Data Retrieval Options

**Option A: WiFi Transmission (Preferred)**
- Automatic MQTT/HTTP upload
- Real-time to gateway
- Offline buffer auto-syncs when reconnected

**Option B: Manual SD Card Download (Offline Sites)**
- Visit site weekly/monthly
- Swap SD card
- Process on laptop
- Upload results to central system

**Option C: SSH/FTP (For Advanced Setups)**
- ESP32 with SSH server (ESP-IDF)
- Remote file download via WiFi

#### 3. Data Processing

```bash
# Copy from SD card
cp /media/sdcard/readings.csv data/raw/esp32/SGA-MUM-01_2024-09.csv

# Batch quality control
python anomaly_engine.py --csv data/raw/esp32/SGA-MUM-01_2024-09.csv

# Output: data/processed/SGA-MUM-01_2024-09_labeled.csv
```

### Sequence Number Tracking

**Purpose:** Detect missing data (communication gaps)

**Algorithm:**
```python
def check_sequence_gaps(csv_file):
    df = pd.read_csv(csv_file)
    
    expected = range(df['sequence'].min(), df['sequence'].max() + 1)
    actual = set(df['sequence'])
    missing = set(expected) - actual
    
    if missing:
        print(f"WARNING: {len(missing)} missing sequences")
        print(f"Gaps: {sorted(missing)[:10]}...")  # Show first 10
        
    return len(missing)
```

**Gap interpretation:**
- Gap 1-5 readings: Likely WiFi reconnection
- Gap 6-100 readings: Temporary outage (1-15 min)
- Gap >100: Extended outage or SD card issue

---

## Common Data Schema

### Unified Schema for All Sources

To enable cross-source training and validation, all data is converted to a common schema:

**Parquet format:** `data/processed/station_hourly.parquet`

**Schema:**
```python
{
    "station_id": "str",           # Standardized: SGA-XXX-NN or NOAA-USAF-WBAN
    "source": "str",               # NOAA | IMD | ESP32 | ERA5
    "timestamp_utc": "datetime64", # Always UTC
    "lat": "float32",              # Decimal degrees
    "lon": "float32",
    "elevation_m": "float32",
    
    # Primary variables
    "temperature_c": "float32",
    "humidity_pct": "float32",     # 0-100
    "pressure_hpa": "float32",     # Sea-level corrected if possible
    
    # Optional variables
    "wind_speed_ms": "float32",    # m/s (null if not available)
    "wind_direction_deg": "float32",
    "rainfall_mm": "float32",
    "visibility_m": "float32",
    
    # Quality flags
    "quality_temp": "str",         # GOOD | SUSPECT | BAD | MISSING
    "quality_humidity": "str",
    "quality_pressure": "str",
    
    # Metadata
    "is_synthetic": "bool",        # True if fault-injected
    "anomaly_label": "str",        # NULL | SPIKE | FROZEN | DRIFT | ...
}
```

### Conversion Example

**NOAA ISD → Common Schema:**
```python
def noaa_to_common(isd_record):
    return {
        "station_id": f"NOAA-{isd_record['usaf']}-{isd_record['wban']}",
        "source": "NOAA",
        "timestamp_utc": datetime.strptime(isd_record['datetime'], "%Y%m%d%H%M"),
        "lat": isd_record['latitude'],
        "lon": isd_record['longitude'],
        "elevation_m": isd_record['elevation'],
        "temperature_c": isd_record['temp'] / 10.0 if isd_record['temp'] != 9999 else None,
        "humidity_pct": calculate_rh(isd_record['temp'], isd_record['dewpoint']),
        "pressure_hpa": isd_record['slp'] / 10.0 if isd_record['slp'] != 99999 else None,
        "quality_temp": map_quality_code(isd_record['temp_quality']),
    }
```

---

## Data Quality Validation

### Automated QC Checks

**Before ingestion, validate:**

1. **Timestamp validity**
   - Not in future (>5 min ahead)
   - Not too old (>10 years ago)
   - Monotonically increasing (within station)

2. **Physical ranges (extended)**
   - Temperature: -90°C to +70°C (record extremes)
   - Humidity: 0-100%
   - Pressure: 800-1100 hPa (absolute min/max at surface)

3. **Duplicate detection**
   - Same station + timestamp = keep latest
   - Sequence number conflicts (ESP32) = flag

4. **Missing value handling**
   - NOAA: `+9999`, `99999`, `999`
   - IMD: `-999`, `NA`, empty
   - Standardize to `NULL` in Parquet

5. **Coordinate validation**
   - Lat: -90 to +90
   - Lon: -180 to +180
   - Elevation: -500 to +9000m (Dead Sea to Everest)

### Quality Flag Assignment

```python
def assign_quality_flag(value, sensor_type):
    if value is None:
        return "MISSING"
    
    # Physical limits
    limits = {
        "temperature": (-90, 70),
        "humidity": (0, 100),
        "pressure": (800, 1100)
    }
    
    min_val, max_val = limits.get(sensor_type, (-1e9, 1e9))
    
    if not (min_val <= value <= max_val):
        return "BAD"
    
    # Suspect ranges (unusual but possible)
    suspect_ranges = {
        "temperature": (-50, -40, 50, 60),  # Below -40 or above 50 = suspect
        "humidity": (0, 5, 95, 100),        # Below 5% or above 95% = suspect
        "pressure": (950, 970, 1030, 1050)
    }
    
    if sensor_type in suspect_ranges:
        low1, low2, high1, high2 = suspect_ranges[sensor_type]
        if (low1 <= value < low2) or (high1 < value <= high2):
            return "SUSPECT"
    
    return "GOOD"
```

---

## Storage Organization

### Directory Structure

```
data/
├── raw/                           # Original downloaded files
│   ├── noaa_isd/
│   │   ├── 430030-99999-2024.gz
│   │   ├── 430470-99999-2024.gz
│   │   └── ...
│   ├── imd_aws/
│   │   ├── maharashtra_2024_01.csv
│   │   ├── maharashtra_2024_02.csv
│   │   └── ...
│   ├── era5/
│   │   ├── era5_india_2024_01.nc
│   │   └── ...
│   └── esp32/
│       ├── SGA-MUM-01_2024-09-01.csv
│       ├── SGA-MUM-01_2024-09-15.csv
│       └── ...
│
├── processed/                     # Converted to common schema
│   ├── station_hourly.parquet     # All stations, hourly aggregation
│   ├── station_10min.parquet      # Higher resolution (optional)
│   └── station_features.parquet   # Derived features (rolling stats)
│
├── labels/                        # Fault injection labels
│   ├── anomaly_labels.parquet     # Ground truth for evaluation
│   └── fault_scenarios.json       # Injection metadata
│
├── metadata/
│   ├── stations.csv               # Station registry
│   │   # Columns: station_id, name, source, lat, lon, elevation_m,
│   │   #          installation_date, last_calibration, status
│   ├── sensor_config.json         # Hardware specs per station
│   └── download_manifest.csv      # Data provenance
│       # Columns: source, file, download_date, sha256_hash, url
│
└── README.md                      # Data directory documentation
```

### Download Manifest

**Purpose:** Reproducibility and provenance tracking

**Format:** `data/metadata/download_manifest.csv`

```csv
source,file,download_date,sha256_hash,url,notes
NOAA,430030-99999-2024.gz,2026-09-26,a3f5d...,ftp://ftp.ncei.noaa.gov/...,Mumbai Santacruz 2024
IMD,maharashtra_2024_01.csv,2026-09-20,7b2c1...,manual_download,Requested via email
ERA5,era5_india_2024_01.nc,2026-09-25,d9e3a...,CDS API,India bbox 40/60/5/100
ESP32,SGA-MUM-01_2024-09-01.csv,2026-09-01,f4a7b...,local_sd_card,Sequence 1-8640
```

**Generate hash:**
```bash
sha256sum data/raw/noaa_isd/430030-99999-2024.gz >> download_manifest.csv
```

---

## No API Dependency Principle

### Why Avoid Live APIs?

From project requirements:

> **"Do not depend on a weather API for model training."**

**Reasons:**

1. **Reproducibility**
   - API data changes over time (corrections, reanalysis)
   - Downloaded files = immutable reference

2. **Offline capability**
   - Field sites may have no internet
   - Batch processing on laptop without API access

3. **No rate limits**
   - Download once, process many times
   - No 1000 requests/day quotas

4. **Privacy**
   - No telemetry sent to third-party servers
   - Sensitive station locations stay local

5. **Cost**
   - Free public datasets
   - No premium API subscriptions

### Acceptable API Usage

**✅ Allowed:**
- One-time bulk download (NOAA FTP, CDS API for ERA5)
- Geocoding station names (OpenStreetMap Nominatim, cached)
- NTP time sync (ESP32 firmware)

**❌ Not Allowed:**
- Real-time weather API for training data (OpenWeatherMap, WeatherAPI, etc.)
- Continuous polling of commercial APIs
- Storing API keys in model training pipeline

### Alternative: Mock API for Demo

If your demo needs simulated live data:

```python
# gateway/mock_api.py
def mock_weather_api(lat, lon):
    """
    Simulate live API response using local data + noise
    For demo purposes only
    """
    base = get_nearest_station_data(lat, lon)  # From local Parquet
    noise = np.random.normal(0, 0.5, 3)        # Small random variation
    
    return {
        "temperature": base['temperature_c'] + noise[0],
        "humidity": base['humidity_pct'] + noise[1],
        "pressure": base['pressure_hpa'] + noise[2]
    }
```

---

## Quick Start Commands

### Download Sample Dataset

```bash
# Create directories
mkdir -p data/{raw,processed,labels,metadata}/{noaa_isd,imd_aws,era5,esp32}

# Download NOAA ISD station list
cd data/metadata
wget https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt

# Download Mumbai station (2024)
cd data/raw/noaa_isd
wget ftp://ftp.ncei.noaa.gov/pub/data/noaa/2024/430030-99999-2024.gz
gunzip 430030-99999-2024.gz

# Parse and convert to common schema
cd ../../../
python scripts/ingest_noaa_isd.py --input data/raw/noaa_isd/430030-99999-2024 \
                                   --output data/processed/station_hourly.parquet
```

### Validate Dataset

```bash
# Check for missing values, duplicates, quality flags
python scripts/validate_data.py --input data/processed/station_hourly.parquet

# Output:
# Total records: 8,760
# Stations: 1 (NOAA-430030-99999)
# Date range: 2024-01-01 to 2024-12-31
# Missing temperature: 127 (1.4%)
# Missing humidity: 0 (0.0%)
# Missing pressure: 89 (1.0%)
# Quality GOOD: 8,544 (97.5%)
# Quality SUSPECT: 89 (1.0%)
# Quality BAD: 0 (0.0%)
# Quality MISSING: 127 (1.4%)
```

### Train Anomaly Detector

```bash
# Use downloaded data for training
python anomaly_engine.py --csv data/processed/station_hourly.parquet \
                          --output results/anomaly_report.json

# Inject faults for evaluation
python scripts/inject_faults.py --input data/processed/station_hourly.parquet \
                                 --output data/labels/anomaly_labels.parquet \
                                 --faults spike,frozen,drift

# Evaluate with ground truth
python anomaly_engine.py --csv data/labels/anomaly_labels.parquet \
                          --labels data/labels/anomaly_labels.parquet \
                          --metrics precision,recall,f1
```

---

## Appendix: Data Source Contacts

### NOAA NCEI
- **Website:** https://www.ncei.noaa.gov/
- **FTP:** ftp://ftp.ncei.noaa.gov/pub/data/noaa/
- **Email:** ncei.orders@noaa.gov
- **Support:** https://www.ncei.noaa.gov/support

### India Meteorological Department
- **Website:** https://mausam.imd.gov.in/
- **Data portal:** https://dsp.imdpune.gov.in/ (registration required)
- **Email:** aws@imd.gov.in
- **Phone:** +91-11-24631913

### ECMWF Copernicus (ERA5)
- **Website:** https://cds.climate.copernicus.eu/
- **Documentation:** https://confluence.ecmwf.int/display/CKB/ERA5
- **Support:** https://support.ecmwf.int/
- **Forum:** https://forum.ecmwf.int/

### Data.gov.in
- **Portal:** https://data.gov.in/
- **Search:** AWS, IMD, weather
- **License:** Most datasets are CC BY 4.0

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-26T19:30:00Z  
**Maintainer:** Sky Guard AI Team  
**License:** MIT
