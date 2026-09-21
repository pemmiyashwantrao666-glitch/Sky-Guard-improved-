import { imdStations, type ImdStation } from "./imd-stations";
import { demoAnomalies } from "./mock-data";
import {
  fetchCurrentWeather,
  fetchCurrentWeatherBulk,
  fetchHourlyWeather,
  fetchForecast,
  type WeatherData,
  type ForecastDay,
} from "./weather-api";
import {
  edgeReadingAgeSec,
  fetchEdgeHistory, fetchEdgeLatest,
  isEdgeReadingFresh,
  type EdgeReading,
} from "./edge-api";

/** Readings fresher than this count as live edge data, not fallback. */
const EDGE_FRESH_SEC = 90;

function toEdgeStationWithWeather(base: StationBase, r: EdgeReading): StationWithWeather {
  return {
    ...base,
    temperature: r.t,
    humidity: r.h,
    pressure: r.p,
    // Edge nodes carry no anemometer — wind comes from the model fallback.
    windSpeed: null,
    weatherCode: null,
    // Edge verdict drives the status colour: anything not NORMAL flags warning.
    status: r.verdict === "NORMAL" ? "active" : "warning",
    lastUpdate: r.received_at || r.ts,
    edge: {
      verdict: r.verdict,
      score: r.score,
      rootCause: r.root_cause,
      ageSec: edgeReadingAgeSec(r),
    },
  };
}

export interface StationBase {
  id: string;
  name: string;
  state: string;
  district: string;
  region: "north" | "south" | "east" | "west" | "central" | "northeast";
  latitude: number;
  longitude: number;
  elevation?: number;
  source: "imd" | "custom" | "edge";
}

export interface StationWithWeather extends StationBase {
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  /** Operational state shown on the map: active | warning | offline | maintenance. */
  status: "active" | "warning" | "offline" | "maintenance";
  lastUpdate: string;
  /** Present when the values came from a physical ESP32 edge node. */
  edge?: {
    verdict: "NORMAL" | "WARNING" | "ANOMALY";
    score: number;
    rootCause: string;
    ageSec: number;
  };
}

export interface Reading {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
}

