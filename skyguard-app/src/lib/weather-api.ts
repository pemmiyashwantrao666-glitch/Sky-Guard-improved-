const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";

export interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  weatherCode: number;
  timestamp: string;
}

export interface HourlyWeatherData {
  time: string[];
  temperature: number[];
  humidity: number[];
  pressure: number[];
  windSpeed: number[];
  precipitation: number[];
}

export interface ForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitationSum: number;
  weatherCode: number;
  precipitationProbabilityMax: number;
}

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  country: string;
  admin1: string;
  country_code: string;
}

function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

const CURRENT_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "precipitation",
  "weather_code",
].join(",");

interface OpenMeteoCurrentResponse {
  current?: Record<string, unknown>;
}

function parseCurrentWeather(entry: OpenMeteoCurrentResponse | null | undefined): WeatherData | null {
  if (!entry?.current) return null;
  return {
    temperature: (entry.current.temperature_2m as number) ?? 0,
    humidity: (entry.current.relative_humidity_2m as number) ?? 0,
    pressure: (entry.current.pressure_msl as number) ?? 0,
    windSpeed: (entry.current.wind_speed_10m as number) ?? 0,
    windDirection: (entry.current.wind_direction_10m as number) ?? 0,
    precipitation: (entry.current.precipitation as number) ?? 0,
    weatherCode: (entry.current.weather_code as number) ?? 0,
    timestamp: (entry.current.time as string) ?? new Date().toISOString(),
  };
}

export async function fetchCurrentWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  try {
    const url = buildUrl(OPEN_METEO_BASE, {
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      current: CURRENT_VARS,
      timezone: "Asia/Kolkata",
    });

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();

    return parseCurrentWeather(data);
  } catch {
    return null;
  }
}

/**
 * Bulk variant of `fetchCurrentWeather`: Open-Meteo accepts comma-separated
 * coordinate lists and returns one response object per coordinate, so a whole
 * chunk of stations costs a single HTTP request. Results are aligned 1:1 with
 * the input array (`null` for coordinates that could not be resolved).
 */
export async function fetchCurrentWeatherBulk(
  coordinates: { latitude: number; longitude: number }[]
): Promise<(WeatherData | null)[]> {
  if (coordinates.length === 0) return [];

  try {
    const url = buildUrl(OPEN_METEO_BASE, {
      latitude: coordinates.map((c) => c.latitude.toFixed(4)).join(","),
      longitude: coordinates.map((c) => c.longitude.toFixed(4)).join(","),
      current: CURRENT_VARS,
      timezone: "Asia/Kolkata",
    });

    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return coordinates.map(() => null);
    const data = await res.json();

    // Multi-coordinate requests return an array; a single coordinate returns a
    // plain object — normalize to an array aligned with the input.
    const entries: OpenMeteoCurrentResponse[] = Array.isArray(data) ? data : [data];
    return coordinates.map((_, i) => parseCurrentWeather(entries[i]));
  } catch {
    return coordinates.map(() => null);
  }
}

export async function fetchHourlyWeather(
  latitude: number,
  longitude: number,
  pastHours: number = 24,
  forecastHours: number = 1
): Promise<HourlyWeatherData | null> {
  try {
    const url = buildUrl(OPEN_METEO_BASE, {
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      hourly: [
        "temperature_2m",
        "relative_humidity_2m",
        "pressure_msl",
        "wind_speed_10m",
        "precipitation",
      ].join(","),
      past_hours: pastHours.toString(),
      forecast_hours: forecastHours.toString(),
      timezone: "Asia/Kolkata",
    });

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.hourly) return null;

    return {
      time: data.hourly.time ?? [],
      temperature: data.hourly.temperature_2m ?? [],
      humidity: data.hourly.relative_humidity_2m ?? [],
      pressure: data.hourly.pressure_msl ?? [],
      windSpeed: data.hourly.wind_speed_10m ?? [],
      precipitation: data.hourly.precipitation ?? [],
    };
  } catch {
    return null;
  }
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<ForecastDay[]> {
  try {
    const url = buildUrl(OPEN_METEO_BASE, {
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      daily: [
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "weather_code",
        "precipitation_probability_max",
      ].join(","),
      timezone: "Asia/Kolkata",
      forecast_days: days.toString(),
    });

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();

    if (!data.daily?.time) return [];

    return data.daily.time.map((date: string, i: number) => ({
      date,
      maxTemp: data.daily.temperature_2m_max[i] ?? 0,
      minTemp: data.daily.temperature_2m_min[i] ?? 0,
      precipitationSum: data.daily.precipitation_sum[i] ?? 0,
      weatherCode: data.daily.weather_code[i] ?? 0,
      precipitationProbabilityMax: data.daily.precipitation_probability_max[i] ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function searchLocations(
  query: string,
  count: number = 5
): Promise<GeocodingResult[]> {
  try {
    const url = buildUrl(OPEN_METEO_GEOCODING, {
      name: query,
      count: count.toString(),
      language: "en",
      format: "json",
    });

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();

    return data.results ?? [];
  } catch {
    return [];
  }
}

export function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] ?? "Unknown";
}

export function getWeatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}
