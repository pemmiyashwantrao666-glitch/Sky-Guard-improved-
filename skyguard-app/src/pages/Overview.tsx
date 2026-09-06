import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ElementType } from "react";
import {
  Radio,
  AlertTriangle,
  Activity,
  Wifi,
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  CheckCircle2,
  X,
  ShieldAlert,
  Zap,
  Cpu,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { stations, alerts, anomalies, generateReadings } from "@/lib/mock-data";
import { streamService } from "@/lib/stream";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MAP_W = 580;
const MAP_H = 340;
const LAT_MIN = 8, LAT_MAX = 37;
const LNG_MIN = 68, LNG_MAX = 97;
function latLngToXY(lat: number, lng: number) {
  return { x: ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W, y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H };
}
const INDIA_PATH = "M0 0";

// Sparkline data
const tempSparkData = generateReadings("t", 12).map((d) => ({ v: d.temperature }));
const humidSparkData = generateReadings("h", 12).map((d) => ({ v: d.humidity }));
const rainSparkData = generateReadings("r", 12).map((d) => ({ v: Math.abs(d.pressure - 1010) * 0.3 }));
const windSparkData = generateReadings("w", 12).map((d) => ({ v: d.windSpeed }));

// Cache marker icons per status — recreating L.divIcon objects on every render
// forces Leaflet to rebuild marker DOM nodes, which was a major source of lag.
const overviewMarkerIconCache: Record<string, L.DivIcon> = {};
function createOverviewMarkerIcon(status: string) {
  const cached = overviewMarkerIconCache[status];
  if (cached) return cached;
  const color = statusColor[status] ?? "#94a3b8";
  const icon = L.divIcon({
    className: "overview-marker",
    html: `<span style="display:block;width:14px;height:14px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 1px 5px rgba(15,23,42,.45)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  overviewMarkerIconCache[status] = icon;
  return icon;
}

const statusColor: Record<string, string> = {
  active: "#22c55e",
  warning: "#f59e0b",
  offline: "#94a3b8",
  maintenance: "#ef4444",
};

// Donut chart helper
function DonutChart({ value, size = 120 }: { value: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={12} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#22c55e" strokeWidth={12}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1e293b">{value}%</text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">Overall Health</text>
    </svg>
  );
}

function KPICard({
  label, value, sub, subColor, icon: Icon, iconBg, iconColor, trend,
}: {
  label: string; value: string | number; sub: string; subColor: string;
  icon: ElementType; iconBg: string; iconColor: string; trend?: "up" | "down";
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between gap-4"
    >
      <div>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-bold text-slate-800 leading-none">{value}</p>
        <p className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${subColor}`}>
          {trend === "up" && <TrendingUp className="h-3 w-3" />}
          {trend === "down" && <TrendingDown className="h-3 w-3" />}
          {sub}
        </p>
      </div>
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}>
        <Icon className={`h-7 w-7 ${iconColor}`} />
      </div>
    </motion.div>
  );
}

// ── Live clock (isolated so time ticks don't re-render the whole page) ───────
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);
  return <>{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</>;
}

// ── Live badge (self-contained stream subscription) ──────────────────────────
function LiveStreamBadge() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const unsub = streamService.subscribe(() => setLive(true));
    streamService.start();
    return unsub;
  }, []);
  if (!live) return null;
  return (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow">
      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
      LIVE
    </div>
  );
}

