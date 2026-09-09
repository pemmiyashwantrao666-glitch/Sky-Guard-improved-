import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import {
  Search,
  Filter,
  Layers,
  X,
  MapPin,
  Thermometer,
  Droplets,
  Gauge,
  Activity,
  AlertTriangle,
  Wrench,
  Clock,
  ChevronRight,
  Navigation,
  Cloud,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import {
  demoAnomalies,
  demoMaintenanceTasks,
} from "@/lib/mock-data";
import { getStationsWithWeather, type StationWithWeather, getStationHourlyWeather } from "@/lib/station-service";
import { subscribeEdgeStream } from "@/lib/edge-api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const INDIA_BOUNDS = L.latLngBounds([6.0, 67.5], [37.7, 97.5]);

const STATUS_COLORS: Record<string, string> = {
  active: "#3F8062",
  warning: "#D99532",
  offline: "#C85D3A",
  maintenance: "#7067A8",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  warning: "Warning",
  offline: "Offline",
  maintenance: "Maintenance",
};

const REGIONS = ["north", "south", "east", "west", "central", "northeast"];
const SENSOR_TYPES = ["temperature", "humidity", "pressure", "communication"];
const SEVERITY_LEVELS = ["critical", "high", "medium", "low"];
const CONNECTIVITY_LEVELS = ["excellent", "good", "fair", "poor"];

function getMarkerColor(temp: number | null): string {
  if (temp === null) return "#7067A8";
  if (temp < 15) return "#3B82F6";
  if (temp < 25) return "#22C55E";
  if (temp < 35) return "#EAB308";
  return "#EF4444";
}

function createMarkerIcon(temperature: number | null, isSelected: boolean) {
  const color = getMarkerColor(temperature);
  const size = isSelected ? 32 : 24;
  const border = isSelected ? 4 : 3;
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:${border}px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);transition:all 0.2s;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapFlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 8, { duration: 0.8 });
    }
  }, [position, map]);
  return null;
}

