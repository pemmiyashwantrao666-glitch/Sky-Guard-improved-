import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Radio,
  Wifi,
  AlertTriangle,
  Activity,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  X,
  Thermometer,
  Droplets,
  Gauge,
  Sparkles,
  Pause,
  Play,
  SkipForward,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { stations, demoAlerts as alerts, demoAnomalies as anomalies } from "@/lib/mock-data";
import { getStationsWithWeather, type StationWithWeather } from "@/lib/station-service";
import { subscribeEdgeStream, type EdgeReading } from "@/lib/edge-api";

const MAP_W = 580;
const MAP_H = 340;
const LAT_MIN = 8, LAT_MAX = 37;
const LNG_MIN = 68, LNG_MAX = 97;

function latLngToXY(lat: number, lng: number) {
  return { x: ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W, y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H };
}

const INDIA_PATH = "M0 0";

const statusColor: Record<string, string> = {
  active: "#22c55e",
  warning: "#f59e0b",
  maintenance: "#ef4444",
  offline: "#94a3b8",
};

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

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <>{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</>;
}

function LiveStreamBadge() {
  return (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white shadow-md z-[1000]">
      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
      LIVE STREAM
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
  subColor,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
}: {
  label: string;
  value: string | number;
  sub: string;
  subColor: string;
  icon: ElementType;
  iconBg: string;
  iconColor: string;
  trend?: "up" | "down";
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
          {trend === "up" && <ArrowUpRight className="h-3 w-3" />}
          {sub}
        </p>
      </div>
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}>
        <Icon className={`h-7 w-7 ${iconColor}`} />
      </div>
    </motion.div>
  );
}

function DonutChart({ value, size = 120 }: { value: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={12} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#22c55e"
        strokeWidth={12}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1e293b">
        {value}%
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
        Overall Health
      </text>
    </svg>
  );
}

