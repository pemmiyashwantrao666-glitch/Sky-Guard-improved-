import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, RefreshCw, Loader2, ChevronRight, XCircle, FlaskConical, Square, Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAllStationsBase } from "@/lib/station-service";
import {
  fetchEdgeLatestAll, getEdgeApiBaseUrl, fetchEdgeHealth,
  startEdgeSimulation, stopEdgeSimulation,
} from "@/lib/edge-api";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { StationBase } from "@/lib/station-service";
import type { EdgeReading } from "@/lib/edge-api";

type Row = { base: StationBase; reading: EdgeReading | null };

export function EdgeNodes() {
  const edgeStations = useMemo(() => getAllStationsBase().filter((s) => s.source === "edge"), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [simOn, setSimOn] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const apiBase = getEdgeApiBaseUrl();
  useEffect(() => {
    setRows(edgeStations.map((base) => ({ base, reading: null })));
    let dead = false;
    fetchEdgeHealth().then((h) => { if (!dead && h) setSimOn(Boolean(h.sim?.running)); });
    fetchEdgeLatestAll().then((all) => {
      if (dead) return;
      const byId = new Map(all.map((r) => [r.station_id, r]));
      setRows(edgeStations.map((base) => ({ base, reading: byId.get(base.id) ?? null })));
      setOnline(all.length > 0);
      setLoading(false);
    }).catch(() => { if (!dead) { setOnline(false); setLoading(false); } });
    return () => { dead = true; };
  }, [edgeStations]);

  async function replay() {
    setBusy(true);
    try {
      const b = edgeStations[0];
      await fetch(`${apiBase}/api/edge/ingest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station_id: b ? b.id : "EDGE-PUNE-01", ts: new Date().toISOString(), t: 27.4, h: 62.1, p: 1008.2, score: 0.12, verdict: "NORMAL", root_cause: "replay-test", fw: "skyguard-edge-v2" }),
        signal: AbortSignal.timeout(8000),
      });
      const all = await fetchEdgeLatestAll();
      const byId = new Map(all.map((r) => [r.station_id, r]));
      setRows(edgeStations.map((base) => ({ base, reading: byId.get(base.id) ?? null })));
      setOnline(true);
    } catch { setOnline(false); }
    setBusy(false);
  }
  async function refreshRows() {
    const all = await fetchEdgeLatestAll();
    const byId = new Map(all.map((r) => [r.station_id, r]));
    setRows(edgeStations.map((base) => ({ base, reading: byId.get(base.id) ?? null })));
    setOnline(all.length > 0);
  }
  async function toggleSim() {
    setSimBusy(true);
    if (simOn) {
      await stopEdgeSimulation();
      setSimOn(false);
    } else {
      const res = await startEdgeSimulation({ hours: 24, interval: 5, live: true });
      if (res.ok) { setSimOn(true); await refreshRows(); }
    }
    setSimBusy(false);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-bold text-ink-navy"><Cpu className="h-6 w-6 text-deep-atmo" />Edge AI Nodes</h1>
          <p className="mt-1 text-sm text-graphite/70">{rows.length} physical ESP32 stations via {apiBase} · no hardware? use “Simulate demo data”.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {simOn && (
            <Badge variant="warning" className="gap-1"><Radio className="h-3 w-3 animate-pulse" /> DEMO SIM LIVE</Badge>
          )}
          <Button variant="outline" size="sm" onClick={toggleSim} disabled={simBusy}>
            {simBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : simOn ? <Square className="mr-2 h-4 w-4" /> : <FlaskConical className="mr-2 h-4 w-4" />}
            {simOn ? "Stop simulation" : "Simulate demo data"}
          </Button>
          <Button variant="outline" size="sm" onClick={replay} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Replay test</Button>
        </div>
      </div>
      {!online && !loading && (
        <Card className="border-signal-amber/40 bg-signal-amber/5 p-5">
          <div className="flex items-start gap-3"><XCircle className="mt-0.5 h-5 w-5 text-signal-amber" />
          <div><h2 className="font-semibold text-ink-navy">Gateway offline</h2>
          <code className="mt-2 block w-fit rounded bg-slate-900 px-3 py-1.5 font-mono text-xs text-white">python gateway/server.py --port 3101</code></div></div>
        </Card>
      )}
      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-12 text-sm text-graphite/60"><Loader2 className="h-5 w-5 animate-spin" />Loading…</Card>
      ) : (
        <div className="grid gap-4">
          {rows.map(({ base, reading }) => (
            <Card key={base.id} className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", reading ? "bg-healthy-green" : "bg-slate-300")} />
                    <span className="font-semibold text-ink-navy">{base.name}</span>
                    <span className="font-mono text-xs text-graphite/50">{base.id}</span>
                    {reading ? <Badge variant={reading.verdict === "ANOMALY" ? "destructive" : reading.verdict === "WARNING" ? "warning" : "success"}>EDGE {reading.verdict}</Badge> : <Badge variant="outline">EDGE NO DATA</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-graphite/60">{base.district}, {base.state}</p>
                  {reading && <p className="mt-1 text-xs text-graphite/60">score {reading.score.toFixed(2)} · {reading.root_cause} · {timeAgo(reading.received_at || reading.ts)}</p>}
                </div>
                <Link to={`/stations/${base.id}`}><Button variant="outline" size="sm">Open profile <ChevronRight className="ml-1 h-4 w-4" /></Button></Link>
              </div>
              {reading && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-cloud-grey p-3"><p className="text-[11px] text-graphite/60">TEMP</p><p className="text-xl font-bold">{reading.t.toFixed(1)}C</p></div>
                  <div className="rounded-xl border border-cloud-grey p-3"><p className="text-[11px] text-graphite/60">HUMIDITY</p><p className="text-xl font-bold">{reading.h.toFixed(1)}%</p></div>
                  <div className="rounded-xl border border-cloud-grey p-3"><p className="text-[11px] text-graphite/60">PRESSURE</p><p className="text-xl font-bold">{reading.p.toFixed(1)}</p></div>
                  <div className="rounded-xl border border-cloud-grey p-3"><p className="text-[11px] text-graphite/60">SCORE</p><p className="text-xl font-bold">{reading.score.toFixed(2)}</p></div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Card className="p-5">
        <h2 className="font-semibold text-ink-navy">Flash a new node</h2>
        <p className="mt-2 text-sm text-graphite/70">edge_ai/esp32/skyguard_edge.ino · BME280 SDA-21 SCL-22 · 115200 baud · set WIFI_SSID, GATEWAY_URL, STATION_ID.</p>
      </Card>
    </div>
  );
}