export function Network() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedStation, setSelectedStation] = useState<StationWithWeather | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [stationsData, setStationsData] = useState<StationWithWeather[]>([]);
  const [tempReadings, setTempReadings] = useState<{timestamp: string; temperature: number}[]>([]);

  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterRegion, setFilterRegion] = useState<string[]>([]);
  const [filterSensor, setFilterSensor] = useState<string[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string[]>([]);
  const [filterConnectivity, setFilterConnectivity] = useState<string[]>([]);

  const [layerHealth, setLayerHealth] = useState(true);
  const [layerAnomalies, setLayerAnomalies] = useState(false);
  const [layerRainfall, setLayerRainfall] = useState(false);
  const [layerTemperature, setLayerTemperature] = useState(false);
  const [layerBoundaries, setLayerBoundaries] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getStationsWithWeather();
      setStationsData(data);
      setLoading(false);
    }
    load();
    // Live edge overlay: gateway SSE patches edge stations in place.
    const unsub = subscribeEdgeStream((reading) => {
      setStationsData((prev) =>
        prev.map((st) =>
          st.id === reading.station_id
            ? { ...st, temperature: reading.t, humidity: reading.h, pressure: reading.p, status: 'active' as const, lastUpdate: reading.received_at || reading.ts, edge: { verdict: reading.verdict, score: reading.score, rootCause: reading.root_cause, ageSec: 0 } }
            : st
        )
      );
      setSelectedStation((cur) =>
        cur && cur.id === reading.station_id
          ? { ...cur, temperature: reading.t, humidity: reading.h, pressure: reading.p, status: 'active' as const, lastUpdate: reading.received_at || reading.ts, edge: { verdict: reading.verdict, score: reading.score, rootCause: reading.root_cause, ageSec: 0 } }
          : cur
      );
    });
    return () => unsub();
  }, []);

  const filteredStations = useMemo(() => {
    return stationsData.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase());
      const matchesRegion =
        filterRegion.length === 0 || filterRegion.includes(s.region);
      return matchesSearch && matchesRegion;
    });
  }, [stationsData, search, filterRegion]);

  const toggleFilter = useCallback(
    (arr: string[], value: string, setter: (v: string[]) => void) => {
      setter(
        arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      );
    },
    []
  );

  const stationAnomalies = selectedStation
    ? demoAnomalies.filter((a) => a.stationId === selectedStation.id)
    : [];

  const stationMaintenance = selectedStation
    ? demoMaintenanceTasks.filter((m) => m.stationId === selectedStation.id)
    : [];

  useEffect(() => {
    let cancelled = false;
    async function loadReadings() {
      if (!selectedStation) return;
      setTempReadings([]); // clear the previous station's data immediately
      const readings = await getStationHourlyWeather(selectedStation.id, 24);
      if (!cancelled) {
        setTempReadings(
          readings.map((r) => ({ timestamp: r.timestamp, temperature: r.temperature }))
        );
      }
    }
    loadReadings();
    return () => {
      cancelled = true;
    };
  }, [selectedStation]);

  const handleMarkerClick = useCallback((station: StationWithWeather) => {
    setSelectedStation(station);
    setMapCenter([station.latitude, station.longitude]);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedStation(null);
    setMapCenter(null);
  }, []);

  const activeFilterCount =
    filterStatus.length +
    filterRegion.length +
    filterSensor.length +
    filterSeverity.length +
    filterConnectivity.length;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {loading && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-deep-atmo" />
            <p className="text-sm text-graphite">Loading weather data...</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-cloud-grey bg-white px-4 py-3 lg:px-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink-navy">
            Live Network
          </h1>
          <p className="text-sm text-graphite/60">
            Real-time weather station monitoring across India
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
            <Input
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-alert-coral text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant={showLayers ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLayers(!showLayers)}
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Layers</span>
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-cloud-grey bg-white"
          >
            <div className="grid gap-4 p-4 lg:grid-cols-5">
              <FilterGroup
                title="Status"
                options={Object.keys(STATUS_LABELS)}
                labels={STATUS_LABELS}
                selected={filterStatus}
                onToggle={(v) => toggleFilter(filterStatus, v, setFilterStatus)}
              />
              <FilterGroup
                title="Region"
                options={REGIONS}
                labels={Object.fromEntries(REGIONS.map((r) => [r, r.charAt(0).toUpperCase() + r.slice(1)]))}
                selected={filterRegion}
                onToggle={(v) => toggleFilter(filterRegion, v, setFilterRegion)}
              />
              <FilterGroup
                title="Sensor Type"
                options={SENSOR_TYPES}
                labels={Object.fromEntries(SENSOR_TYPES.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1)]))}
                selected={filterSensor}
                onToggle={(v) => toggleFilter(filterSensor, v, setFilterSensor)}
              />
              <FilterGroup
                title="Severity"
                options={SEVERITY_LEVELS}
                labels={Object.fromEntries(SEVERITY_LEVELS.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1)]))}
                selected={filterSeverity}
                onToggle={(v) => toggleFilter(filterSeverity, v, setFilterSeverity)}
              />
              <FilterGroup
                title="Connectivity"
                options={CONNECTIVITY_LEVELS}
                labels={Object.fromEntries(CONNECTIVITY_LEVELS.map((c) => [c, c.charAt(0).toUpperCase() + c.slice(1)]))}
                selected={filterConnectivity}
                onToggle={(v) => toggleFilter(filterConnectivity, v, setFilterConnectivity)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLayers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-cloud-grey bg-white"
          >
            <div className="flex flex-wrap gap-3 p-4">
              <LayerToggle
                label="Station Health"
                active={layerHealth}
                onToggle={() => setLayerHealth(!layerHealth)}
              />
              <LayerToggle
                label="Recent Anomalies"
                active={layerAnomalies}
                onToggle={() => setLayerAnomalies(!layerAnomalies)}
              />
              <LayerToggle
                label="Rainfall Intensity"
                active={layerRainfall}
                onToggle={() => setLayerRainfall(!layerRainfall)}
              />
              <LayerToggle
                label="Temperature Gradient"
                active={layerTemperature}
                onToggle={() => setLayerTemperature(!layerTemperature)}
              />
              <LayerToggle
                label="Admin Boundaries"
                active={layerBoundaries}
                onToggle={() => setLayerBoundaries(!layerBoundaries)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            maxBounds={INDIA_BOUNDS}
            maxBoundsViscosity={0.8}
            minZoom={4}
            maxZoom={18}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='Tiles &copy; Esri, Sources: Esri, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            />
            {layerBoundaries && (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                opacity={0.15}
              />
            )}
            <MapFlyTo position={mapCenter} />
            {filteredStations.map((station) => (
              <Marker
                key={station.id}
                position={[station.latitude, station.longitude]}
                icon={createMarkerIcon(
                  station.temperature,
                  selectedStation?.id === station.id
                )}
                eventHandlers={{
                  click: () => handleMarkerClick(station),
                }}
              />
            ))}
          </MapContainer>

          <div className="pointer-events-none absolute bottom-4 left-4 z-[1000]">
            <Card className="pointer-events-auto p-3">
              <p className="mb-2 text-xs font-medium text-graphite/70">Status Legend</p>
              <div className="flex flex-col gap-1.5">
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-graphite/70 capitalize">
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="pointer-events-none absolute bottom-4 right-4 z-[1000]">
            <Card className="pointer-events-auto px-3 py-2">
              <p className="text-xs text-graphite/60">
                <span className="font-semibold text-ink-navy">
                  {filteredStations.length}
                </span>{" "}
                stations visible
              </p>
            </Card>
          </div>
        </div>

        <AnimatePresence>
          {selectedStation && (
            <>
              <motion.div
                className="fixed inset-0 z-[1001] bg-black/20 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseDrawer}
              />
              <motion.div
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-x-0 bottom-0 z-[1002] max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl lg:static lg:inset-auto lg:z-auto lg:max-h-none lg:w-[420px] lg:rounded-none lg:border-l lg:border-cloud-grey"
              >
                <StationDrawer
                  station={selectedStation}
                  anomalies={stationAnomalies}
                  maintenance={stationMaintenance}
                  readings={tempReadings}
                  onClose={handleCloseDrawer}
                  onOpenProfile={() =>
                    navigate(`/stations/${selectedStation.id}`)
                  }
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  options,
  labels,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  labels: Record<string, string>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-graphite/70">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              selected.includes(opt)
                ? "border-deep-atmo bg-deep-atmo text-white"
                : "border-cloud-grey bg-white text-graphite/70 hover:bg-cloud-grey/50"
            )}
          >
            {labels[opt] || opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function LayerToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "border-healthy-green bg-healthy-green/10 text-healthy-green"
          : "border-cloud-grey bg-white text-graphite/60 hover:bg-cloud-grey/30"
      )}
    >
      <div
        className={cn(
          "h-3 w-3 rounded-sm border",
          active ? "border-healthy-green bg-healthy-green" : "border-cloud-grey"
        )}
      />
      {label}
    </button>
  );
}

