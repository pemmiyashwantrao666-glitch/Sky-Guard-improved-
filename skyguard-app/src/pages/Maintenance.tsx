import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  UserPlus,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { demoMaintenanceTasks as maintenanceTasks, demoAnomalies as anomalies, stations } from "@/lib/mock-data";

const PRIORITIES = ["high", "medium", "low"] as const;
const STATUSES = ["pending", "completed"] as const;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function Maintenance() {
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [stationFilter, setStationFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stationsWithRepeatedFaults = useMemo(() => {
    const faultCounts: Record<string, number> = {};
    anomalies.forEach((a) => {
      if (a.status !== "resolved" && a.status !== "dismissed") {
        faultCounts[a.stationId] = (faultCounts[a.stationId] || 0) + 1;
      }
    });
    return Object.entries(faultCounts).filter(([, count]) => count >= 2).length;
  }, []);

  const stationsAtRisk = useMemo(() => {
    return stations.filter((s) => s.healthScore < 60 || s.status === "offline" || s.status === "warning").length;
  }, []);

  const avgResolution = useMemo(() => {
    const resolved = anomalies.filter((a) => a.status === "resolved");
    if (resolved.length === 0) return "—";
    const totalHours = resolved.length * 4.2;
    return `${totalHours.toFixed(1)}h`;
  }, []);

  const filtered = useMemo(() => {
    return maintenanceTasks.filter((t) => {
      const matchesPriority = !priorityFilter || t.priority === priorityFilter;
      const matchesStatus = !statusFilter || (statusFilter === "pending" ? !t.completed : t.completed);
      const matchesStation = !stationFilter || t.stationId === stationFilter;
      const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.stationName.toLowerCase().includes(search.toLowerCase());
      return matchesPriority && matchesStatus && matchesStation && matchesSearch;
    });
  }, [priorityFilter, statusFilter, stationFilter, search]);

  const priorityConfig = {
    high: { variant: "destructive" as const, label: "High" },
    medium: { variant: "warning" as const, label: "Medium" },
    low: { variant: "success" as const, label: "Low" },
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-navy">Maintenance</h1>
        <p className="mt-1 text-sm text-graphite/70">
          Convert anomaly signals into practical maintenance work.
        </p>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Maintenance Due", value: maintenanceTasks.filter((t) => !t.completed).length, icon: Wrench, color: "text-signal-amber" },
          { label: "Open Work Orders", value: maintenanceTasks.filter((t) => !t.completed).length, icon: Clock, color: "text-sky-blue" },
          { label: "Repeated Fault Stations", value: stationsWithRepeatedFaults, icon: TrendingUp, color: "text-alert-coral" },
          { label: "Avg Resolution Time", value: avgResolution, icon: Activity, color: "text-deep-atmo" },
          { label: "Stations At Risk", value: stationsAtRisk, icon: AlertTriangle, color: "text-healthy-green" },
        ].map((kpi) => (
          <motion.div key={kpi.label} variants={item}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-graphite/60">{kpi.label}</p>
                  <p className={cn("mt-1 text-2xl font-bold", kpi.color)}>{kpi.value}</p>
                </div>
                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite"
          >
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="h-9 rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite"
          >
            <option value="">All Stations</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </Card>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-graphite/60">No maintenance tasks match your filters.</p>
          </Card>
        ) : (
          filtered.map((task) => {
            const pri = priorityConfig[task.priority];
            const isExpanded = expandedId === task.id;
            const linkedAnomaly = task.anomalyId ? anomalies.find((a) => a.id === task.anomalyId) : null;

            return (
              <motion.div
                key={task.id}
                variants={item}
                className="overflow-hidden rounded-xl border border-cloud-grey bg-white"
              >
                <div
                  className="grid cursor-pointer gap-3 p-4 lg:grid-cols-[minmax(280px,1fr)_180px_90px] lg:items-center lg:gap-6"
                  onClick={() => toggleExpand(task.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-graphite/50">{task.id}</span>
                      <Badge variant={pri.variant} className="text-[10px]">{pri.label}</Badge>
                      <span className={cn("text-[10px] font-medium", task.completed ? "text-healthy-green" : "text-signal-amber")}>
                        {task.completed ? "Completed" : "Open"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-ink-navy">{task.title}</p>
                    <p className="text-xs text-graphite/60">{task.stationName} · Due {new Date(task.dueDate).toLocaleDateString()}</p>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-xs text-graphite/60">Assigned: {task.assignedTo}</span>
                  </div>

                  <div className="flex items-center gap-2 lg:justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {!task.completed && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); }}>
                        <CheckCircle2 className="h-4 w-4 text-healthy-green" />
                      </Button>
                    )}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-cloud-grey bg-cloud-grey/20 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-graphite/60">Task Details</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-graphite/50">Task ID</span>
                                <p className="font-medium text-ink-navy">{task.id}</p>
                              </div>
                              <div>
                                <span className="text-graphite/50">Priority</span>
                                <p className="font-medium text-ink-navy capitalize">{task.priority}</p>
                              </div>
                              <div>
                                <span className="text-graphite/50">Assignee</span>
                                <p className="font-medium text-ink-navy">{task.assignedTo}</p>
                              </div>
                              <div>
                                <span className="text-graphite/50">Due Date</span>
                                <p className="font-medium text-ink-navy">{new Date(task.dueDate).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>

                          {linkedAnomaly && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-graphite/60">Linked Anomaly</p>
                              <div className="rounded-lg border border-cloud-grey bg-white p-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-xs text-graphite/50">{linkedAnomaly.id}</span>
                                  <Badge variant={linkedAnomaly.severity === "critical" ? "destructive" : linkedAnomaly.severity === "high" ? "warning" : "secondary"} className="text-[10px] capitalize">
                                    {linkedAnomaly.severity}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs font-medium text-ink-navy">{linkedAnomaly.detectionType}</p>
                                <p className="mt-1 text-xs text-graphite/70">{linkedAnomaly.parameter}: {linkedAnomaly.observedValue}</p>
                                <p className="mt-1 text-xs text-graphite/60">{linkedAnomaly.explanation}</p>
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-[10px] text-graphite/50">Confidence: {linkedAnomaly.confidence}%</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <Button size="sm" className="h-8 text-xs gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark Complete
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                            <UserPlus className="h-3.5 w-3.5" />
                            Reassign
                          </Button>
                          {linkedAnomaly && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => window.open(`/anomalies/${linkedAnomaly.id}`, "_blank", "noopener,noreferrer")}
                            >
                              View Anomaly
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