// ── Anomaly Detection Panel ──────────────────────────────────────────────────
function AnomalyDetectionPanel({ onDismiss }: { onDismiss: () => void }) {
  const [liveData, setLiveData] = useState<any>(null);

  useEffect(() => {
    const unsub = streamService.subscribe((data) => setLiveData(data));
    streamService.start();
    return unsub;
  }, []);

  const unresolved = anomalies
    .filter((a) => a.status !== "resolved" && a.status !== "dismissed")
    .sort((a, b) => b.confidence - a.confidence);
  const tick = liveData ? Math.floor(new Date(liveData.timestamp).getTime() / 3000) : 0;
  const baseTarget = unresolved[tick % unresolved.length];

  if (!baseTarget) return null;

  const liveValue = liveData?.[baseTarget.parameter];
  const target = {
    ...baseTarget,
    stationName: liveData?.stationName ?? baseTarget.stationName,
    state: liveData?.state ?? baseTarget.state,
    observedValue: liveValue !== undefined
      ? `${liveValue}${baseTarget.parameter === "temperature" ? "°C" : baseTarget.parameter === "pressure" ? " hPa" : "%"}`
      : baseTarget.observedValue,
  };

  const isCritical = target.severity === "critical";
  const isHigh = target.severity === "high";

  const liveConfidence = liveData
    ? Math.max(70, Math.min(99, target.confidence + Math.round(Math.sin(tick) * 3)))
    : target.confidence;
  const score = (liveConfidence / 100).toFixed(2);

  const evidence = target.shapFeatures.slice(0, 5).map((f) => ({
    label: f.feature,
    level:
      f.contribution > 0.25 ? "Very High" :
      f.contribution > 0.15 ? "High" :
      f.contribution > 0.07 ? "Medium" : "Normal",
    positive: f.contribution > 0.08,
  }));

  const sensorHealth = liveConfidence >= 90 ? "DEGRADED" : liveConfidence >= 70 ? "WARNING" : "NOMINAL";

  const probableCause =
    target.detectionType === "Point spike" ? "Sensor Fault / Electrical Noise" :
    target.detectionType === "Frozen value" ? "Sensor Freeze / Data Corruption" :
    target.detectionType === "Sensor drift" ? "Sensor Calibration Drift" :
    target.detectionType === "Communication gap" ? "Communication / Gateway Failure" :
    target.detectionType === "Multivariate mismatch" ? "Environmental Inconsistency" :
    "Sensor Fault / Data Corruption";

  const action =
    target.detectionType === "Communication gap" ? "Check gateway connection / restart modem" :
    target.detectionType === "Frozen value" ? "Power-cycle sensor / check firmware" :
    target.detectionType === "Sensor drift" ? "Recalibrate sensor against reference" :
    `Inspect ${target.parameter} sensor / verify communication`;

  const bgClass = isCritical
    ? "bg-gradient-to-r from-red-950/95 to-red-900/90 border-red-500/60"
    : isHigh
    ? "bg-gradient-to-r from-amber-950/95 to-amber-900/90 border-amber-500/60"
    : "bg-gradient-to-r from-blue-950/95 to-blue-900/90 border-blue-500/60";

  const sevBadge = isCritical
    ? "bg-red-500 text-white"
    : isHigh
    ? "bg-amber-500 text-white"
    : "bg-blue-500 text-white";

  const healthColor = sensorHealth === "DEGRADED" ? "text-red-400" : sensorHealth === "WARNING" ? "text-amber-400" : "text-green-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      className={`relative rounded-2xl border-2 p-5 shadow-xl ${bgClass}`}
    >
      {/* Pulsing glow for critical */}
      {isCritical && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl animate-pulse" style={{ boxShadow: "0 0 32px rgba(239,68,68,0.35)" }} />
      )}

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
        aria-label="Dismiss anomaly panel"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
        {/* Left: Header + scores */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20">
              <ShieldAlert className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">STATUS</p>
              <p className="text-sm font-bold text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                ANOMALY DETECTED
              </p>
              {liveData && <p className="mt-1 text-[10px] text-white/40">Live stream updated {new Date(liveData.timestamp).toLocaleTimeString()}</p>}
            </div>
          </div>

          <div className="rounded-xl bg-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Station</span>
              <span className="text-xs font-semibold text-white">{target.stationName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Anomaly Score</span>
              <span className="text-sm font-black text-white">{score}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Confidence</span>
              <span className="text-sm font-bold text-emerald-300">{liveConfidence}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Severity</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${sevBadge}`}>
                {target.severity.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Parameter</span>
              <span className="text-xs font-semibold text-white capitalize">{target.parameter}</span>
            </div>
          </div>

          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">Probable Cause</p>
            <p className="text-sm font-medium text-amber-200">{probableCause}</p>
          </div>
        </div>

        {/* Middle: Evidence */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Evidence</p>
          <div className="space-y-2">
            {evidence.map((e, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
                {e.positive ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                )}
                <span className="flex-1 text-xs text-white/70 truncate">{e.label}</span>
                <span className={`text-[10px] font-semibold ${
                  e.level === "Very High" ? "text-red-400" :
                  e.level === "High" ? "text-amber-400" :
                  e.level === "Medium" ? "text-yellow-400" : "text-emerald-400"
                }`}>{e.level}</span>
              </div>
            ))}
          </div>

          {/* Observed vs expected */}
          <div className="rounded-xl bg-white/5 p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Observed</span>
              <span className="font-bold text-red-300">{target.observedValue}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Expected Range</span>
              <span className="text-white/70">{target.expectedRange}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Detection Type</span>
              <span className="text-white/70">{target.detectionType}</span>
            </div>
          </div>
        </div>

        {/* Right: Sensor health + action */}
        <div className="space-y-3">
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <Cpu className="mx-auto h-8 w-8 text-white/30 mb-2" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Sensor Health</p>
            <p className={`text-xl font-black mt-1 ${healthColor}`}>{sensorHealth}</p>
          </div>

          <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Recommended Action</p>
            </div>
            <p className="text-sm text-amber-100 leading-relaxed">{action}</p>
          </div>

          <div className="flex gap-2">
            <a
              href={`/anomalies/${target.id}`}
              className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2.5 text-center text-xs font-semibold text-white transition"
            >
              View Full Report
            </a>
            <button
              onClick={onDismiss}
              className="rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-xs font-medium text-white/50 hover:text-white transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function Overview() {
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);
  const [showAnomalyPanel, setShowAnomalyPanel] = useState(true);

  const activeCount = stations.filter((s) => s.status === "active").length;
  const warnCount = stations.filter((s) => s.status === "warning").length;
  const critCount = stations.filter((s) => s.status === "maintenance").length;
  const offlineCount = stations.filter((s) => s.status === "offline").length;
  const healthySensors = activeCount * 12;
  const alertCount = alerts.length;
  const critAlerts = alerts.filter((a) => a.type === "critical").length;
  const avgHealth = Math.round(stations.reduce((s, x) => s + x.healthScore, 0) / stations.length);
  const avgTemp = (stations.reduce((s, x) => s + x.temperature, 0) / stations.length).toFixed(1);
  const avgHumid = Math.round(stations.reduce((s, x) => s + x.humidity, 0) / stations.length);

  const dateStr = new Date().toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" });

  const recentAlerts = [
    { icon: "🌬️", title: "High Wind Speed", station: "Raipur AWS", time: "10:15 AM", sev: "critical" },
    { icon: "🔋", title: "Low Battery", station: "Jashpur AWS", time: "09:42 AM", sev: "warning" },
    { icon: "🌧️", title: "Rainfall Anomaly", station: "Dantewada AWS", time: "09:15 AM", sev: "info" },
    { icon: "🌡️", title: "Temp Spike Detected", station: "Bilaspur AWS", time: "08:50 AM", sev: "critical" },
    { icon: "📡", title: "Comm Gap >30 min", station: "Surguja AWS", time: "08:22 AM", sev: "warning" },
  ];

  const sevColors: Record<string, string> = {
    critical: "text-red-500",
    warning: "text-amber-500",
    info: "text-blue-500",
  };

  return (
    <div className="space-y-5 min-h-full">
      {/* Welcome bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Welcome back, Admin <span>🌤️</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Here's what's happening with your AWS network</p>
        </div>
        <div className="text-right text-sm text-slate-400 hidden md:block">
          <p className="font-medium text-slate-600">{dateStr}</p>
          <p><LiveClock /></p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Stations"
          value={stations.length}
          sub={`+5 this month`}
          subColor="text-blue-500"
          icon={Radio}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          trend="up"
        />
        <KPICard
          label="Active Stations"
          value={activeCount}
          sub={`${((activeCount / stations.length) * 100).toFixed(1)}%`}
          subColor="text-emerald-500"
          icon={Wifi}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          trend="up"
        />
        <KPICard
          label="Healthy Sensors"
          value={healthySensors.toLocaleString()}
          sub={`${((healthySensors / (stations.length * 12)) * 100).toFixed(1)}%`}
          subColor="text-emerald-500"
          icon={Activity}
          iconBg="bg-teal-50"
          iconColor="text-teal-500"
          trend="up"
        />
        <KPICard
          label="Active Alerts"
          value={alertCount}
          sub={`${critAlerts > 0 ? critAlerts + " Critical" : "None critical"}`}
          subColor={critAlerts > 0 ? "text-red-500" : "text-slate-400"}
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          trend={critAlerts > 0 ? "up" : undefined}
        />
      </div>

      <AnimatePresence>
        {showAnomalyPanel && (
          <AnomalyDetectionPanel onDismiss={() => setShowAnomalyPanel(false)} />
        )}
      </AnimatePresence>

      {/* Main content: map + right panel */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

        {/* Geographical Overview */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            📍 Geographical Overview
          </h3>
          <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-[#dceaf4]" style={{ height: 340 }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} minZoom={4} maxZoom={8} className="absolute inset-0 z-0 h-full w-full" scrollWheelZoom={false}>
              <TileLayer
                attribution='Tiles &copy; Esri, Sources: Esri, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              />
              {stations.map((station) => (
                <Marker key={station.id} position={[station.latitude, station.longitude]} icon={createOverviewMarkerIcon(station.status)}>
                  <Popup>
                    <strong>{station.name}</strong><br />
                    {station.state} · {station.healthScore}% health<br />
                    {station.temperature.toFixed(1)}°C · {station.humidity}% RH · {station.pressure.toFixed(1)} hPa
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="hidden"
              preserveAspectRatio="xMidYMid meet"
            >
              <path d={INDIA_PATH} fill="#b8d0e1" fillOpacity="0.96" stroke="#174a6e" strokeWidth="3" />
              <path d={INDIA_PATH} fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.85" />
              {/* Grid lines */}
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <line key={`h${i}`} x1={0} y1={(i * MAP_H) / 6} x2={MAP_W} y2={(i * MAP_H) / 6}
                  stroke="#c7d8e8" strokeWidth={0.5} />
              ))}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <line key={`v${i}`} x1={(i * MAP_W) / 7} y1={0} x2={(i * MAP_W) / 7} y2={MAP_H}
                  stroke="#c7d8e8" strokeWidth={0.5} />
              ))}

              <text x="42" y="54" fill="#6d8da3" fontSize="9" fontWeight="600">WEST</text>
              <text x="264" y="68" fill="#6d8da3" fontSize="9" fontWeight="600">NORTH</text>
              <text x="226" y="264" fill="#6d8da3" fontSize="9" fontWeight="600">CENTRAL</text>
              <text x="330" y="300" fill="#6d8da3" fontSize="9" fontWeight="600">SOUTH</text>

              {/* Station dots */}
              {stations.slice(0, 80).map((s) => {
                const { x, y } = latLngToXY(s.latitude, s.longitude);
                const color = statusColor[s.status] ?? "#94a3b8";
                const isHovered = hoveredStation === s.id;
                return (
                  <g key={s.id} onMouseEnter={() => setHoveredStation(s.id)} onMouseLeave={() => setHoveredStation(null)}>
                    {isHovered && (
                      <circle cx={x} cy={y} r={10} fill={color} opacity={0.2} />
                    )}
                    <circle cx={x} cy={y} r={isHovered ? 7 : 5} fill={color}
                      stroke="white" strokeWidth={1.5}
                      style={{ cursor: "pointer", transition: "r 150ms" }} />
                    {isHovered && (
                      <foreignObject x={x + 8} y={y - 28} width={140} height={52}>
                        <div style={{
                          background: "white", borderRadius: 8, padding: "4px 8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                          fontSize: 11, lineHeight: 1.4, color: "#334155"
                        }}>
                          <strong>{s.name}</strong><br />
                          Status: <span style={{ color }}>{s.status}</span>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-700 shadow-sm">
              INDIA · LIVE STATION COVERAGE
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-white/85 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs">
              {[
                { label: "Healthy", color: "#22c55e" },
                { label: "Warning", color: "#f59e0b" },
                { label: "Critical", color: "#ef4444" },
                { label: "Offline", color: "#94a3b8" },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-slate-600">{label}</span>
                </span>
              ))}
            </div>

            {/* Live badge */}
            <LiveStreamBadge />
          </div>
        </div>

        {/* Right panel: Network Health + Alerts */}
        <div className="flex flex-col gap-5">

          {/* Network Health */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-700 mb-3">Network Health</h3>
            <div className="flex flex-col items-center">
              <DonutChart value={avgHealth} size={130} />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <p className="text-lg font-bold text-slate-800">{activeCount}</p>
                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Healthy
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{warnCount}</p>
                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Warning
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{critCount}</p>
                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5">
                  <span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> Critical
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{offlineCount}</p>
                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300 inline-block" /> Offline
                </p>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700">Recent Alerts</h3>
              <button className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                View All <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2.5">
              {recentAlerts.map((a, i) => (
                <motion.div
                  key={i}
                  whileHover={{ x: 3 }}
                  className="flex items-center gap-3 rounded-xl border border-slate-50 bg-slate-50/60 px-3 py-2.5"
                >
                  <span className="text-base">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${sevColors[a.sev]} truncate`}>{a.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">{a.station}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 shrink-0">{a.time}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom weather strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Temperature (Avg)", value: `${avgTemp}°C`, icon: Thermometer, data: tempSparkData, color: "#f59e0b" },
          { label: "Humidity (Avg)", value: `${avgHumid}%`, icon: Droplets, data: humidSparkData, color: "#3b82f6" },
          { label: "Rainfall (Today)", value: "12.4 mm", icon: CloudRain, data: rainSparkData, color: "#06b6d4" },
          { label: "Wind Speed (Avg)", value: "14.2 km/h", icon: Wind, data: windSparkData, color: "#8b5cf6" },
        ].map(({ label, value, icon: Icon, data, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400 font-medium">{label}</p>
              <Icon className="h-4 w-4 text-slate-300" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <div className="mt-1">
              <ResponsiveContainer width="100%" height={36}>
                <LineChart data={data}>
                  <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
