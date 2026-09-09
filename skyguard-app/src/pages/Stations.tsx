import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudSun, Search, SlidersHorizontal, MapPin, Gauge, Wifi, WifiOff, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { stations, demoAlerts as alerts, demoMaintenanceTasks as maintenanceTasks } from "@/lib/mock-data";
import { ImdWeatherPanel } from "@/components/imd/imd-weather-panel";

const statusConfig = {
  active: { label: "Active", variant: "success" as const, icon: Wifi },
  warning: { label: "Warning", variant: "warning" as const, icon: SlidersHorizontal },
  offline: { label: "Offline", variant: "destructive" as const, icon: WifiOff },
  maintenance: { label: "Maintenance", variant: "secondary" as const, icon: Wrench },
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function Stations() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  const uniqueStates = useMemo(() => Array.from(new Set(stations.map((s) => s.state))).sort(), []);
  const uniqueRegions = useMemo(() => Array.from(new Set(stations.map((s) => s.region))).sort(), []);

  const filtered = useMemo(() => {
    return stations.filter((station) => {
      const matchesSearch =
        !search ||
        station.name.toLowerCase().includes(search.toLowerCase()) ||
        station.id.toLowerCase().includes(search.toLowerCase());
      const matchesState = !stateFilter || station.state === stateFilter;
      const matchesStatus = !statusFilter || station.status === statusFilter;
      const matchesRegion = !regionFilter || station.region === regionFilter;
      return matchesSearch && matchesState && matchesStatus && matchesRegion;
    });
  }, [search, stateFilter, statusFilter, regionFilter]);

  const total = stations.length;
  const online = stations.filter((s) => s.status === "active").length;
  const offline = stations.filter((s) => s.status === "offline").length;
  const maintenance = stations.filter((s) => s.status === "maintenance").length;

  const getAlertCount = (stationId: string) =>
    alerts.filter((a) => a.stationId === stationId).length;

  const getMaintenanceDate = (stationId: string) => {
    const task = maintenanceTasks.find((t) => t.stationId === stationId);
    return task ? new Date(task.dueDate).toLocaleDateString("en-IN") : "—";
  };

  const clearFilters = () => {
    setSearch("");
    setStateFilter("");
    setStatusFilter("");
    setRegionFilter("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-navy">Weather Stations</h1>
        <p className="text-sm text-graphite/60">
          Monitor and manage your Automatic Weather Station network.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-graphite/60 uppercase tracking-wide">Total Stations</p>
          <p className="mt-1 text-2xl font-bold text-ink-navy">{total.toLocaleString("en-IN")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-graphite/60 uppercase tracking-wide">Online</p>
          <p className="mt-1 text-2xl font-bold text-healthy-green">{online.toLocaleString("en-IN")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-graphite/60 uppercase tracking-wide">Offline</p>
          <p className="mt-1 text-2xl font-bold text-alert-coral">{offline.toLocaleString("en-IN")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-graphite/60 uppercase tracking-wide">Maintenance</p>
          <p className="mt-1 text-2xl font-bold text-signal-amber">{maintenance.toLocaleString("en-IN")}</p>
        </Card>
      </div>

      <Tabs defaultValue="network" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="network" className="gap-1.5">
            <MapPin className="h-4 w-4" />
            Network Stations
          </TabsTrigger>
          <TabsTrigger value="imd" className="gap-1.5">
            <CloudSun className="h-4 w-4" />
            IMD Weather
          </TabsTrigger>
        </TabsList>

        <TabsContent value="network">
          <Card className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
                <Input
                  placeholder="Search stations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="h-10 rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2"
              >
                <option value="">All States</option>
                {uniqueStates.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="warning">Warning</option>
                <option value="offline">Offline</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="h-10 rounded-lg border border-cloud-grey bg-white px-3 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2"
              >
                <option value="">All Regions</option>
                {uniqueRegions.map((region) => (
                  <option key={region} value={region}>{region.charAt(0).toUpperCase() + region.slice(1)}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={clearFilters}>Clear</Button>
            </div>
          </Card>

          <motion.div variants={container} initial="hidden" animate="show" className="space-y-3 mt-4">
            <AnimatePresence>
              {filtered.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-sm text-graphite/60">No stations match your filters.</p>
                </Card>
              ) : (
                filtered.map((station) => {
                  const config = statusConfig[station.status];
                  const StatusIcon = config.icon;
                  const alertCount = getAlertCount(station.id);
                  const maintenanceDate = getMaintenanceDate(station.id);

                  return (
                    <motion.div key={station.id} variants={item} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                      <Card className="p-0 transition-colors hover:border-sky-blue/50">
                        <a href={`/stations/${station.id}`} className="block">
                          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(180px,1.4fr)_minmax(145px,1fr)_110px_75px_125px_90px_90px] lg:items-center lg:gap-5">
                            <div className="min-w-0 space-y-3 lg:space-y-0">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-mono text-xs text-graphite/50">{station.id}</p>
                                  <p className="font-medium text-ink-navy">{station.name}</p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                              <div className="flex items-center gap-1.5 text-graphite/70">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{station.state}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-graphite/70">
                                <Gauge className="h-3.5 w-3.5" />
                                <span>{station.elevation}m</span>
                              </div>
                            </div>

                            <div>
                              <Badge variant={config.variant} className="gap-1.5">
                                <StatusIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                            </div>

                            <div>
                              <span className={`font-semibold ${station.healthScore >= 85 ? "text-healthy-green" : station.healthScore >= 70 ? "text-signal-amber" : "text-alert-coral"}`}>
                                {station.healthScore}%
                              </span>
                            </div>

                            <div>
                              <span className="text-xs text-graphite/60">
                                {new Date(station.lastSync).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                              </span>
                            </div>

                            <div>
                              {alertCount > 0 ? (
                                <Badge variant="destructive" className="text-xs">{alertCount} active</Badge>
                              ) : (
                                <span className="text-xs text-graphite/40">None</span>
                              )}
                            </div>

                            <div>
                              <span className="text-xs text-graphite/60">{maintenanceDate}</span>
                            </div>
                          </div>
                        </a>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </motion.div>
        </TabsContent>

        <TabsContent value="imd">
          <ImdWeatherPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}