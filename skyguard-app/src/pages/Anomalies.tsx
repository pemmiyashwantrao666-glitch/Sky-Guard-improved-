import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  CheckCircle2,
  Download,
  X,
  Columns,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { anomalies as allAnomalies } from "@/lib/mock-data";

const STATUSES = ["new", "investigating", "confirmed", "dismissed", "resolved"] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const PARAMETERS = ["temperature", "humidity", "pressure", "communication"] as const;
const DETECTION_TYPES = [
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

const severityConfig = {
  critical: { variant: "destructive" as const, label: "Critical" },
  high: { variant: "warning" as const, label: "High" },
  medium: { variant: "secondary" as const, label: "Medium" },
  low: { variant: "outline" as const, label: "Low" },
};

const statusConfig: Record<string, { variant: "success" | "warning" | "destructive" | "secondary" | "outline"; label: string }> = {
  new: { variant: "outline", label: "New" },
  investigating: { variant: "warning", label: "Investigating" },
  confirmed: { variant: "destructive", label: "Confirmed" },
  dismissed: { variant: "secondary", label: "Dismissed" },
  resolved: { variant: "success", label: "Resolved" },
};

const PAGE_SIZE = 8;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function Anomalies() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [parameterFilter, setParameterFilter] = useState<string>("");
  const [detectionFilter, setDetectionFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [confidenceRange, setConfidenceRange] = useState<string>("");
  const [assignedFilter, setAssignedFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("");

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>("detectedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    station: true,
    parameter: true,
    observedValue: true,
    expectedRange: true,
    detectionType: true,
    severity: true,
    confidence: true,
    detectedAt: true,
    status: true,
    assignedTo: true,
    action: true,
  });

  const regions = useMemo(() => Array.from(new Set(allAnomalies.map((a) => a.state))).sort(), []);
  const assignees = useMemo(() => Array.from(new Set(allAnomalies.map((a) => a.assignedTo).filter(Boolean))).sort(), []);

  const filtered = useMemo(() => {
    return allAnomalies.filter((a) => {
      const matchesSearch =
        !search ||
        a.id.toLowerCase().includes(search.toLowerCase()) ||
        a.stationName.toLowerCase().includes(search.toLowerCase()) ||
        a.parameter.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || a.status === statusFilter;
      const matchesSeverity = !severityFilter || a.severity === severityFilter;
      const matchesParameter = !parameterFilter || a.parameter === parameterFilter;
      const matchesDetection = !detectionFilter || a.detectionType === detectionFilter;
      const matchesRegion = !regionFilter || a.state === regionFilter;
      const matchesConfidence = !confidenceRange || (() => {
        if (confidenceRange === "90-100") return a.confidence >= 90;
        if (confidenceRange === "70-89") return a.confidence >= 70 && a.confidence < 90;
        if (confidenceRange === "50-69") return a.confidence >= 50 && a.confidence < 70;
        return a.confidence < 50;
      })();
      const matchesAssigned = !assignedFilter || a.assignedTo === assignedFilter;
      const matchesDate = !dateRange || (() => {
        const diff = Date.now() - new Date(a.detectedAt).getTime();
        const hours = diff / (1000 * 60 * 60);
        if (dateRange === "24h") return hours <= 24;
        if (dateRange === "7d") return hours <= 168;
        if (dateRange === "30d") return hours <= 720;
        return true;
      })();
      return matchesSearch && matchesStatus && matchesSeverity && matchesParameter && matchesDetection && matchesRegion && matchesConfidence && matchesAssigned && matchesDate;
    });
  }, [search, statusFilter, severityFilter, parameterFilter, detectionFilter, regionFilter, confidenceRange, assignedFilter, dateRange]);

  const sorted = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      if (typeof aVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      return 0;
    });
    return sorted;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pageData.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pageData.map((a) => a.id)));
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setSeverityFilter("");
    setParameterFilter("");
    setDetectionFilter("");
    setRegionFilter("");
    setConfidenceRange("");
    setAssignedFilter("");
    setDateRange("");
    setPage(1);
  };

  const exportCsv = () => {
    const rows = filtered.map((a) => ({
      id: a.id,
      station: a.stationName,
      parameter: a.parameter,
      observed: a.observedValue,
      expected: a.expectedRange,
      detection: a.detectionType,
      severity: a.severity,
      confidence: a.confidence,
      detectedAt: a.detectedAt,
      status: a.status,
      assignedTo: a.assignedTo || "",
    }));
    const csv = [
      Object.keys(rows[0]).join(","),
      ...rows.map((r) => Object.values(r).map((v) => JSON.stringify(v ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anomalies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink-navy">Anomaly queue</h1>
          <p className="mt-1 text-sm text-graphite/70">
            Review signals before they become data-quality incidents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
            <Input
              placeholder="Search anomalies..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 w-64"
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setShowColumns((v) => !v)}>
            <Columns className="h-3.5 w-3.5" />
            Columns
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">Status</label>
                  <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                    <option value="">All</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">Severity</label>
                  <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                    <option value="">All</option>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">Parameter</label>
                  <select value={parameterFilter} onChange={(e) => { setParameterFilter(e.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                    <option value="">All</option>
                    {PARAMETERS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">Detection Type</label>
                  <select value={detectionFilter} onChange={(e) => { setDetectionFilter(e.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                    <option value="">All</option>
                    {DETECTION_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">Region</label>
                  <select value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                    <option value="">All</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">Confidence</label>
                  <select value={confidenceRange} onChange={(e) => { setConfidenceRange(e.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                    <option value="">All</option>
                    <option value="90-100">90% – 100%</option>
                    <option value="70-89">70% – 89%</option>
                    <option value="50-69">50% – 69%</option>
                    <option value="0-49">&lt; 50%</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">Assigned To</label>
                  <select value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                    <option value="">All</option>
                    {assignees.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-graphite/60">Date Range</label>
                  <select value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1); }} className="h-9 w-full rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite">
                    <option value="">All</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-graphite/70" onClick={clearFilters}>
                  <X className="h-3 w-3" />
                  Clear filters
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showColumns && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-graphite/60 mb-2">Visible Columns</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(visibleColumns).map((col) => (
                  <label key={col} className="flex items-center gap-1.5 text-xs text-graphite/80">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col as keyof typeof visibleColumns]}
                      onChange={(e) => setVisibleColumns((v) => ({ ...v, [col]: e.target.checked }))}
                    />
                    {col}
                  </label>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border border-sky-blue/30 bg-sky-blue/5 p-3 text-xs"
        >
          <span className="font-medium text-ink-navy">{selectedIds.size} selected</span>
          <Button variant="outline" size="sm" className="h-7 text-xs">Confirm</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs">Dismiss</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs">Assign</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs">Export</Button>
        </motion.div>
      )}

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-signal-amber" />
            <p className="mt-2 text-sm text-graphite/70">No anomalies match these filters.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Clear filters</Button>
          </Card>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-cloud-grey bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-cloud-grey/70 text-xs uppercase tracking-wide text-graphite/70">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={pageData.length > 0 && selectedIds.size === pageData.length}
                        onChange={toggleAll}
                      />
                    </th>
                    {visibleColumns.id && (
                      <th className="p-3 cursor-pointer" onClick={() => toggleSort("id")}>ID <ArrowUpDown className="inline h-3 w-3" /></th>
                    )}
                    {visibleColumns.station && <th className="p-3">Station</th>}
                    {visibleColumns.parameter && <th className="p-3">Parameter</th>}
                    {visibleColumns.observedValue && <th className="p-3">Observed</th>}
                    {visibleColumns.expectedRange && <th className="p-3 hidden xl:table-cell">Expected Range</th>}
                    {visibleColumns.detectionType && <th className="p-3 hidden lg:table-cell">Detection Type</th>}
                    {visibleColumns.severity && (
                      <th className="p-3 cursor-pointer" onClick={() => toggleSort("severity")}>Severity <ArrowUpDown className="inline h-3 w-3" /></th>
                    )}
                    {visibleColumns.confidence && (
                      <th className="p-3 cursor-pointer hidden sm:table-cell" onClick={() => toggleSort("confidence")}>Confidence <ArrowUpDown className="inline h-3 w-3" /></th>
                    )}
                    {visibleColumns.detectedAt && (
                      <th className="p-3 cursor-pointer hidden md:table-cell" onClick={() => toggleSort("detectedAt")}>Detected <ArrowUpDown className="inline h-3 w-3" /></th>
                    )}
                    {visibleColumns.status && <th className="p-3">Status</th>}
                    {visibleColumns.assignedTo && <th className="p-3 hidden lg:table-cell">Assigned</th>}
                    {visibleColumns.action && <th className="p-3 w-24">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {pageData.map((anomaly) => {
                      const sev = severityConfig[anomaly.severity];
                      const stat = statusConfig[anomaly.status];
                      return (
                        <motion.tr
                          key={anomaly.id}
                          variants={item}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="border-b border-cloud-grey last:border-0 hover:bg-cloud-grey/20 transition-colors"
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(anomaly.id)}
                              onChange={() => toggleSelect(anomaly.id)}
                            />
                          </td>
                          {visibleColumns.id && (
                            <td className="p-3 font-mono text-xs text-graphite/70">{anomaly.id}</td>
                          )}
                          {visibleColumns.station && (
                            <td className="p-3">
                              <span className="font-medium text-ink-navy">{anomaly.stationName}</span>
                              <span className="block text-xs text-graphite/50">{anomaly.state}</span>
                            </td>
                          )}
                          {visibleColumns.parameter && (
                            <td className="p-3 capitalize text-graphite/80">{anomaly.parameter}</td>
                          )}
                          {visibleColumns.observedValue && (
                            <td className="p-3 font-medium text-ink-navy">{anomaly.observedValue}</td>
                          )}
                          {visibleColumns.expectedRange && (
                            <td className="p-3 text-xs text-graphite/60 hidden xl:table-cell">{anomaly.expectedRange}</td>
                          )}
                          {visibleColumns.detectionType && (
                            <td className="p-3 text-xs text-graphite/70 hidden lg:table-cell">{anomaly.detectionType}</td>
                          )}
                          {visibleColumns.severity && (
                            <td className="p-3">
                              <Badge variant={sev.variant} className="capitalize">{sev.label}</Badge>
                            </td>
                          )}
                          {visibleColumns.confidence && (
                            <td className="p-3 hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{anomaly.confidence}%</span>
                                <div className="h-1 w-16 overflow-hidden rounded-full bg-cloud-grey">
                                  <div
                                    className={cn("h-full rounded-full", anomaly.confidence >= 90 ? "bg-healthy-green" : anomaly.confidence >= 70 ? "bg-signal-amber" : "bg-alert-coral")}
                                    style={{ width: `${anomaly.confidence}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          )}
                          {visibleColumns.detectedAt && (
                            <td className="p-3 text-xs text-graphite/60 hidden md:table-cell">
                              {new Date(anomaly.detectedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="p-3">
                              <Badge variant={stat.variant} className="capitalize">{stat.label}</Badge>
                            </td>
                          )}
                          {visibleColumns.assignedTo && (
                            <td className="p-3 text-xs text-graphite/70 hidden lg:table-cell">{anomaly.assignedTo || "—"}</td>
                          )}
                          {visibleColumns.action && (
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => window.open(`/anomalies/${anomaly.id}`, "_blank", "noopener,noreferrer")}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {}}>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-healthy-green" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {}}>
                                  <XCircle className="h-3.5 w-3.5 text-alert-coral" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              <AnimatePresence initial={false}>
                {pageData.map((anomaly) => {
                  const sev = severityConfig[anomaly.severity];
                  const stat = statusConfig[anomaly.status];
                  return (
                    <motion.div
                      key={anomaly.id}
                      variants={item}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl border border-cloud-grey bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-graphite/50">{anomaly.id}</span>
                            <Badge variant={sev.variant} className="capitalize text-[10px]">{sev.label}</Badge>
                          </div>
                          <p className="mt-1 text-sm font-medium text-ink-navy">{anomaly.stationName}</p>
                          <p className="text-xs text-graphite/60 capitalize">{anomaly.parameter} · {anomaly.detectionType}</p>
                        </div>
                        <Badge variant={stat.variant} className="capitalize text-[10px]">{stat.label}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-graphite/70">
                        <span>Observed: {anomaly.observedValue}</span>
                        <span>{anomaly.confidence}%</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 flex-1 text-xs"
                          onClick={() => window.open(`/anomalies/${anomaly.id}`, "_blank", "noopener,noreferrer")}
                        >
                          Review
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">Dismiss</Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-cloud-grey bg-white px-4 py-3">
              <p className="text-xs text-graphite/60">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium text-graphite/70 px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
