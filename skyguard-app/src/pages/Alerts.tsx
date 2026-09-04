import { useState } from "react";
import { Check, CircleAlert, Clock, Search } from "lucide-react";
import { alerts } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Alerts() {
  const [query, setQuery] = useState("");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const visible = alerts.filter((alert) => `${alert.stationName} ${alert.message}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6">
    <div><h1 className="font-serif text-2xl font-bold text-ink-navy">Alert center</h1><p className="mt-1 text-sm text-graphite/70">Prioritize and acknowledge active network alerts.</p></div>
    <div className="flex flex-wrap items-center gap-3"><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search alerts..." className="pl-9" /></div><span className="rounded-full bg-alert-coral/10 px-3 py-1.5 text-xs font-semibold text-alert-coral">{visible.length} active</span></div>
    <div className="space-y-3">{visible.map((alert) => { const isAcknowledged = acknowledged.includes(alert.id); return <Card key={alert.id} className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${isAcknowledged ? "opacity-60" : ""}`}><div className="flex gap-3"><CircleAlert className={`mt-0.5 h-5 w-5 shrink-0 ${alert.type === "critical" ? "text-alert-coral" : "text-signal-amber"}`} /><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-ink-navy">{alert.message}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-graphite">{alert.type}</span></div><p className="mt-1 text-sm text-graphite/70">{alert.stationName} · {new Date(alert.timestamp).toLocaleString()}</p></div></div><Button variant="outline" size="sm" disabled={isAcknowledged} onClick={() => setAcknowledged((current) => [...current, alert.id])}>{isAcknowledged ? <><Check className="mr-1.5 h-3.5 w-3.5" /> Acknowledged</> : <><Clock className="mr-1.5 h-3.5 w-3.5" /> Acknowledge</>}</Button></Card>; })}</div>
  </div>;
}
