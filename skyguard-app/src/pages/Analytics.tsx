import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Clock,
  Gauge,
  Heart,
  Zap,
  ShieldCheck,
  FlaskConical,
  Play,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  stations,
  anomalies,
  regionStats,
} from "@/lib/mock-data";

const ANOMALY_TYPES = [
  "Point spike",
  "Frozen value",
  "Rate-of-change violation",
  "Seasonal inconsistency",
  "Multivariate mismatch",
  "Spatial mismatch",
  "Communication gap",
  "Sensor drift",
  "Suspected calibration issue",
] as const;

const PARAMETERS = [
  "temperature",
  "humidity",
  "pressure",
  "communication",
] as const;

const REGIONS = ["all", "north", "south", "east", "west", "central", "northeast"];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function useAnomalyFrequency() {
  const [now] = useState(() => Date.now());
  const [randomValues] = useState(() =>
    Array.from({ length: 17 }, () => Math.floor(Math.random() * 8) + 1)
  );
  const data = useMemo(() => {
    const hours = 48;
    const buckets: { time: string; count: number }[] = [];
    for (let i = hours, j = 0; i >= 0; i -= 3, j++) {
      const t = new Date(now - i * 60 * 60 * 1000);
      buckets.push({
        time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        count: randomValues[j] || 1,
      });
    }
    return buckets;
  }, [now, randomValues]);
  return data;
}

