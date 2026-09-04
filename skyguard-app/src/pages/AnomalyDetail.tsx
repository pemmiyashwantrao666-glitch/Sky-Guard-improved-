import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Thermometer,
  Droplets,
  Gauge,
  Radio,
  Activity,
  ArrowLeft,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  FileText,
  Clock,
  User,
  Wrench,
  MessageSquare,
  ShieldCheck,
  ShieldX,
  ThumbsUp,
  ClipboardList,
  Send,
  Cloud,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getAnomalyById,
  getStationById,
  stations as allStations,
} from "@/lib/mock-data";

const severityConfig = {
  critical: {
    color: "bg-alert-coral",
    textColor: "text-alert-coral",
    border: "border-alert-coral/20",
    bgLight: "bg-alert-coral/10",
    icon: AlertTriangle,
  },
  high: {
    color: "bg-signal-amber",
    textColor: "text-signal-amber",
    border: "border-signal-amber/20",
    bgLight: "bg-signal-amber/10",
    icon: AlertTriangle,
  },
  medium: {
    color: "bg-sky-blue",
    textColor: "text-sky-blue",
    border: "border-sky-blue/20",
    bgLight: "bg-sky-blue/10",
    icon: Activity,
  },
  low: {
    color: "bg-healthy-green",
    textColor: "text-healthy-green",
    border: "border-healthy-green/20",
    bgLight: "bg-healthy-green/10",
    icon: CheckCircle,
  },
};

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  new: { label: "New", color: "text-deep-atmo", bg: "bg-deep-atmo/10" },
  investigating: {
    label: "Investigating",
    color: "text-signal-amber",
    bg: "bg-signal-amber/10",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-alert-coral",
    bg: "bg-alert-coral/10",
  },
  dismissed: {
    label: "Dismissed",
    color: "text-healthy-green",
    bg: "bg-healthy-green/10",
  },
  resolved: {
    label: "Resolved",
    color: "text-healthy-green",
    bg: "bg-healthy-green/10",
  },
};

const parameterIcons: Record<string, any> = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  communication: Radio,
};