const CUSTOM_STATIONS: StationBase[] = [
  { id: "EDGE-PUNE-01", name: "Pune Edge Node 01", state: "Maharashtra", district: "Pune", region: "west", latitude: 18.5204, longitude: 73.8567, elevation: 560, source: "edge" },
  { id: "MH-042", name: "Pune Observatory", state: "Maharashtra", district: "Pune", region: "west", latitude: 18.5204, longitude: 73.8567, elevation: 560, source: "custom" },
  { id: "RJ-018", name: "Jaipur Central", state: "Rajasthan", district: "Jaipur", region: "north", latitude: 26.9124, longitude: 75.7873, elevation: 431, source: "custom" },
  { id: "DL-007", name: "Delhi Ridge", state: "Delhi", district: "New Delhi", region: "north", latitude: 28.6139, longitude: 77.209, elevation: 216, source: "custom" },
  { id: "KA-031", name: "Bengaluru Tech", state: "Karnataka", district: "Bengaluru", region: "south", latitude: 12.9716, longitude: 77.5946, elevation: 920, source: "custom" },
  { id: "TN-025", name: "Chennai Coastal", state: "Tamil Nadu", district: "Chennai", region: "south", latitude: 13.0827, longitude: 80.2707, elevation: 6, source: "custom" },
  { id: "WB-014", name: "Kolkata Metro", state: "West Bengal", district: "Kolkata", region: "east", latitude: 22.5726, longitude: 88.3639, elevation: 9, source: "custom" },
  { id: "GJ-019", name: "Ahmedabad Industrial", state: "Gujarat", district: "Ahmedabad", region: "west", latitude: 23.0225, longitude: 72.5714, elevation: 53, source: "custom" },
  { id: "UP-033", name: "Lucknow Plains", state: "Uttar Pradesh", district: "Lucknow", region: "north", latitude: 26.8467, longitude: 80.9462, elevation: 123, source: "custom" },
  { id: "KL-022", name: "Thiruvananthapuram Coast", state: "Kerala", district: "Thiruvananthapuram", region: "south", latitude: 8.5241, longitude: 76.9366, elevation: 3, source: "custom" },
  { id: "AS-008", name: "Guwahati Hills", state: "Assam", district: "Kamrup", region: "northeast", latitude: 26.1445, longitude: 91.7362, elevation: 55, source: "custom" },
  { id: "MP-029", name: "Bhopal Lake", state: "Madhya Pradesh", district: "Bhopal", region: "central", latitude: 23.2599, longitude: 77.4126, elevation: 527, source: "custom" },
  { id: "HR-011", name: "Chandigarh Sector", state: "Haryana", district: "Chandigarh", region: "north", latitude: 30.7333, longitude: 76.7794, elevation: 321, source: "custom" },
  { id: "PB-015", name: "Amritsar Golden", state: "Punjab", district: "Amritsar", region: "north", latitude: 31.634, longitude: 74.8723, elevation: 234, source: "custom" },
  { id: "AP-036", name: "Visakhapatnam Port", state: "Andhra Pradesh", district: "Visakhapatnam", region: "south", latitude: 17.6868, longitude: 83.2185, elevation: 7, source: "custom" },
  { id: "OD-017", name: "Bhubaneswar Temple", state: "Odisha", district: "Khordha", region: "east", latitude: 20.2961, longitude: 85.8245, elevation: 45, source: "custom" },
  { id: "JH-024", name: "Ranchi Plateau", state: "Jharkhand", district: "Ranchi", region: "east", latitude: 23.3441, longitude: 85.3096, elevation: 651, source: "custom" },
  { id: "UK-009", name: "Dehradun Valley", state: "Uttarakhand", district: "Dehradun", region: "north", latitude: 30.3165, longitude: 78.0322, elevation: 450, source: "custom" },
  { id: "HP-010", name: "Shimla Hills", state: "Himachal Pradesh", district: "Shimla", region: "north", latitude: 31.1048, longitude: 77.1734, elevation: 2205, source: "custom" },
  { id: "GA-005", name: "Panaji Beach", state: "Goa", district: "North Goa", region: "west", latitude: 15.4909, longitude: 73.8278, elevation: 7, source: "custom" },
  { id: "TR-004", name: "Agartala Hills", state: "Tripura", district: "West Tripura", region: "northeast", latitude: 23.8315, longitude: 91.2868, elevation: 17, source: "custom" },
  { id: "CG-012", name: "Raipur Plains", state: "Chhattisgarh", district: "Raipur", region: "central", latitude: 21.2514, longitude: 81.6296, elevation: 298, source: "custom" },
];

function imdToStationBase(imd: ImdStation): StationBase {
  return {
    id: imd.id,
    name: imd.name,
    state: imd.state,
    district: imd.district,
    region: imd.region,
    latitude: imd.latitude,
    longitude: imd.longitude,
    source: "imd",
  };
}

let allStationsBase: StationBase[] | null = null;

export function getAllStationsBase(): StationBase[] {
  if (!allStationsBase) {
    const imdBases = imdStations.map(imdToStationBase);
    allStationsBase = [...CUSTOM_STATIONS, ...imdBases];
  }
  return allStationsBase;
}

export function getStationBaseById(id: string): StationBase | undefined {
  return getAllStationsBase().find((s) => s.id === id);
}

const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedWeather(key: string): WeatherData | null {
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedWeather(key: string, data: WeatherData): void {
  weatherCache.set(key, { data, timestamp: Date.now() });
}

function coordKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function isFiniteCoord(c: { latitude: number; longitude: number }): boolean {
  return (
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude) &&
    Math.abs(c.latitude) <= 90 &&
    Math.abs(c.longitude) <= 180 &&
    !(c.latitude === 0 && c.longitude === 0)
  );
}

function toStationWithWeather(
  station: StationBase,
  weather: WeatherData
): StationWithWeather {
  return {
    ...station,
    temperature: weather.temperature,
    humidity: weather.humidity,
    pressure: weather.pressure,
    windSpeed: weather.windSpeed,
    weatherCode: weather.weatherCode,
    status: "active",
    lastUpdate: weather.timestamp,
  };
}