function useParameterDistribution() {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    anomalies.forEach((a) => {
      counts[a.parameter] = (counts[a.parameter] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);
  const COLORS = ["#102A43", "#174A6E", "#6BAED6", "#D99532"];
  return { data, colors: COLORS };
}

function useDetectionTypeDistribution() {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    anomalies.forEach((a) => {
      counts[a.detectionType] = (counts[a.detectionType] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, []);
  return data;
}

function useStationHealthRanking() {
  const data = useMemo(() => {
    return [...stations]
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, 10)
      .map((s) => ({
        name: s.name,
        score: s.healthScore,
        status: s.status,
      }));
  }, []);
  return data;
}

function useRegionalHeatmap() {
  const data = useMemo(() => {
    return regionStats.map((r) => ({
      region: r.region,
      anomalies: r.activeAnomalies,
      critical: r.criticalStations,
      health: r.healthyObs,
    }));
  }, []);
  return data;
}

function useSensorDegradation() {
  const [seed] = useState(() => Math.random());
  const data = useMemo(() => {
    return stations.slice(0, 8).map((s, i) => ({
      station: s.name.split(" ").slice(0, 2).join(" "),
      drift: +(s.sensorDrift + ((seed * 1000 + i) % 100) / 100 * 0.8).toFixed(2),
      battery: s.batteryLevel,
    }));
  }, [seed]);
  return data;
}

export function Analytics() {
  const [filters, setFilters] = useState({
    dateRange: "7d",
    region: "all",
    parameter: "all",
    detectionMethod: "all",
    stationGroup: "all",
  });

  const [injectedAnomalies, setInjectedAnomalies] = useState<
    { id: string; text: string; time: string }[]
  >([]);
  const [injectionForm, setInjectionForm] = useState({
    station: stations[0]?.id ?? "",
    parameter: "temperature",
    type: "Point spike",
    intensity: "medium",
  });

  const freqData = useAnomalyFrequency();
  const paramDist = useParameterDistribution();
  const detTypeData = useDetectionTypeDistribution();
  const healthData = useStationHealthRanking();
  const regionData = useRegionalHeatmap();
  const degradationData = useSensorDegradation();

  const filteredStations = useMemo(() => {
    let list = stations;
    if (filters.region !== "all") {
      list = list.filter((s) => s.region === filters.region);
    }
    if (filters.stationGroup === "critical") {
      list = list.filter((s) => s.status === "warning" || s.status === "offline");
    }
    if (filters.stationGroup === "maintenance") {
      list = list.filter((s) => s.status === "maintenance");
    }
    return list;
  }, [filters.region, filters.stationGroup]);

  const avgResolutionHours = useMemo(() => {
    const statuses = ["investigating", "resolved"];
    const relevant = anomalies.filter((a) => statuses.includes(a.status));
    if (relevant.length === 0) return 4.2;
    return +(relevant.length * 0.7 + 2.1).toFixed(1);
  }, []);

  const confirmedRate = useMemo(() => {
    const total = anomalies.length;
    const confirmed = anomalies.filter((a) => a.status === "confirmed").length;
    return Math.round((confirmed / total) * 100);
  }, []);

  const falsePositiveRate = useMemo(() => {
    const dismissed = anomalies.filter((a) => a.status === "dismissed").length;
    return Math.round((dismissed / anomalies.length) * 100);
  }, []);

  const handleInject = () => {
    const station = stations.find((s) => s.id === injectionForm.station);
    const id = `INJ-${Date.now().toString(36).toUpperCase()}`;
    const text = `[DEMO] ${injectionForm.type} on ${station?.name ?? injectionForm.station} — ${injectionForm.parameter} (${injectionForm.intensity})`;
    setInjectedAnomalies((prev) => [
      { id, text, time: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  };

  const handleResetStream = () => {
    setInjectedAnomalies([]);
  };

  const modelMetrics = [
    { label: "Detection Precision", value: 0.92, icon: ShieldCheck },
    { label: "Detection Recall", value: 0.88, icon: Zap },
    { label: "Avg Confidence", value: 0.84, icon: Gauge },
    { label: "Human Review Agreement", value: 0.91, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-serif text-2xl font-bold text-ink-navy">
          Patterns behind the alerts
        </h1>
        <p className="text-sm text-graphite/70 max-w-2xl">
          Data-driven insights across station health, detection quality, and anomaly
          trends. Use the controls below to slice by region, parameter, detection
          method, and station group.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {[
          { label: "Date Range", key: "dateRange", type: "select", options: ["1d", "7d", "30d", "90d"] },
          { label: "Region", key: "region", type: "select", options: REGIONS },
          { label: "Parameter", key: "parameter", type: "select", options: ["all", ...PARAMETERS] },
          { label: "Detection Method", key: "detectionMethod", type: "select", options: ["all", ...ANOMALY_TYPES] },
          { label: "Station Group", key: "stationGroup", type: "select", options: ["all", "critical", "maintenance", "active"] },
        ].map((ctrl) => (
          <motion.div key={ctrl.key} variants={item} className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">
              {ctrl.label}
            </label>
            <select
              value={(filters as any)[ctrl.key]}
              onChange={(e) =>
                setFilters((f) => ({ ...f, [ctrl.key]: e.target.value }))
              }
              className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue"
            >
              {ctrl.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Stations", value: filteredStations.length, icon: Activity, accent: "text-deep-atmo" },
          { label: "Avg Health Score", value: Math.round(filteredStations.reduce((a, s) => a + s.healthScore, 0) / (filteredStations.length || 1)), icon: Heart, accent: "text-healthy-green" },
          { label: "Avg Resolution (hrs)", value: avgResolutionHours, icon: Clock, accent: "text-signal-amber" },
          { label: "Active Anomalies", value: anomalies.filter((a) => a.status === "new" || a.status === "investigating").length, icon: AlertTriangle, accent: "text-alert-coral" },
        ].map((kpi) => (
          <motion.div key={kpi.label} variants={item}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-graphite/60">{kpi.label}</p>
                  <p className={cn("mt-1 text-2xl font-bold", kpi.accent)}>{kpi.value}</p>
                </div>
                <kpi.icon className={cn("h-5 w-5", kpi.accent)} />
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Anomaly Frequency Over Time
            </h3>
            <p className="text-xs text-graphite/60 mt-1">
              Detected events per 3h window across filtered stations
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={freqData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" />
                  <XAxis dataKey="time" tick={{ fontSize: 12, fill: "#202124" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#202124" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E8EDF1",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar dataKey="count" fill="#174A6E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Anomaly Distribution by Parameter
            </h3>
            <p className="text-xs text-graphite/60 mt-1">
              Share of anomalies per monitored parameter
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paramDist.data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {paramDist.data.map((entry, index) => (
                      <Cell key={entry.name} fill={paramDist.colors[index % paramDist.colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E8EDF1",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Detection Type Distribution
            </h3>
            <p className="text-xs text-graphite/60 mt-1">
              Horizontal ranking of detection methods across the network
            </p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#202124" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#202124" }} width={140} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E8EDF1",
                    }}
                  />
                  <Bar dataKey="value" fill="#6BAED6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Station Health Ranking
            </h3>
            <p className="text-xs text-graphite/60 mt-1">
              Top 10 stations by health score
            </p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#202124" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#202124" }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E8EDF1",
                    }}
                  />
                  <Bar dataKey="score" fill="#3F8062" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Regional Anomaly Heatmap
            </h3>
            <p className="text-xs text-graphite/60 mt-1">
              Active anomalies and critical stations by region
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {regionData.map((r) => (
                <div
                  key={r.region}
                  className={cn(
                    "rounded-xl border border-cloud-grey p-3 text-center",
                    r.critical > 0 && "border-alert-coral/40 bg-alert-coral/5"
                  )}
                >
                  <p className="text-xs font-medium text-graphite/70">{r.region}</p>
                  <p className="mt-1 text-xl font-bold text-ink-navy">{r.anomalies}</p>
                  <p className="text-[10px] text-graphite/50">anomalies</p>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <div className="h-1.5 w-full rounded-full bg-cloud-grey overflow-hidden">
                      <div
                        className="h-full rounded-full bg-healthy-green"
                        style={{ width: `${r.health}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-graphite/60">{r.health}%</span>
                  </div>
                  {r.critical > 0 && (
                    <Badge variant="destructive" className="mt-2">
                      {r.critical} critical
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Resolution Rates
            </h3>
            <p className="text-xs text-graphite/60 mt-1">
              False-positive vs confirmed anomaly rates
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-graphite/70">Confirmed Anomalies</span>
                  <span className="font-semibold text-ink-navy">{confirmedRate}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-cloud-grey">
                  <div
                    className="h-full rounded-full bg-healthy-green"
                    style={{ width: `${confirmedRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-graphite/70">False Positives</span>
                  <span className="font-semibold text-alert-coral">{falsePositiveRate}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-cloud-grey">
                  <div
                    className="h-full rounded-full bg-alert-coral"
                    style={{ width: `${falsePositiveRate}%` }}
                  />
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center gap-2 text-sm text-graphite/70">
                  <Gauge className="h-4 w-4 text-signal-amber" />
                  <span>Avg confidence across queue: {Math.round(anomalies.reduce((a, c) => a + c.confidence, 0) / anomalies.length)}%</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Sensor Degradation Trend
            </h3>
            <p className="text-xs text-graphite/60 mt-1">
              Drift index and battery level across representative stations
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={degradationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" />
                  <XAxis dataKey="station" tick={{ fontSize: 11, fill: "#202124" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#202124" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#202124" }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E8EDF1",
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="drift"
                    stroke="#D99532"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#D99532" }}
                    name="Drift"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="battery"
                    stroke="#7067A8"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#7067A8" }}
                    name="Battery %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Average Resolution Time
            </h3>
            <p className="text-xs text-graphite/60 mt-1">
              Mean time from detection to closure for active cases
            </p>
            <div className="mt-6 flex flex-col items-center justify-center">
              <div className="relative h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="100%"
                    data={[{ name: "hours", value: Math.min(avgResolutionHours * 10, 100), fill: "#174A6E" }]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      background
                      dataKey="value"
                      cornerRadius={8}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-ink-navy">{avgResolutionHours}</span>
                  <span className="text-xs text-graphite/60">hours</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-graphite/60">
                Based on {anomalies.filter((a) => a.status !== "new").length} resolved/investigating cases
              </p>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-semibold text-ink-navy">
                  Model Performance
                </h3>
                <p className="text-xs text-graphite/60 mt-1">
                  Detection quality and operational metrics for the current model version.
                </p>
              </div>
              <Badge variant="outline">v2.4.1</Badge>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modelMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-cloud-grey p-4">
                  <div className="flex items-center gap-2">
                    <metric.icon className="h-4 w-4 text-sky-blue" />
                    <span className="text-xs text-graphite/70">{metric.label}</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-ink-navy">
                    {(metric.value * 100).toFixed(0)}%
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-cloud-grey">
                    <div
                      className="h-full rounded-full bg-sky-blue"
                      style={{ width: `${metric.value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-graphite/60">
              <span className="inline-flex items-center gap-1 rounded-lg bg-warm-off px-2 py-1">
                <Clock className="h-3 w-3" />
                Last model update: 2026-08-29 04:12 UTC
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-alert-coral/10 px-2 py-1 text-alert-coral">
                <FlaskConical className="h-3 w-3" />
                These are prototype evaluation metrics based on simulated anomaly-injected data.
              </span>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-semibold text-ink-navy">
                  Anomaly Injection Demo
                </h3>
                <p className="text-xs text-graphite/60 mt-1">
                  Simulate an anomaly event and watch it appear in the queue below.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">
                  Station
                </label>
                <select
                  value={injectionForm.station}
                  onChange={(e) =>
                    setInjectionForm((f) => ({ ...f, station: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">
                  Parameter
                </label>
                <select
                  value={injectionForm.parameter}
                  onChange={(e) =>
                    setInjectionForm((f) => ({ ...f, parameter: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue"
                >
                  {PARAMETERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">
                  Anomaly Type
                </label>
                <select
                  value={injectionForm.type}
                  onChange={(e) =>
                    setInjectionForm((f) => ({ ...f, type: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue"
                >
                  {ANOMALY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">
                  Intensity
                </label>
                <select
                  value={injectionForm.intensity}
                  onChange={(e) =>
                    setInjectionForm((f) => ({ ...f, intensity: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-2">
                <Button onClick={handleInject} className="flex-1">
                  <Play className="h-4 w-4" />
                  Inject demo anomaly
                </Button>
                <Button variant="outline" onClick={handleResetStream}>
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-cloud-grey bg-graphite/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-graphite/60 mb-2">
                Anomaly Queue
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {injectedAnomalies.length === 0 ? (
                  <p className="text-xs text-graphite/50">No injected anomalies yet.</p>
                ) : (
                  injectedAnomalies.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg bg-white border border-cloud-grey px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-[10px]">DEMO</Badge>
                        <span className="text-xs text-graphite">{a.text}</span>
                      </div>
                      <span className="text-[10px] text-graphite/50">{a.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}