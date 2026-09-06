const DEFAULT_BASE_URL = "http://localhost:5000";

export function getImdApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_IMD_API_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return DEFAULT_BASE_URL;
}

export interface ImdBriefWeather {
  station: string;
  maxTemp?: string;
  minTemp?: string;
  rainfall?: string;
  humidity?: string;
  fetchedAt: string;
}

export interface ImdDetailedWeather extends ImdBriefWeather {
  rainfall24hr?: string;
  humidity1730?: string;
  maxTempDeparture?: string;
  minTempDeparture?: string;
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
}

export interface ImdForecastDay {
  date: string;
  maxTemp?: string;
  minTemp?: string;
  weather: string;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${getImdApiBaseUrl()}${path}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return (Array.isArray(data) && data.length > 0 ? data[0] : data) as T;
  } catch {
    return null;
  }
}

function pick(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === null || value === undefined) return undefined;
  return String(value);
}

export async function fetchImdWeather(stationSlug: string): Promise<ImdBriefWeather | null> {
  const record = await getJson<Record<string, unknown>>(
    `/${encodeURIComponent(stationSlug)}/weather`
  );
  if (!record) return null;
  return {
    station: stationSlug,
    maxTemp: pick(record, "max_temp"),
    minTemp: pick(record, "min_temp"),
    rainfall: pick(record, "total_rainfall"),
    humidity: pick(record, "humidity_0830"),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchImdDetailedWeather(
  stationSlug: string
): Promise<ImdDetailedWeather | null> {
  const record = await getJson<Record<string, unknown>>(
    `/${encodeURIComponent(stationSlug)}/detailed_weather`
  );
  if (!record) return null;
  return {
    station: stationSlug,
    maxTemp: pick(record, "max_temp"),
    minTemp: pick(record, "min_temp"),
    rainfall: pick(record, "total_rainfall"),
    humidity: pick(record, "humidity_0830"),
    rainfall24hr: pick(record, "24hr_rainfall"),
    humidity1730: pick(record, "humidity_1730"),
    maxTempDeparture: pick(record, "max_temp_departure_from_normal"),
    minTempDeparture: pick(record, "min_temp_departure_from_normal"),
    sunrise: pick(record, "sunrise"),
    sunset: pick(record, "sunset"),
    moonrise: pick(record, "moonrise"),
    moonset: pick(record, "moonset"),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchImdForecast(stationSlug: string): Promise<ImdForecastDay[] | null> {
  const data = await getJson<unknown[]>(`/${encodeURIComponent(stationSlug)}/forecast`);
  if (!Array.isArray(data)) return null;
  return data
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        date: pick(record, "date") ?? "",
        maxTemp: pick(record, "max_temp"),
        minTemp: pick(record, "min_temp"),
        weather: pick(record, "weather") ?? "",
      } as ImdForecastDay;
    })
    .filter((d) => d.date !== "");
}