function toOfflineStation(station: StationBase): StationWithWeather {
  return {
    ...station,
    temperature: null,
    humidity: null,
    pressure: null,
    windSpeed: null,
    weatherCode: null,
    status: "offline",
    lastUpdate: "",
  };
}

/**
 * Demo operational overrides so the live map exercises every station state.
 * "offline" stations report no telemetry at all; "maintenance" stations keep
 * streaming readings but are flagged until their open demo tasks are cleared.
 */
const STATION_STATUS_OVERRIDES: Record<string, "offline" | "maintenance"> = {
  "AS-008": "offline", // Guwahati Hills — communication link down (AL-002)
  "TR-004": "offline", // Agartala Hills — telemetry outage
  "JH-024": "offline", // Ranchi Plateau — telemetry outage
  "HR-011": "maintenance", // Chandigarh Sector — recalibration visit (MT-001)
  "WB-014": "maintenance", // Kolkata Metro — barometer replacement (MT-004)
  "OD-017": "maintenance", // Bhubaneswar Temple — hygrometer service (MT-006)
};

const WARNING_SEVERITIES = new Set(["critical", "high"]);
const OPEN_ANOMALY_STATUSES = new Set(["new", "investigating", "confirmed"]);

/** Stations with an open high/critical demo anomaly count as "warning". */
function hasOpenWarningAnomaly(stationId: string): boolean {
  return demoAnomalies.some(
    (a) =>
      a.stationId === stationId &&
      WARNING_SEVERITIES.has(a.severity) &&
      OPEN_ANOMALY_STATUSES.has(a.status)
  );
}

/** Layer the demo operational state on top of the fetched weather snapshot. */
function applyStatusOverride(station: StationWithWeather): StationWithWeather {
  const override = STATION_STATUS_OVERRIDES[station.id];
  if (override === "offline") {
    return toOfflineStation({ ...station });
  }
  if (override === "maintenance") {
    return { ...station, status: "maintenance" };
  }
  if (station.status === "active" && hasOpenWarningAnomaly(station.id)) {
    return { ...station, status: "warning" };
  }
  return station;
}

// Open-Meteo accepts ~100 comma-separated coordinates per request while staying
// well under URL-length limits, so the whole network costs ~12 requests instead
// of one request per station (which trips the API rate limit and floods the
// console with 429 warnings).
const BULK_CHUNK_SIZE = 100;

export async function getStationsWithWeather(): Promise<StationWithWeather[]> {
  const stations = getAllStationsBase();
  const results: StationWithWeather[] = new Array(stations.length);
  const uncached: { index: number; cacheKey: string; station: StationBase }[] = [];

  // Edge nodes resolve from the gateway first; only fall back to
  // Open-Meteo when the gateway has no fresh reading (< EDGE_FRESH_SEC).
  const edgeJobs: Promise<void>[] = [];
  stations.forEach((station, index) => {
    const cacheKey = coordKey(station.latitude, station.longitude);
    const cached = getCachedWeather(cacheKey);

    if (cached) {
      results[index] = toStationWithWeather(station, cached);
    } else if (station.source === "edge") {
      edgeJobs.push(
        (async () => {
          try {
            const reading = await fetchEdgeLatest(station.id);
            if (reading && isEdgeReadingFresh(reading, EDGE_FRESH_SEC)) {
              results[index] = toEdgeStationWithWeather(station, reading);
              return;
            }
          } catch {
            /* gateway unreachable - Open-Meteo fallback below */
          }
          results[index] = toOfflineStation(station);
          uncached.push({ index, cacheKey, station });
        })()
      );
    } else {
      results[index] = toOfflineStation(station);
      uncached.push({ index, cacheKey, station });
    }
  });
  await Promise.all(edgeJobs);

  if (uncached.length > 0) {
    // Deduplicate coordinates — several stations can share a rounded coordinate.
    const coordIndex = new Map<string, { latitude: number; longitude: number }>();
    for (const u of uncached) {
      if (isFiniteCoord(u.station) && !coordIndex.has(u.cacheKey)) {
        coordIndex.set(u.cacheKey, {
          latitude: u.station.latitude,
          longitude: u.station.longitude,
        });
      }
    }
    const uniqueCoords = [...coordIndex.entries()];

    for (let b = 0; b < uniqueCoords.length; b += BULK_CHUNK_SIZE) {
      const chunk = uniqueCoords.slice(b, b + BULK_CHUNK_SIZE);
      const coords = chunk.map(([, c]) => c);
      let weathers = await fetchCurrentWeatherBulk(coords);

      // A single invalid coordinate can fail the whole chunk — fall back to
      // per-coordinate requests so one bad entry doesn't blank the batch.
      if (weathers.every((w) => w === null)) {
        weathers = await Promise.all(
          coords.map((c) => fetchCurrentWeather(c.latitude, c.longitude))
        );
      }

      weathers.forEach((weather, i) => {
        if (weather) setCachedWeather(chunk[i][0], weather);
      });
    }

    // Fill results from the freshly populated cache.
    for (const { index, cacheKey, station } of uncached) {
      const weather = getCachedWeather(cacheKey);
      if (weather) {
        results[index] = toStationWithWeather(station, weather);
      }
    }
  }

  // Apply demo operational state (offline / maintenance / warning) so the map
  // shows all four station states instead of only active/offline.
  return results.map((s) => (s ? applyStatusOverride(s) : s));
}