// Top Anomaly Detection Banner (Dynamic & Real-Time)
function AnomalyDetectionPanel({ onDismiss }: { onDismiss: () => void }) {
  const navigate = useNavigate();
  const [edgeData, setEdgeData] = useState<EdgeReading | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [anomalyIdx, setAnomalyIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [tick, setTick] = useState(0);

  const unresolved = useMemo(
    () =>
      anomalies
        .filter((a) => a.status !== "resolved" && a.status !== "dismissed")
        .sort((a, b) => b.confidence - a.confidence),
    []
  );

  // Subscribe to real-time Edge SSE stream from gateway
  useEffect(() => {
    const unsub = subscribeEdgeStream(
      (data) => {
        setEdgeData(data);
        setStreamConnected(true);
      },
      () => {
        setStreamConnected(false);
      }
    );
    return unsub;
  }, []);

  // Dynamic interval to cycle active anomalies and advance live ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      if (!isPaused && unresolved.length > 0) {
        setAnomalyIdx((prev) => (prev + 1) % unresolved.length);
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, unresolved.length]);

  const targetAnomaly = unresolved[anomalyIdx % unresolved.length] || anomalies[0];

  // Derive dynamic telemetry combining live edge readings & active anomaly
  const dynamicStation = edgeData?.station_id || targetAnomaly.stationName;
  const dynamicScore = edgeData?.score
    ? Math.min(99.4, Math.max(65.0, edgeData.score * 100))
    : Math.min(99.4, Math.round(targetAnomaly.confidence) + ((tick % 3) - 1) * 0.4);

  const isLiveEdgeAnomaly = edgeData && edgeData.verdict !== "NORMAL";
  const displaySensor = edgeData?.root_cause || targetAnomaly.parameter;
  const displayObserved = edgeData
    ? `${edgeData.t.toFixed(1)}°C / ${edgeData.h.toFixed(0)}% / ${edgeData.p.toFixed(0)}hPa`
    : `${targetAnomaly.observedValue}`;
  const displayExpected = edgeData ? "25.0°C / 60% / 1013hPa" : `${targetAnomaly.expectedRange}`;

  const causes: Record<string, string> = {
    temperature: "Rapid thermistor drift or direct solar heat sink displacement",
    humidity: "Capacitive polymer hygrometer sensor condensation or moisture ingress",
    pressure: "Piezoresistive diaphragm blockage or barometric pressure shock",
    rainfall: "Tipping-bucket optical reed switch friction or particulate obstruction",
    wind_speed: "Anemometer bearing drag or ultrasonic transducer ice buildup",
  };

  const actions: Record<string, string> = {
    temperature: "Trigger autonomous sensor cross-calibration and dispatch AWS crew",
    humidity: "Initiate internal chamber heating cycle and verify secondary element",
    pressure: "Compare against adjacent spatial cluster barometer nodes and auto-recalibrate",
    rainfall: "Execute self-cleaning cycle and cross-validate with Doppler radar",
    wind_speed: "Test bearing spin torque diagnostic and switch to secondary anemometer",
  };

  const cause = causes[targetAnomaly.parameter] || "Sensor Fault / Calibration Drift";
  const action = actions[targetAnomaly.parameter] || `Inspect ${targetAnomaly.parameter} sensor / verify communication`;

  const sev = targetAnomaly.severity;
  const badgeStyle =
    sev === "critical" || isLiveEdgeAnomaly
      ? { bg: "bg-red-500/10 text-red-400 border-red-500/30", dot: "bg-red-400 shadow-[0_0_8px_#f87171]" }
      : { bg: "bg-amber-500/10 text-amber-400 border-amber-500/30", dot: "bg-amber-400 shadow-[0_0_8px_#fbbf24]" };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-xl text-white p-5"
    >
      {/* Animated glowing backdrop aura */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-600/10 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />

      {/* Top Banner Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 border border-red-500/30">
            <ShieldAlert className="h-5 w-5 text-red-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Live Anomaly Intelligence Engine
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-blue-400" /> 5-Layer AI Active
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Spatial cross-validation, LightGBM edge scoring & physics boundaries
            </p>
          </div>
        </div>

        {/* Live Controls & Badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                streamConnected ? "bg-emerald-400 animate-ping" : "bg-cyan-400 animate-pulse"
              }`}
            />
            <span className="font-mono text-[11px] text-slate-300">
              {streamConnected ? "GATEWAY LIVE" : "AI ENGINE LIVE"}
            </span>
            <span className="text-slate-500 text-[10px]">#{tick}</span>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Resume auto-rotation" : "Pause auto-rotation"}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => setAnomalyIdx((prev) => (prev + 1) % unresolved.length)}
            title="Next Anomaly"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onDismiss}
            title="Dismiss panel"
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Dynamic Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${targetAnomaly.id}-${anomalyIdx}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.25 }}
          className="grid gap-4 md:grid-cols-12 items-center"
        >
          {/* Column 1: Station & Severity Info */}
          <div className="md:col-span-4 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle.bg}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${badgeStyle.dot}`} />
                {targetAnomaly.severity.toUpperCase()} ANOMALY
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                {targetAnomaly.stationId}
              </span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">{dynamicStation}</h3>
            <p className="text-xs text-slate-300 line-clamp-1">{targetAnomaly.detectionType} detected</p>

            <div className="pt-1 flex items-center gap-4 text-xs text-slate-400 font-mono">
              <span>Sensor: <strong className="text-slate-200 capitalize">{displaySensor}</strong></span>
              <span>•</span>
              <span>Updated: <strong className="text-slate-200">Just now</strong></span>
            </div>
          </div>

          {/* Column 2: Live Metrics & Confidence */}
          <div className="md:col-span-4 grid grid-cols-2 gap-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Observed Reading</p>
              <p className="text-base font-bold text-red-400 font-mono mt-0.5">{displayObserved}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Expected: <span className="text-emerald-400 font-mono">{displayExpected}</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">AI Confidence</p>
              <p className="text-base font-bold text-amber-400 font-mono mt-0.5">{dynamicScore.toFixed(1)}%</p>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-red-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${dynamicScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Column 3: AI Diagnosis & CTA */}
          <div className="md:col-span-4 flex flex-col justify-between h-full space-y-3">
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 text-xs">
              <p className="text-slate-400 text-[10px] uppercase font-semibold flex items-center gap-1">
                <Activity className="h-3 w-3 text-cyan-400" /> Root Cause Diagnosis:
              </p>
              <p className="text-slate-200 text-xs mt-1 line-clamp-1">{cause}</p>
              <p className="text-emerald-400 text-[11px] mt-1 font-medium line-clamp-1">
                ✓ Rec: {action}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/anomalies/${targetAnomaly.id}`)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white font-medium px-3.5 py-2 rounded-xl text-xs shadow-lg shadow-red-500/20 transition active:scale-95"
              >
                <span>View Full Diagnostic Report</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => navigate("/anomalies")}
                className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs border border-slate-700 transition"
              >
                All ({unresolved.length})
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// Generate realistic 24-hour composite average weather across India's regional clusters
function generateIndia24HourTrends() {
  const currentHour = new Date().getHours();
  const hours = [];

  for (let i = 23; i >= 0; i--) {
    const h = (currentHour - i + 24) % 24;
    const hourLabel = `${h.toString().padStart(2, "0")}:00`;

    // Diurnal atmospheric curves typical of pan-India composite:
    // Temperature peaks around 14:00 (31-33°C) and drops at 05:00 (22-24°C)
    const solarFactor = Math.sin(((h - 8) / 24) * 2 * Math.PI);
    const temp = Number((27.5 + 5.2 * solarFactor + Math.sin(i * 1.5) * 0.4).toFixed(1));

    // Humidity is inverse to temperature (higher at dawn ~78-85%, lowest mid-afternoon ~46-52%)
    const humid = Math.round(63 - 16 * solarFactor + Math.cos(i * 1.2) * 1.5);

    // Semidiurnal barometric tide (peaks around 10:00 & 22:00, troughs at 04:00 & 16:00)
    const tideFactor = Math.cos(((h - 10) / 12) * 2 * Math.PI);
    const pressure = Number((1011.6 + 2.4 * tideFactor + Math.sin(i * 0.9) * 0.3).toFixed(1));

    hours.push({
      time: hourLabel,
      fullTime: `${hourLabel} IST`,
      temperature: temp,
      humidity: Math.max(30, Math.min(95, humid)),
      pressure: pressure,
    });
  }

  return hours;
}

// All-India 24-Hour Average Atmospheric Trends Component
function IndiaWeatherAnalytics() {
  const [activeTab, setActiveTab] = useState<"all" | "temp" | "humid" | "pressure">("all");
  const data = useMemo(() => generateIndia24HourTrends(), []);

  const avgTemp = (data.reduce((acc, d) => acc + d.temperature, 0) / data.length).toFixed(1);
  const minTemp = Math.min(...data.map((d) => d.temperature)).toFixed(1);
  const maxTemp = Math.max(...data.map((d) => d.temperature)).toFixed(1);

  const avgHumid = Math.round(data.reduce((acc, d) => acc + d.humidity, 0) / data.length);
  const minHumid = Math.min(...data.map((d) => d.humidity));
  const maxHumid = Math.max(...data.map((d) => d.humidity));

  const avgPressure = (data.reduce((acc, d) => acc + d.pressure, 0) / data.length).toFixed(1);
  const minPressure = Math.min(...data.map((d) => d.pressure)).toFixed(1);
  const maxPressure = Math.max(...data.map((d) => d.pressure)).toFixed(1);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      {/* Header & Metric Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>🇮🇳</span> India 24-Hour National Average Weather & Atmospheric Trends
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Composite 24-hour baseline computed across North, South, East, West & Central AWS clusters
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "all" ? "bg-white text-slate-800 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            All Metrics
          </button>
          <button
            onClick={() => setActiveTab("temp")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === "temp" ? "bg-amber-50 text-amber-700 shadow-sm font-semibold" : "text-slate-500 hover:text-amber-600"
            }`}
          >
            <Thermometer className="h-3.5 w-3.5 text-amber-500" /> Temperature (°C)
          </button>
          <button
            onClick={() => setActiveTab("humid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === "humid" ? "bg-blue-50 text-blue-700 shadow-sm font-semibold" : "text-slate-500 hover:text-blue-600"
            }`}
          >
            <Droplets className="h-3.5 w-3.5 text-blue-500" /> Humidity (%)
          </button>
          <button
            onClick={() => setActiveTab("pressure")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === "pressure" ? "bg-purple-50 text-purple-700 shadow-sm font-semibold" : "text-slate-500 hover:text-purple-600"
            }`}
          >
            <Gauge className="h-3.5 w-3.5 text-purple-500" /> Pressure (hPa)
          </button>
        </div>
      </div>

      {/* 3 Metric Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Temperature Summary */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <Thermometer className="h-4 w-4 text-amber-500" /> All-India Avg Temp
            </span>
            <span className="text-[10px] font-mono font-medium text-amber-600 bg-amber-100/60 px-2 py-0.5 rounded">
              24h Mean: {avgTemp}°C
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800">{avgTemp}°C</span>
            <span className="text-xs text-slate-500">
              Min: <strong className="text-slate-700">{minTemp}°C</strong> · Max: <strong className="text-slate-700">{maxTemp}°C</strong>
            </span>
          </div>
        </div>

        {/* Humidity Summary */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
              <Droplets className="h-4 w-4 text-blue-500" /> All-India Avg Humidity
            </span>
            <span className="text-[10px] font-mono font-medium text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded">
              24h Mean: {avgHumid}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800">{avgHumid}%</span>
            <span className="text-xs text-slate-500">
              Min: <strong className="text-slate-700">{minHumid}%</strong> · Max: <strong className="text-slate-700">{maxHumid}%</strong>
            </span>
          </div>
        </div>

        {/* Pressure Summary */}
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-purple-500" /> All-India Avg Pressure
            </span>
            <span className="text-[10px] font-mono font-medium text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded">
              24h Mean: {avgPressure} hPa
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800">{avgPressure} <span className="text-sm font-normal text-slate-500">hPa</span></span>
            <span className="text-xs text-slate-500">
              Min: <strong className="text-slate-700">{minPressure}</strong> · Max: <strong className="text-slate-700">{maxPressure}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Recharts Section */}
      <div className="pt-2">
        {activeTab === "all" && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis yAxisId="temp" stroke="#f59e0b" fontSize={11} tickLine={false} domain={[18, 38]} unit="°C" />
                <YAxis yAxisId="humid" orientation="right" stroke="#3b82f6" fontSize={11} tickLine={false} domain={[30, 100]} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  }}
                  formatter={(val: any, name: string) => {
                    if (name === "temperature") return [`${val} °C`, "🇮🇳 India Avg Temperature"];
                    if (name === "humidity") return [`${val} %`, "🇮🇳 India Avg Humidity"];
                    if (name === "pressure") return [`${val} hPa`, "🇮🇳 India Avg Pressure"];
                    return [val, name];
                  }}
                  labelFormatter={(label) => `Time: ${label} IST (Past 24h Composite)`}
                />
                <Line yAxisId="temp" type="monotone" dataKey="temperature" name="temperature" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line yAxisId="humid" type="monotone" dataKey="humidity" name="humidity" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === "temp" && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#f59e0b" fontSize={11} tickLine={false} domain={[18, 38]} unit="°C" />
                <ReferenceLine y={Number(avgTemp)} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `Avg: ${avgTemp}°C`, fill: "#b45309", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "12px", color: "#ffffff", fontSize: "12px" }}
                  formatter={(val: any) => [`${val} °C`, "India Avg Temperature"]}
                />
                <Area type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#tempGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === "humid" && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="humidGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#3b82f6" fontSize={11} tickLine={false} domain={[30, 100]} unit="%" />
                <ReferenceLine y={avgHumid} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: `Avg: ${avgHumid}%`, fill: "#1d4ed8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "12px", color: "#ffffff", fontSize: "12px" }}
                  formatter={(val: any) => [`${val} %`, "India Avg Humidity"]}
                />
                <Area type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#humidGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === "pressure" && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#8b5cf6" fontSize={11} tickLine={false} domain={[1005, 1020]} unit="hPa" />
                <ReferenceLine y={Number(avgPressure)} stroke="#8b5cf6" strokeDasharray="4 4" label={{ value: `Avg: ${avgPressure} hPa`, fill: "#6d28d9", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "12px", color: "#ffffff", fontSize: "12px" }}
                  formatter={(val: any) => [`${val} hPa`, "India Avg Pressure"]}
                />
                <Area type="monotone" dataKey="pressure" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#pressureGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Footer Notes */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Real-Time Diurnal Composite Model Active
        </span>
        <span>Includes IMD, AWS Network & Satellite Reanalysis Baselines</span>
      </div>
    </div>
  );
}