const timeRanges = [
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function AnomalyDetail() {
  const { id } = useParams<{ id: string }>();
  const [timeRange, setTimeRange] = useState(24);
  const [selectedParams, setSelectedParams] = useState<string[]>([
    "temperature",
  ]);
  const [status, setStatus] = useState("new");
  const [note, setNote] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const anomaly = useMemo(
    () => (id ? getAnomalyById(id) : undefined),
    [id]
  );

  const station = useMemo(
    () => (anomaly ? getStationById(anomaly.stationId) : undefined),
    [anomaly]
  );

  const nearbyStations = useMemo(() => {
    if (!station) return [];
    return allStations
      .filter((s) => s.id !== station.id)
      .map((s) => {
        const latDiff = Math.abs(s.latitude - station.latitude);
        const lonDiff = Math.abs(s.longitude - station.longitude);
        const distance = Math.sqrt(latDiff ** 2 + lonDiff ** 2);
        return { ...s, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [station]);

  const chartData = useMemo(() => {
    if (!anomaly?.readingHistory) return [];
    return anomaly.readingHistory.map((r) => ({
      ...r,
      time: new Date(r.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      date: new Date(r.timestamp).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [anomaly]);

  if (!anomaly) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-signal-amber" />
          <h2 className="mt-4 font-serif text-xl font-semibold text-ink-navy">
            Anomaly not found
          </h2>
          <p className="mt-2 text-sm text-graphite/60">
            The requested anomaly could not be located.
          </p>
          <Link to="/anomalies">
            <Button className="mt-4" variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Anomalies
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const sev = severityConfig[anomaly.severity];
  const SeverityIcon = sev.icon;
  const ParamIcon = parameterIcons[anomaly.parameter] || Activity;

  const auditTrail = [
    {
      id: "evt-1",
      type: "detection",
      user: "SKYGUARD System",
      action: `Detected ${anomaly.detectionType.toLowerCase()} anomaly`,
      timestamp: anomaly.detectedAt,
      detail: `Confidence: ${anomaly.confidence}%`,
    },
    {
      id: "evt-2",
      type: "status",
      user: "System",
      action: "Status changed to New",
      timestamp: anomaly.detectedAt,
      detail: "Automated triage",
    },
    {
      id: "evt-3",
      type: "assignment",
      user: "Auto-assign",
      action: `Assigned to ${anomaly.assignedTo || "Unassigned"}`,
      timestamp: anomaly.detectedAt,
      detail: "Round-robin assignment",
    },
    ...(anomaly.correctedValue
      ? [
          {
            id: "evt-4",
            type: "correction",
            user: anomaly.assignedTo || "Analyst",
            action: `Suggested corrected value: ${anomaly.correctedValue}`,
            timestamp: new Date(
              new Date(anomaly.detectedAt).getTime() + 1000 * 60 * 15
            ).toISOString(),
            detail: "Pending approval",
          },
        ]
      : []),
  ];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="space-y-6"
    >
      <motion.div variants={item} className="flex items-center gap-2 text-sm">
        <Link
          to="/anomalies"
          className="flex items-center gap-1 text-graphite/60 hover:text-ink-navy"
        >
          <ArrowLeft className="h-4 w-4" />
          Anomalies
        </Link>
        <span className="text-graphite/30">/</span>
        <span className="font-medium text-ink-navy">{anomaly.id}</span>
      </motion.div>

      <motion.div
        variants={item}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl",
              sev.bgLight
            )}
          >
            <SeverityIcon className={cn("h-6 w-6", sev.textColor)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-ink-navy">
                {anomaly.detectionType}
              </h1>
              <Badge variant="destructive" className="capitalize">
                {anomaly.severity}
              </Badge>
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-graphite/60">
              <ParamIcon className="h-4 w-4" />
              <span className="capitalize">{anomaly.parameter}</span>
              <span>·</span>
              <span>{anomaly.stationName}</span>
              <span>·</span>
              <span>{anomaly.state}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
            >
              More
              <ChevronDown className="h-4 w-4" />
            </Button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-cloud-grey bg-white py-1 shadow-lg">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-graphite hover:bg-cloud-grey/50">
                  <FileText className="h-4 w-4" />
                  Export report
                </button>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-graphite hover:bg-cloud-grey/50">
                  <Send className="h-4 w-4" />
                  Share link
                </button>
              </div>
            )}
          </div>
          <Button size="sm" variant="default">
            <User className="mr-2 h-4 w-4" />
            Assign
          </Button>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-cloud-grey bg-white px-3 py-2 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue"
          >
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-l-4 border-l-alert-coral bg-gradient-to-r from-alert-coral/5 to-transparent">
          <div className="p-6">
            <h2 className="font-serif text-lg font-semibold text-ink-navy">
              Temperature spike detected at AWS MH-042
            </h2>
            <p className="mt-1 text-sm text-graphite/60">
              {anomaly.stationName} · {anomaly.stationId} · {anomaly.state}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-graphite/50">Observed value</p>
                <p className="mt-1 text-2xl font-bold text-alert-coral">
                  {anomaly.observedValue}
                </p>
              </div>
              <div>
                <p className="text-xs text-graphite/50">Expected range</p>
                <p className="mt-1 text-lg font-semibold text-healthy-green">
                  {anomaly.expectedRange}
                </p>
              </div>
              <div>
                <p className="text-xs text-graphite/50">Confidence</p>
                <p className="mt-1 text-2xl font-bold text-ink-navy">
                  {anomaly.confidence}%
                </p>
              </div>
              <div>
                <p className="text-xs text-graphite/50">Detected at</p>
                <p className="mt-1 text-lg font-semibold text-graphite">
                  {new Date(anomaly.detectedAt).toLocaleString()}
                </p>
              </div>
            </div>
            {anomaly.correctedValue && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-healthy-green/20 bg-healthy-green/10 px-3 py-2">
                <ThumbsUp className="h-4 w-4 text-healthy-green" />
                <span className="text-sm font-medium text-healthy-green">
                  Corrected value: {anomaly.correctedValue}
                </span>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Explanation
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-graphite/80">
              {anomaly.explanation}
            </p>
            <p className="mt-3 text-xs text-graphite/40 italic">
              Prototype model explanation.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Evidence
            </h3>

            <div className="mt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-graphite">
                    Time-Series Chart
                  </h4>
                  <div className="flex items-center gap-1 rounded-lg border border-cloud-grey p-0.5">
                    {timeRanges.map((range) => (
                      <button
                        key={range.hours}
                        onClick={() => setTimeRange(range.hours)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs transition-colors",
                          timeRange === range.hours
                            ? "bg-deep-atmo text-white"
                            : "text-graphite/60 hover:text-graphite"
                        )}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E8EDF1"
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11, fill: "#202124" }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#202124" }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #E8EDF1",
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="expectedTemp"
                        stroke="#3F8062"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        name="Expected"
                        dot={false}
                      />
                      {selectedParams.includes("temperature") && (
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          stroke="#102A43"
                          strokeWidth={2}
                          name="Observed"
                          dot={false}
                          activeDot={{ r: 5, fill: "#C85D3A" }}
                        />
                      )}
                      {anomaly.correctedValue &&
                        selectedParams.includes("temperature") && (
                          <Line
                            type="monotone"
                            dataKey="correctedTemp"
                            stroke="#7067A8"
                            strokeWidth={2}
                            strokeDasharray="3 3"
                            name="Corrected"
                            dot={false}
                          />
                        )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["temperature", "humidity", "pressure"].map((param) => (
                    <button
                      key={param}
                      onClick={() =>
                        setSelectedParams((prev) =>
                          prev.includes(param)
                            ? prev.filter((p) => p !== param)
                            : [...prev, param]
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                        selectedParams.includes(param)
                          ? "border-deep-atmo bg-deep-atmo/10 text-deep-atmo"
                          : "border-cloud-grey text-graphite/60 hover:text-graphite"
                      )}
                    >
                      {param}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-graphite">
                  Multivariate Context
                </h4>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E8EDF1"
                      />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11, fill: "#202124" }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: "#202124" }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "#202124" }}
                      />
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
                        dataKey="temperature"
                        stroke="#102A43"
                        strokeWidth={2}
                        dot={false}
                        name="Temperature"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="pressure"
                        stroke="#7067A8"
                        strokeWidth={2}
                        dot={false}
                        name="Pressure"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="humidity"
                        stroke="#6BAED6"
                        strokeWidth={2}
                        dot={false}
                        name="Humidity"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-graphite">
                  Spatial Comparison
                </h4>
                <p className="mt-1 text-xs text-graphite/50">
                  Nearby station readings at detection time
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {nearbyStations.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border border-cloud-grey bg-white p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink-navy">
                          {s.name}
                        </span>
                        <Badge
                          variant={
                            s.status === "active"
                              ? "success"
                              : s.status === "warning"
                                ? "warning"
                                : "secondary"
                          }
                          className="capitalize"
                        >
                          {s.status}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-graphite/50">
                        {s.distance.toFixed(2)}° away
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-graphite/40">Temp</span>
                          <p className="font-medium">{s.temperature}°C</p>
                        </div>
                        <div>
                          <span className="text-graphite/40">Hum</span>
                          <p className="font-medium">{s.humidity}%</p>
                        </div>
                        <div>
                          <span className="text-graphite/40">Pres</span>
                          <p className="font-medium">{s.pressure} hPa</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-graphite">
                  Detection Reasoning
                </h4>
                <p className="mt-1 text-xs text-graphite/50">
                  Prototype model explanation.
                </p>
                <div className="mt-4 space-y-3">
                  {anomaly.shapFeatures.map((feat, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-graphite/80">{feat.feature}</span>
                        <span className="font-medium text-ink-navy">
                          {(feat.contribution * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-cloud-grey">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${feat.contribution * 100}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className="h-full rounded-full bg-deep-atmo"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item} className="space-y-6">
          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Recommended Actions
            </h3>
            <ul className="mt-4 space-y-3">
              {[
                "Inspect sensor housing for damage",
                "Compare with regional climatology",
                "Verify communication logs",
                "Schedule recalibration if needed",
              ].map((action, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border border-cloud-grey p-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-blue/10">
                    <span className="text-xs font-medium text-sky-blue">
                      {idx + 1}
                    </span>
                  </div>
                  <span className="text-sm text-graphite/80">{action}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Actions
            </h3>
            <div className="mt-4 space-y-2">
              <Button className="w-full justify-start" variant="default">
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm anomaly
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Cloud className="mr-2 h-4 w-4" />
                Mark as valid weather event
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <ShieldX className="mr-2 h-4 w-4" />
                Dismiss as false positive
              </Button>
              {anomaly.correctedValue && (
                <Button className="w-full justify-start" variant="secondary">
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approve corrected value
                </Button>
              )}
              <Button className="w-full justify-start" variant="outline">
                <Wrench className="mr-2 h-4 w-4" />
                Create maintenance ticket
              </Button>
            </div>
            <div className="mt-4">
              <Input
                placeholder="Add a note..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mb-2"
              />
              <Button size="sm" className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                Add note
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold text-ink-navy">
              Audit Trail
            </h3>
            <div className="mt-4 space-y-4">
              {auditTrail.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-3 border-l-2 border-cloud-grey pl-4"
                >
                  <div className="mt-0.5">
                    {event.type === "detection" && (
                      <Activity className="h-4 w-4 text-alert-coral" />
                    )}
                    {event.type === "status" && (
                      <ShieldCheck className="h-4 w-4 text-sky-blue" />
                    )}
                    {event.type === "assignment" && (
                      <User className="h-4 w-4 text-violet" />
                    )}
                    {event.type === "correction" && (
                      <ClipboardList className="h-4 w-4 text-healthy-green" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-graphite">
                      {event.action}
                    </p>
                    <p className="text-xs text-graphite/50">{event.detail}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-graphite/40">
                      <span>{event.user}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
