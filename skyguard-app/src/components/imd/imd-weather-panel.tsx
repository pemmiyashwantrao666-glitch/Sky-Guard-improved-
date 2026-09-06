import { useEffect, useMemo, useState } from "react";
import {
  CloudSun,
  Droplets,
  Gauge,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sunrise,
  Sunset,
  Thermometer,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  imdStations,
  IMD_STATION_COUNT,
  type ImdStation,
} from "@/lib/imd-stations";
import {
  fetchImdWeather,
  fetchImdDetailedWeather,
  fetchImdForecast,
  getImdApiBaseUrl,
  type ImdBriefWeather,
  type ImdDetailedWeather,
  type ImdForecastDay,
} from "@/lib/imd-api";

function Metric({ label, value, icon: Icon }: { label: string; value?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-graphite/50">{label}</p>
        <p className="truncate text-sm font-semibold text-ink-navy">{value ?? "—"}</p>
      </div>
    </div>
  );
}

export function ImdWeatherPanel() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ImdStation | null>(null);
  const [weather, setWeather] = useState<ImdBriefWeather | null>(null);
  const [detailed, setDetailed] = useState<ImdDetailedWeather | null>(null);
  const [forecast, setForecast] = useState<ImdForecastDay[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  const apiBase = getImdApiBaseUrl();

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return imdStations
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.includes(q) ||
          s.state.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [query]);

  const load = async (station: ImdStation) => {
    setSelected(station);
    setLoading(true);
    setApiError(false);
    const [w, d, f] = await Promise.all([
      fetchImdWeather(station.slug),
      fetchImdDetailedWeather(station.slug),
      fetchImdForecast(station.slug),
    ]);
    if (!w && !d && !f) setApiError(true);
    setWeather(w);
    setDetailed(d);
    setForecast(f);
    setLoading(false);
  };

  useEffect(() => {
    const first = imdStations.find((s) => s.state === "Delhi") ?? imdStations[0];
    if (first && !selected) load(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const station = selected ?? imdStations[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-deep-atmo text-white">
            <CloudSun className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-navy">IMD Weather</p>
            <p className="text-xs text-graphite/60">
              {IMD_STATION_COUNT.toLocaleString("en-IN")} stations · India Meteorological Department
            </p>
          </div>
        </div>
        <Badge
          variant={apiError ? "destructive" : loading ? "secondary" : "success"}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : apiError ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <CloudSun className="h-3 w-3" />
          )}
          {loading ? "Fetching…" : apiError ? "API offline" : "Live data"}
        </Badge>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search IMD station by name or state..."
            aria-label="Search IMD weather station"
            className="pl-9"
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-cloud-grey bg-white py-1 shadow-lg">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      load(s);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-sky-50/60"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-navy">{s.name}</span>
                      <span className="block truncate text-xs text-graphite/50">{s.state}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {selected && (
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-graphite/50">{station.slug}</p>
              <p className="text-lg font-semibold text-ink-navy">{station.name}</p>
              <p className="mt-0.5 text-xs text-graphite/60">
                {station.district}, {station.state} · {station.latitude.toFixed(2)},{" "}
                {station.longitude.toFixed(2)}
                {station.approximate ? " (approx.)" : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(station)}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {apiError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Could not reach the IMD API at{" "}
              <code className="rounded bg-red-100 px-1 py-0.5 text-xs">{apiBase}</code>. Start the
              IndianWeatherAPI Flask service locally, or set{" "}
              <code className="rounded bg-red-100 px-1 py-0.5 text-xs">VITE_IMD_API_URL</code> to your
              deployed endpoint.
            </div>
          )}

          {!apiError && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Metric label="Max temp" value={weather?.maxTemp ?? "—"} icon={Thermometer} />
                <Metric label="Min temp" value={weather?.minTemp ?? "—"} icon={Thermometer} />
                <Metric label="Rainfall" value={weather?.rainfall ?? "—"} icon={Droplets} />
                <Metric label="Humidity (08:30)" value={weather?.humidity ?? "—"} icon={Gauge} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Metric label="24h rainfall" value={detailed?.rainfall24hr ?? "—"} icon={Droplets} />
                <Metric label="Humidity (17:30)" value={detailed?.humidity1730 ?? "—"} icon={Gauge} />
                <Metric label="Sunrise" value={detailed?.sunrise ?? "—"} icon={Sunrise} />
                <Metric label="Sunset" value={detailed?.sunset ?? "—"} icon={Sunset} />
              </div>

              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite/50">
                  7-day forecast
                </p>
                {forecast && forecast.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    {forecast.map((day, i) => (
                      <div
                        key={`${day.date}-${i}`}
                        className="rounded-xl border border-cloud-grey/70 bg-slate-50/60 p-3"
                      >
                        <p className="text-xs font-semibold text-ink-navy">{day.date}</p>
                        <p className="mt-1 text-sm">
                          <span className="font-semibold text-signal-amber">{day.maxTemp ?? "—"}°</span>
                          <span className="text-graphite/50"> / {day.minTemp ?? "—"}°</span>
                        </p>
                        <p className="mt-1 text-xs leading-snug text-graphite/70">{day.weather || "—"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-graphite/50">
                    {loading ? "Loading forecast…" : "Forecast not available for this station."}
                  </p>
                )}
              </div>

              <p className="mt-5 text-[11px] text-graphite/40">
                Data source: IMD via IndianWeatherAPI · last synced{" "}
                {weather?.fetchedAt ? new Date(weather.fetchedAt).toLocaleTimeString("en-IN") : "—"}
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}