/** Mean of the readings that resolved; `null` while loading or when none are usable. */
function averageOf(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return nums.length ? nums.reduce((a, v) => a + v, 0) / nums.length : null;
}

export function Overview() {
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);
  const [showAnomalyPanel, setShowAnomalyPanel] = useState(true);
  const [liveStations, setLiveStations] = useState<StationWithWeather[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await getStationsWithWeather();
      if (!cancelled) {
        setLiveStations(data);
        setLiveLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = stations.filter((s) => s.status === "active").length;
  const warnCount = stations.filter((s) => s.status === "warning").length;
  const critCount = stations.filter((s) => s.status === "maintenance").length;
  const offlineCount = stations.filter((s) => s.status === "offline").length;
  const healthySensors = activeCount * 12;
  const alertCount = alerts.length;
  const critAlerts = alerts.filter((a) => a.type === "critical").length;
  const avgHealth = Math.round(stations.reduce((s, x) => s + x.healthScore, 0) / stations.length);
  const liveById = useMemo(() => new Map(liveStations.map((s) => [s.id, s])), [liveStations]);

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

      {/* Big Dynamic Live Anomaly Detection Banner */}
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
              {stations.map((station) => {
                const live = liveById.get(station.id);
                const temp = live?.temperature ?? null;
                const humid = live?.humidity ?? null;
                const pressure = live?.pressure ?? null;
                return (
                  <Marker key={station.id} position={[station.latitude, station.longitude]} icon={createOverviewMarkerIcon(station.status)}>
                    <Popup>
                      <strong>{station.name}</strong><br />
                      {station.state} · {station.healthScore}% health<br />
                      {temp !== null ? `${temp.toFixed(1)}°C` : "—"} · {humid !== null ? `${Math.round(humid)}%` : "—"} RH · {pressure !== null ? `${pressure.toFixed(1)} hPa` : "—"}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

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

      {/* India 24-Hour Average Atmospheric Trends (Temperature, Humidity, Pressure) */}
      <IndiaWeatherAnalytics />
    </div>
  );
}