export async function getStationWithWeather(
  id: string
): Promise<StationWithWeather | null> {
  const base = getStationBaseById(id);
  if (!base) return null;
  if (base.source === "edge") {
    try {
      const reading = await fetchEdgeLatest(base.id);
      if (reading && isEdgeReadingFresh(reading, EDGE_FRESH_SEC)) {
        return applyStatusOverride(toEdgeStationWithWeather(base, reading));
      }
    } catch {
      /* gateway unreachable - Open-Meteo fallback below */
    }
  }

  const cacheKey = `${base.latitude.toFixed(4)},${base.longitude.toFixed(4)}`;
  const cached = getCachedWeather(cacheKey);
  if (cached) {
    return applyStatusOverride({
      ...base,
      temperature: cached.temperature,
      humidity: cached.humidity,
      pressure: cached.pressure,
      windSpeed: cached.windSpeed,
      weatherCode: cached.weatherCode,
      status: "active",
      lastUpdate: cached.timestamp,
    });
  }

  const weather = await fetchCurrentWeather(base.latitude, base.longitude);
  if (weather) {
    setCachedWeather(cacheKey, weather);
    return applyStatusOverride({
      ...base,
      temperature: weather.temperature,
      humidity: weather.humidity,
      pressure: weather.pressure,
      windSpeed: weather.windSpeed,
      weatherCode: weather.weatherCode,
      status: "active",
      lastUpdate: weather.timestamp,
    });
  }

  return applyStatusOverride({
    ...base,
    temperature: null,
    humidity: null,
    pressure: null,
    windSpeed: null,
    weatherCode: null,
    status: "offline",
    lastUpdate: "",
  });
}

export async function getStationHourlyWeather(
  id: string,
  pastHours: number = 24
): Promise<Reading[]> {
  const base = getStationBaseById(id);
  if (!base) return [];
  if (base.source === "edge") {
    try {
      const hist = await fetchEdgeHistory(base.id, 120);
      if (hist.length > 0) {
        const tail = hist.slice(-pastHours);
        return tail.map((e) => ({
          timestamp: e.ts,
          temperature: e.t,
          humidity: e.h,
          pressure: e.p,
          windSpeed: 0,
        }));
      }
    } catch {
      /* gateway unreachable - Open-Meteo fallback below */
    }
  }
  const data = await fetchHourlyWeather(    base.latitude,
    base.longitude,
    pastHours,
    1
  );
  if (!data) return [];

  return data.time.map((time, i) => ({
    timestamp: time,
    temperature: data.temperature[i] ?? 0,
    humidity: data.humidity[i] ?? 0,
    pressure: data.pressure[i] ?? 0,
    windSpeed: data.windSpeed[i] ?? 0,
  }));
}

export async function getStationForecast(
  id: string,
  days: number = 7
): Promise<ForecastDay[]> {
  const base = getStationBaseById(id);
  if (!base) return [];
  return fetchForecast(base.latitude, base.longitude, days);
}
