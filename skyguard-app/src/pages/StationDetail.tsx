import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Thermometer,
  Gauge,
  Droplets,
  Battery,
  Activity,
  Download,
  Wrench,
  Settings2,
  ArrowLeft,
  MapPin,
  Clock,
  Heart,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  FileDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getStationById,
  getAnomaliesByStation,
  maintenanceTasks,
  generateReadings,
} from "@/lib/mock-data";
import { streamService } from "@/lib/stream";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25 },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const monthQualityData = [
  { month: "Jan", missingness: 1.2, spikeCount: 0, drift: 0.4, consistency: 97 },
  { month: "Feb", missingness: 0.8, spikeCount: 0, drift: 0.3, consistency: 98 },
  { month: "Mar", missingness: 2.1, spikeCount: 1, drift: 0.5, consistency: 95 },
  { month: "Apr", missingness: 0.5, spikeCount: 0, drift: 0.2, consistency: 99 },
  { month: "May", missingness: 3.4, spikeCount: 2, drift: 0.8, consistency: 91 },
  { month: "Jun", missingness: 1.9, spikeCount: 1, drift: 0.6, consistency: 94 },
  { month: "Jul", missingness: 0.9, spikeCount: 0, drift: 0.3, consistency: 98 },
  { month: "Aug", missingness: 1.5, spikeCount: 1, drift: 0.5, consistency: 96 },
  { month: "Sep", missingness: 2.8, spikeCount: 2, drift: 0.9, consistency: 89 },
  { month: "Oct", missingness: 1.1, spikeCount: 0, drift: 0.4, consistency: 97 },
  { month: "Nov", missingness: 0.6, spikeCount: 0, drift: 0.2, consistency: 99 },
  { month: "Dec", missingness: 1.3, spikeCount: 0, drift: 0.4, consistency: 97 },
];