function StationDrawer({
  station,
  anomalies: stationAnoms,
  maintenance: stationMaint,
  readings,
  onClose,
  onOpenProfile,
}: {
  station: StationWithWeather;
  anomalies: typeof import("@/lib/mock-data").demoAnomalies;
  maintenance: typeof import("@/lib/mock-data").demoMaintenanceTasks;
  readings: { timestamp: string; temperature: number }[];
  onClose: () => void;
  onOpenProfile: () => void;
}) {
  const statusColor = STATUS_COLORS[station.status];
  // StationWithWeather carries no health score — derive it from the live status.
  const healthScore = station.status === "active" ? 92 : 18;

  return (
    <div className="p-5 lg:p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-xs font-medium uppercase tracking-wide text-graphite/50">
              {station.id}
            </span>
          </div>
          <h2 className="mt-1 font-serif text-xl font-bold text-ink-navy">
            {station.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-graphite/50 transition-colors hover:bg-cloud-grey/50 hover:text-graphite"
          aria-label="Close drawer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge
          variant={
            station.status === "active" ? "success" : "destructive"
          }
          className="capitalize"
        >
          {station.status}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {station.region}
        </Badge>
        {station.source === 'edge' && (<Badge variant='outline'>{station.edge ? ('EDGE ' + station.edge.verdict) : 'EDGE'}</Badge>)}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <InfoItem
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Location"
          value={`${station.state}, ${station.district}`}
        />
        <InfoItem
          icon={<Navigation className="h-3.5 w-3.5" />}
          label="Coordinates"
          value={`${station.latitude.toFixed(3)}, ${station.longitude.toFixed(3)}`}
        />
        <InfoItem
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Elevation"
          value={`${station.elevation}m`}
        />
        <InfoItem
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Last Sync"
          value={timeAgo(station.lastUpdate)}
        />
      </div>

      <Card className="mb-5 border-cloud-grey p-4">
        <p className="mb-3 text-xs font-medium text-graphite/70">
          Current Readings
        </p>
        <div className="grid grid-cols-3 gap-3">
          <ReadingItem
            icon={<Thermometer className="h-4 w-4 text-alert-coral" />}
            label="Temperature"
            value={`${station.temperature}°C`}
          />
          <ReadingItem
            icon={<Droplets className="h-4 w-4 text-sky-blue" />}
            label="Humidity"
            value={`${station.humidity}%`}
          />
          <ReadingItem
            icon={<Gauge className="h-4 w-4 text-deep-atmo" />}
            label="Pressure"
            value={`${station.pressure} hPa`}
          />
        </div>
      </Card>

      <Card className="mb-5 border-cloud-grey p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium text-graphite/70">Health Score</p>
          <span
            className={cn(
              "text-sm font-bold",
              healthScore >= 80
                ? "text-healthy-green"
                : healthScore >= 50
                  ? "text-signal-amber"
                  : "text-alert-coral"
            )}
          >
            {healthScore}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-cloud-grey">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              healthScore >= 80
                ? "bg-healthy-green"
                : healthScore >= 50
                  ? "bg-signal-amber"
                  : "bg-alert-coral"
            )}
            style={{ width: `${healthScore}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-graphite/40">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </Card>

      <Card className="mb-5 border-cloud-grey p-4">
        <p className="mb-3 text-xs font-medium text-graphite/70">
          Temperature Trend (24h)
        </p>
        {readings.length > 0 ? (
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={readings}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6BAED6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6BAED6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="timestamp" hide />
                <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: "1px solid #E8EDF1",
                  }}
                  formatter={(value) => {
                    const numericValue = Array.isArray(value) ? value[0] : value;
                    return [`${numericValue ?? 0}°C`, "Temp"];
                  }}
                  labelFormatter={(label) => {
                    const match = /T(\d{2}:\d{2})/.exec(String(label));
                    if (match) return match[1];
                    return new Date(String(label)).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  stroke="#6BAED6"
                  strokeWidth={2}
                  fill="url(#tempGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-cloud-grey text-xs text-graphite/40">
            Live 24h trend unavailable for this station
          </div>
        )}
      </Card>

      {stationAnoms.length > 0 && (
        <Card className="mb-5 border-cloud-grey p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-signal-amber" />
            <p className="text-xs font-medium text-graphite/70">
              Recent Anomalies ({stationAnoms.length})
            </p>
          </div>
          <div className="space-y-2">
            {stationAnoms.slice(0, 3).map((anom) => (
              <div
                key={anom.id}
                className="rounded-lg border border-cloud-grey/70 p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-graphite">
                    {anom.detectionType}
                  </span>
                  <Badge
                    variant={
                      anom.severity === "critical"
                        ? "destructive"
                        : anom.severity === "high"
                          ? "warning"
                          : "secondary"
                    }
                    className="text-[10px] capitalize"
                  >
                    {anom.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-graphite/60">
                  {anom.observedValue}
                </p>
                <p className="mt-0.5 text-[10px] text-graphite/40">
                  {timeAgo(anom.detectedAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {stationMaint.length > 0 && (
        <Card className="mb-5 border-cloud-grey p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-violet" />
            <p className="text-xs font-medium text-graphite/70">
              Maintenance Tasks
            </p>
          </div>
          <div className="space-y-2">
            {stationMaint.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-cloud-grey/70 p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-graphite">
                    {task.title}
                  </span>
                  <Badge
                    variant={
                      task.priority === "high"
                        ? "destructive"
                        : task.priority === "medium"
                          ? "warning"
                          : "secondary"
                    }
                    className="text-[10px] capitalize"
                  >
                    {task.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] text-graphite/50">
                  Assigned: {task.assignedTo}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button onClick={onOpenProfile} className="w-full">
        <Cloud className="h-4 w-4" />
        Open station profile
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-graphite/50">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-0.5 text-xs font-medium text-graphite">{value}</p>
    </div>
  );
}

function ReadingItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1 text-sm font-semibold text-ink-navy">{value}</p>
      <p className="text-[10px] text-graphite/50">{label}</p>
    </div>
  );
}
