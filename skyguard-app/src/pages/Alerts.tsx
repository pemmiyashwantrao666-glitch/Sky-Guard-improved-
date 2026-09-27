import { useState, useEffect } from "react";
import { Check, CircleAlert, Clock, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getNotificationFeed } from "@/lib/edge-api";

interface NotificationEvent {
  id: string;
  time: string;
  kind: string;
  severity: string;
  station: string;
  subject: string;
  body: string;
  email_status: string;
}

export function Alerts() {
  const [query, setQuery] = useState("");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    const res = await getNotificationFeed();
    setLoading(false);
    if (res.ok) {
      setEvents(res.events || []);
      setAdminEmail(res.admin_email || "");
      setSmtpConfigured(res.smtp || false);
    } else {
      setError(res.error || "Failed to load notifications");
    }
  };

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const visible = events.filter((event) =>
    `${event.station} ${event.subject} ${event.body}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "CRITICAL":
        return "text-alert-coral";
      case "WARNING":
        return "text-signal-amber";
      default:
        return "text-sky-blue";
    }
  };

  const getKindLabel = (kind: string) => {
    switch (kind) {
      case "complaint":
        return "Support Case";
      case "edge-anomaly":
        return "Edge Alert";
      case "demo-inject":
        return "Demo Event";
      default:
        return kind;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-navy">Alert center</h1>
        <p className="mt-1 text-sm text-graphite/70">
          Real-time notifications, complaints, and system events
          {!smtpConfigured && " · Email alerts disabled (SMTP not configured)"}
        </p>
      </div>

      {!smtpConfigured && (
        <Card className="border-signal-amber/30 bg-signal-amber/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-signal-amber" />
            <div className="text-sm">
              <p className="font-semibold text-ink-navy">Email notifications disabled</p>
              <p className="mt-1 text-graphite/70">
                Configure SMTP credentials in <code className="rounded bg-slate-100 px-1 py-0.5">gateway/.env</code> to enable email delivery to <strong>{adminEmail}</strong>
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite/40" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search alerts..."
            className="pl-9"
          />
        </div>
        <span className="rounded-full bg-alert-coral/10 px-3 py-1.5 text-xs font-semibold text-alert-coral">
          {visible.length} active
        </span>
        <Button variant="outline" size="sm" onClick={loadFeed} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-alert-coral/30 bg-alert-coral/5 p-4">
          <p className="text-sm text-alert-coral">{error}</p>
        </Card>
      )}

      {loading && events.length === 0 ? (
        <Card className="p-8 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-graphite/40" />
          <p className="mt-2 text-sm text-graphite/70">Loading notifications...</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center">
          <CircleAlert className="mx-auto h-12 w-12 text-graphite/20" />
          <p className="mt-2 text-sm text-graphite/70">
            {query ? "No matching notifications" : "No active alerts"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((event) => {
            const isAcknowledged = acknowledged.includes(event.id);
            return (
              <Card
                key={event.id}
                className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between ${
                  isAcknowledged ? "opacity-60" : ""
                }`}
              >
                <div className="flex gap-3">
                  <CircleAlert
                    className={`mt-0.5 h-5 w-5 shrink-0 ${getSeverityColor(event.severity)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ink-navy">{event.subject}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-graphite">
                        {getKindLabel(event.kind)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          event.severity === "CRITICAL"
                            ? "bg-alert-coral/10 text-alert-coral"
                            : event.severity === "WARNING"
                            ? "bg-signal-amber/10 text-signal-amber"
                            : "bg-sky-blue/10 text-sky-blue"
                        }`}
                      >
                        {event.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-graphite/70">
                      {event.station} · {new Date(event.time).toLocaleString()}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-graphite">
                      {event.body.length > 200
                        ? `${event.body.substring(0, 200)}...`
                        : event.body}
                    </p>
                    <p className="mt-2 text-xs text-graphite/60">
                      Email: <span className="font-mono">{event.email_status}</span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isAcknowledged}
                  onClick={() => setAcknowledged((current) => [...current, event.id])}
                  className="shrink-0"
                >
                  {isAcknowledged ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Acknowledged
                    </>
                  ) : (
                    <>
                      <Clock className="mr-1.5 h-3.5 w-3.5" /> Acknowledge
                    </>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