export function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const station = useMemo(() => (id ? getStationById(id) : undefined), [id]);

  const [streaming, setStreaming] = useState(true);
  const [liveReadings, setLiveReadings] = useState<
    { timestamp: string; temperature: number; humidity: number; pressure: number; windSpeed: number }[]
  >([]);
  const unsubRef = useRef<(() => void) | null>(null);

  const stationAnomalies = useMemo(
    () => (id ? getAnomaliesByStation(id) : []),
    [id]
  );
  const stationTasks = useMemo(
    () => maintenanceTasks.filter((t) => t.stationId === id),
    [id]
  );
  const readings = useMemo(() => (id ? generateReadings(id, 24) : []), [id]);
  const rawCsvRows = useMemo(
    () =>
      readings.map((r, i) => ({
        index: i + 1,
        timestamp: r.timestamp,
        temperature_c: r.temperature,
        humidity_pct: r.humidity,
        pressure_hpa: r.pressure,
        wind_speed_ms: r.windSpeed,
        expected_temp_c: r.expectedTemp ?? "",
        corrected_temp_c: r.correctedTemp ?? "",
      })),
    [readings]
  );

  useEffect(() => {
    if (!streaming) return;
    const unsub = streamService.subscribe((data) => {
      if (data.stationId === id) {
        setLiveReadings((prev) => {
          const next = [...prev, data];
          if (next.length > 60) next.shift();
          return next;
        });
      }
    });
    unsubRef.current = unsub;
    streamService.start();
    return () => {
      unsub();
    };
  }, [streaming, id]);

  if (!station) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-graphite/60">
        <AlertTriangle className="mb-3 h-10 w-10 text-signal-amber" />
        <p className="font-serif text-xl text-ink-navy">Station not found</p>
        <Link to="/stations" className="mt-4">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to stations
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig: Record<
    string,
    { variant: "success" | "warning" | "destructive" | "secondary"; label: string }
  > = {
    active: { variant: "success", label: "Online" },
    warning: { variant: "warning", label: "Warning" },
    offline: { variant: "destructive", label: "Offline" },
    maintenance: { variant: "secondary", label: "Maintenance" },
  };

  const statusBadge = statusConfig[station.status] || statusConfig.offline;

  const formatChartTooltipLabel = (value: ReactNode) => {
    if (value == null || value === "") return "";
    if (Array.isArray(value)) return value.join(", ");

    const asString = String(value);
    const parsed = new Date(asString);
    return Number.isNaN(parsed.getTime())
      ? asString
      : parsed.toLocaleString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-2xl font-bold text-ink-navy">
              {station.name}
            </h1>
            <Badge variant={statusBadge.variant} className="capitalize">
              {statusBadge.label}
            </Badge>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-graphite/60">
            <span className="font-mono text-xs">{station.id}</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {station.district}, {station.state}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              Health:{" "}
              <span
                className={`font-semibold ${
                  station.healthScore >= 85
                    ? "text-healthy-green"
                    : station.healthScore >= 70
                      ? "text-signal-amber"
                      : "text-alert-coral"
                }`}
              >
                {station.healthScore}%
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Last sync: {formatDate(station.lastSync)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export data
          </Button>
          <Button variant="outline" size="sm">
            <Wrench className="mr-2 h-4 w-4" />
            Create maintenance ticket
          </Button>
          <Button variant="default" size="sm">
            <Settings2 className="mr-2 h-4 w-4" />
            Configure thresholds
          </Button>
        </div>
      </motion.div>

      {/* Quick stat cards */}
      <motion.div
        {...fadeUp}
        transition={{ delay: 0.05 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="p-4">
          <p className="text-xs text-graphite/60 uppercase tracking-wide">Temperature</p>
          <p className="mt-1 flex items-baseline gap-1 text-2xl font-bold text-ink-navy">
            {station.temperature}°C
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-graphite/60">
            <Thermometer className="h-3 w-3" /> Current
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-graphite/60 uppercase tracking-wide">Humidity</p>
          <p className="mt-1 flex items-baseline gap-1 text-2xl font-bold text-ink-navy">
            {station.humidity}%
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-graphite/60">
            <Droplets className="h-3 w-3" /> Relative
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-graphite/60 uppercase tracking-wide">Pressure</p>
          <p className="mt-1 flex items-baseline gap-1 text-2xl font-bold text-ink-navy">
            {station.pressure} hPa
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-graphite/60">
            <Gauge className="h-3 w-3" /> Atmospheric
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-graphite/60 uppercase tracking-wide">Communication</p>
          <p className="mt-1 flex items-baseline gap-1 text-2xl font-bold text-ink-navy">
            {station.communicationQuality}%
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-graphite/60">
            {station.communicationQuality >= 90 ? (
              <CheckCircle2 className="h-3 w-3 text-healthy-green" />
            ) : (
              <XCircle className="h-3 w-3 text-alert-coral" />
            )}
            {station.communicationQuality >= 90 ? "Strong" : "Weak"} signal
          </p>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-2 flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="live">Live readings</TabsTrigger>
            <TabsTrigger value="quality">Data quality</TabsTrigger>
            <TabsTrigger value="anomalies">Anomaly history</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="raw">Raw data</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <motion.div {...fadeUp} className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="font-serif text-lg font-semibold text-ink-navy">
                  24-hour temperature trend
                </h3>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={readings}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 12, fill: "#202124" }}
                        tickFormatter={(v) => formatTime(v)}
                      />
                      <YAxis tick={{ fontSize: 12, fill: "#202124" }} />
                      <Tooltip
                        labelFormatter={formatChartTooltipLabel}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #E8EDF1",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="temperature"
                        name="Temperature (°C)"
                        stroke="#102A43"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5, fill: "#174A6E" }}
                      />
                      {readings.some((r) => r.expectedTemp != null) && (
                        <Line
                          type="monotone"
                          dataKey="expectedTemp"
                          name="Expected (°C)"
                          stroke="#D99532"
                          strokeWidth={2}
                          strokeDasharray="4 2"
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-serif text-lg font-semibold text-ink-navy">
                  24-hour pressure & humidity
                </h3>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={readings}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 12, fill: "#202124" }}
                        tickFormatter={(v) => formatTime(v)}
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#202124" }} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12, fill: "#202124" }}
                      />
                      <Tooltip
                        labelFormatter={formatChartTooltipLabel}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #E8EDF1",
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="pressure"
                        name="Pressure (hPa)"
                        stroke="#174A6E"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="humidity"
                        name="Humidity (%)"
                        stroke="#6BAED6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <h3 className="font-serif text-lg font-semibold text-ink-navy">
                  Station status summary
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3 rounded-lg border border-cloud-grey p-4">
                    <Battery
                      className={`h-6 w-6 ${
                        station.batteryLevel >= 70
                          ? "text-healthy-green"
                          : station.batteryLevel >= 40
                            ? "text-signal-amber"
                            : "text-alert-coral"
                      }`}
                    />
                    <div>
                      <p className="text-xs text-graphite/60">Battery / Power</p>
                      <p className="text-sm font-semibold text-ink-navy">
                        {station.batteryLevel}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-cloud-grey p-4">
                    <Activity
                      className={`h-6 w-6 ${
                        station.sensorDrift <= 0.5
                          ? "text-healthy-green"
                          : station.sensorDrift <= 1.5
                            ? "text-signal-amber"
                            : "text-alert-coral"
                      }`}
                    />
                    <div>
                      <p className="text-xs text-graphite/60">Sensor drift</p>
                      <p className="text-sm font-semibold text-ink-navy">
                        {station.sensorDrift}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-cloud-grey p-4">
                    <Heart className="h-6 w-6 text-deep-atmo" />
                    <div>
                      <p className="text-xs text-graphite/60">Sensor health score</p>
                      <p className="text-sm font-semibold text-ink-navy">
                        {station.healthScore}/100
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Live readings */}
          <TabsContent value="live">
            <motion.div {...fadeUp} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-ink-navy">
                    Live feed
                  </h3>
                  <p className="text-xs text-graphite/60">
                    {streaming
                      ? "Receiving live updates every 3 seconds"
                      : "Stream paused"}
                  </p>
                </div>
                <Button
                  variant={streaming ? "outline" : "default"}
                  size="sm"
                  onClick={() => setStreaming((s) => !s)}
                >
                  {streaming ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </>
                  )}
                </Button>
              </div>

              <Card className="p-0">
                <div className="max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-cloud-grey/60 text-xs uppercase tracking-wide text-graphite/70">
                      <tr>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Raw temperature (°C)</th>
                        <th className="p-3">Quality flag</th>
                        <th className="p-3">Corrected value</th>
                        <th className="p-3">Humidity (%)</th>
                        <th className="p-3">Pressure (hPa)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {liveReadings.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-xs text-graphite/60">
                              Waiting for live readings…
                            </td>
                          </tr>
                        ) : (
                          liveReadings
                            .slice()
                            .reverse()
                            .map((row, idx) => (
                              <motion.tr
                                key={row.timestamp + idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="border-b border-cloud-grey last:border-0"
                              >
                                <td className="p-3 font-mono text-xs text-graphite/70">
                                  {formatDate(row.timestamp)}
                                </td>
                                <td className="p-3 font-medium text-ink-navy">
                                  {row.temperature.toFixed(1)}
                                </td>
                                <td className="p-3">
                                  <Badge
                                    variant={
                                      row.temperature > 40 || row.temperature < 5
                                        ? "destructive"
                                        : "success"
                                    }
                                  >
                                    {row.temperature > 40 || row.temperature < 5
                                      ? "Flagged"
                                      : "Good"}
                                  </Badge>
                                </td>
                                <td className="p-3 text-graphite/70">
                                  {row.temperature > 40 || row.temperature < 5
                                    ? "N/A"
                                    : row.temperature.toFixed(1)}
                                </td>
                                <td className="p-3 text-ink-navy">{row.humidity}%</td>
                                <td className="p-3 text-ink-navy">{row.pressure}</td>
                              </motion.tr>
                            ))
                        )}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Data quality */}
          <TabsContent value="quality">
            <motion.div {...fadeUp} className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="font-serif text-lg font-semibold text-ink-navy">
                  Monthly quality metrics
                </h3>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthQualityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#202124" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#202124" }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #E8EDF1",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="spikeCount"
                        name="Spike count"
                        fill="#C85D3A"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="missingness"
                        name="Missingness (%)"
                        fill="#D99532"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-serif text-lg font-semibold text-ink-navy">
                  Consistency & drift
                </h3>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthQualityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#202124" }} />
                      <YAxis tick={{ fontSize: 12, fill: "#202124" }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #E8EDF1",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="drift"
                        name="Drift estimate"
                        stroke="#7067A8"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="consistency"
                        name="Cross-sensor consistency (%)"
                        stroke="#3F8062"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <h3 className="font-serif text-lg font-semibold text-ink-navy">
                  Data quality summary
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-cloud-grey p-4">
                    <p className="text-xs text-graphite/60">Missingness</p>
                    <p className="mt-1 text-xl font-bold text-ink-navy">1.8%</p>
                    <p className="mt-1 text-xs text-graphite/60">Avg across last 12 months</p>
                  </div>
                  <div className="rounded-lg border border-cloud-grey p-4">
                    <p className="text-xs text-graphite/60">Completeness</p>
                    <p className="mt-1 text-xl font-bold text-healthy-green">98.2%</p>
                    <p className="mt-1 text-xs text-graphite/60">Overall data completeness</p>
                  </div>
                  <div className="rounded-lg border border-cloud-grey p-4">
                    <p className="text-xs text-graphite/60">Spike count</p>
                    <p className="mt-1 text-xl font-bold text-signal-amber">7</p>
                    <p className="mt-1 text-xs text-graphite/60">Detected in last 12 months</p>
                  </div>
                  <div className="rounded-lg border border-cloud-grey p-4">
                    <p className="text-xs text-graphite/60">Frozen-value duration</p>
                    <p className="mt-1 text-xl font-bold text-alert-coral">6h</p>
                    <p className="mt-1 text-xs text-graphite/60">Longest frozen streak</p>
                  </div>
                  <div className="rounded-lg border border-cloud-grey p-4">
                    <p className="text-xs text-graphite/60">Drift estimate</p>
                    <p className="mt-1 text-xl font-bold text-violet">0.54</p>
                    <p className="mt-1 text-xs text-graphite/60">Normalized drift index</p>
                  </div>
                  <div className="rounded-lg border border-cloud-grey p-4">
                    <p className="text-xs text-graphite/60">Cross-sensor consistency</p>
                    <p className="mt-1 text-xl font-bold text-healthy-green">94.7%</p>
                    <p className="mt-1 text-xs text-graphite/60">Avg agreement score</p>
                  </div>
                  <div className="rounded-lg border border-cloud-grey p-4">
                    <p className="text-xs text-graphite/60">Quality score</p>
                    <p className="mt-1 text-xl font-bold text-ink-navy">92.1</p>
                    <p className="mt-1 text-xs text-graphite/60">Computed index</p>
                  </div>
                  <div className="rounded-lg border border-cloud-grey p-4">
                    <p className="text-xs text-graphite/60">Last QC run</p>
                    <p className="mt-1 text-sm font-medium text-ink-navy">
                      {new Date().toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-xs text-graphite/60">Automated pipeline</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Anomaly history */}
          <TabsContent value="anomalies">
            <motion.div {...fadeUp} className="space-y-3">
              {stationAnomalies.length === 0 ? (
                <Card className="p-6 text-center text-sm text-graphite/60">
                  No anomalies recorded for this station.
                </Card>
              ) : (
                stationAnomalies.map((anomaly) => (
                  <motion.div
                    key={anomaly.id}
                    {...fadeUp}
                    className="rounded-lg border border-cloud-grey bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-graphite/50">
                            {anomaly.id}
                          </span>
                          <Badge
                            variant={
                              anomaly.severity === "critical"
                                ? "destructive"
                                : anomaly.severity === "high"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {anomaly.severity}
                          </Badge>
                          <span className="text-xs text-graphite/60 capitalize">
                            {anomaly.detectionType.toLowerCase().replace(/-/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-ink-navy">
                          {anomaly.parameter} anomaly
                        </p>
                        <p className="mt-1 text-xs text-graphite/70">
                          Observed: {anomaly.observedValue} | Expected: {anomaly.expectedRange}
                        </p>
                        <p className="mt-2 text-xs text-graphite/60">{anomaly.explanation}</p>
                      </div>
                      <div className="text-right text-xs text-graphite/50">
                        <p>{formatDate(anomaly.detectedAt)}</p>
                        <p className="mt-1 capitalize">{anomaly.status}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>

          {/* Maintenance */}
          <TabsContent value="maintenance">
            <motion.div {...fadeUp} className="space-y-3">
              {stationTasks.length === 0 ? (
                <Card className="p-6 text-center text-sm text-graphite/60">
                  No maintenance tasks for this station.
                </Card>
              ) : (
                stationTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    {...fadeUp}
                    className="rounded-lg border border-cloud-grey bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-graphite/50">
                            {task.id}
                          </span>
                          <Badge
                            variant={
                              task.priority === "high"
                                ? "destructive"
                                : task.priority === "medium"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {task.priority}
                          </Badge>
                          <span
                            className={`inline-flex items-center gap-1 text-xs ${
                              task.completed
                                ? "text-healthy-green"
                                : "text-signal-amber"
                            }`}
                          >
                            {task.completed ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {task.completed ? "Completed" : "Open"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-ink-navy">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs text-graphite/60">
                          Assigned to {task.assignedTo}
                        </p>
                        {task.anomalyId && (
                          <p className="mt-1 text-xs text-graphite/50">
                            Linked anomaly: {task.anomalyId}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs text-graphite/50">
                        <p>Due: {formatDate(task.dueDate)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>

          {/* Raw data */}
          <TabsContent value="raw">
            <motion.div {...fadeUp} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-ink-navy">
                    Raw readings
                  </h3>
                  <p className="text-xs text-graphite/60">
                    Demo data — these are raw unprocessed readings and must not be
                    overwritten.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(rawCsvRows, `${station.id}-raw-data.csv`)
                  }
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
              </div>

              <Card className="p-0">
                <div className="max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-cloud-grey/60 text-xs uppercase tracking-wide text-graphite/70">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Temp (°C)</th>
                        <th className="p-3">Humidity (%)</th>
                        <th className="p-3">Pressure (hPa)</th>
                        <th className="p-3">Wind (m/s)</th>
                        <th className="p-3">Expected temp</th>
                        <th className="p-3">Corrected temp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings.map((r, i) => (
                        <tr
                          key={r.timestamp + i}
                          className="border-b border-cloud-grey last:border-0"
                        >
                          <td className="p-3 font-mono text-xs text-graphite/60">
                            {i + 1}
                          </td>
                          <td className="p-3 font-mono text-xs text-graphite/70">
                            {formatTime(r.timestamp)}
                          </td>
                          <td className="p-3 font-medium text-ink-navy">
                            {r.temperature}
                          </td>
                          <td className="p-3 text-ink-navy">{r.humidity}</td>
                          <td className="p-3 text-ink-navy">{r.pressure}</td>
                          <td className="p-3 text-ink-navy">{r.windSpeed}</td>
                          <td className="p-3 text-graphite/70">
                            {r.expectedTemp ?? "—"}
                          </td>
                          <td className="p-3 text-graphite/70">
                            {r.correctedTemp ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
