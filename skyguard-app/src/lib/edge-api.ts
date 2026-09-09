const configured = (import.meta.env.VITE_EDGE_API_URL as string | undefined)?.trim();
const EDGE_BASE = (configured ?? "http://localhost:3101").replace(/\/+$/, "");

export type EdgeVerdict = "NORMAL" | "WARNING" | "ANOMALY";

export interface EdgeReading {
  station_id: string;
  ts: string;
  t: number;
  h: number;
  p: number;
  score: number;
  verdict: EdgeVerdict;
  root_cause: string;
  lat?: number | null;
  lon?: number | null;
  fw?: string;
  received_at: string;
}

export function getEdgeApiBaseUrl(): string {
  return EDGE_BASE;
}

/** Age of a reading in seconds, using received_at then ts. Infinity if unparseable. */
export function edgeReadingAgeSec(r: EdgeReading): number {
  for (const key of ["received_at", "ts"] as const) {
    const ms = Date.parse(r[key]);
    if (!Number.isNaN(ms)) return Math.max(0, (Date.now() - ms) / 1000);
  }
  return Number.POSITIVE_INFINITY;
}

export function isEdgeReadingFresh(r: EdgeReading, maxAgeSec = 90): boolean {
  return edgeReadingAgeSec(r) <= maxAgeSec;
}

async function getJson<T>(path: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(`${EDGE_BASE}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchEdgeLatest(stationId: string): Promise<EdgeReading | null> {
  const data = await getJson<{ ok: boolean; reading?: EdgeReading }>(
    `/api/edge/latest/${encodeURIComponent(stationId)}`
  );
  return data?.reading ?? null;
}

export async function fetchEdgeLatestAll(): Promise<EdgeReading[]> {
  const data = await getJson<{ ok: boolean; stations?: EdgeReading[] }>(
    "/api/edge/latest"
  );
  return data?.stations ?? [];
}

export async function fetchEdgeHistory(
  stationId: string,
  limit = 100
): Promise<EdgeReading[]> {
  const data = await getJson<{ ok: boolean; readings?: EdgeReading[] }>(
    `/api/edge/history/${encodeURIComponent(stationId)}?limit=${limit}`
  );
  return data?.readings ?? [];
}

/** Subscribe to the gateway SSE broadcast. Returns an unsubscribe function. */
export function subscribeEdgeStream(onReading: (r: EdgeReading) => void): () => void {
  const src = new EventSource(`${EDGE_BASE}/api/edge/stream`);
  src.onmessage = (ev) => {
    try {
      onReading(JSON.parse(ev.data) as EdgeReading);
    } catch {
      /* ignore malformed frames */
    }
  };
  return () => src.close();
}

// ---------------------------------------------------------------------------
// Admin notifications (complaints, demo injects, critical events)
// ---------------------------------------------------------------------------

export interface NotifyEvent {
  id: string;
  time: string;
  kind: string;
  severity: string;
  station: string;
  subject: string;
  email_status: string;
}

async function postJson(path: string, body: unknown, timeoutMs = 10000): Promise<{ ok: boolean; error?: string } & Record<string, unknown> | null> {
  try {
    const res = await fetch(`${EDGE_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return (await res.json()) as { ok: boolean; error?: string } & Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Email a complaint/support case to the admin inbox via the gateway. */
export async function submitComplaint(input: {
  subject: string;
  details: string;
  stationId?: string;
  reporter?: string;
}): Promise<{ ok: boolean; caseId?: string; error?: string }> {
  const res = await postJson("/api/notify/complaint", input);
  if (!res) return { ok: false, error: "Gateway unreachable — is it running on :3101?" };
  if (!res.ok) return { ok: false, error: String(res.error ?? "rejected") };
  return { ok: true, caseId: String(res.case ?? "") };
}

/** Email a fault-injection / critical event to the admin inbox via the gateway. */
export async function notifyAdminEvent(input: {
  kind: string;
  severity?: string;
  station?: string;
  message: string;
  details?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await postJson("/api/notify/event", input);
  if (!res) return { ok: false, error: "Gateway unreachable" };
  return { ok: res.ok, error: res.ok ? undefined : String(res.error ?? "rejected") };
}

/** Latest admin notification feed (backs the header bell). */
export async function fetchNotifyFeed(limit = 50): Promise<NotifyEvent[]> {
  const data = await getJson<{ ok: boolean; events?: NotifyEvent[] }>(
    `/api/notify/feed?limit=${limit}`
  );
  return data?.events ?? [];
}

// ---------------------------------------------------------------------------
// Dummy-data simulator (no hardware needed)
// ---------------------------------------------------------------------------

export interface EdgeSimStatus {
  running: boolean;
  station?: string;
}

export interface EdgeHealth {
  ok: boolean;
  svc: string;
  time: string;
  sim?: EdgeSimStatus;
}

export async function fetchEdgeHealth(): Promise<EdgeHealth | null> {
  return getJson<EdgeHealth>("/api/health");
}

/** Inject `hours` of backfilled dummy readings and optionally start a live feed. */
export async function startEdgeSimulation(opts: {
  hours?: number;
  interval?: number;
  live?: boolean;
  stationId?: string;
} = {}): Promise<{ ok: boolean; injected?: number; live?: boolean; error?: string }> {
  const res = await postJson("/api/edge/simulate", {
    hours: opts.hours ?? 24,
    interval: opts.interval ?? 5,
    live: opts.live ?? true,
    station_id: opts.stationId,
  });
  if (!res) return { ok: false, error: "Gateway unreachable — is it running on :3101?" };
  if (!res.ok) return { ok: false, error: String(res.error ?? "rejected") };
  return { ok: true, injected: Number(res.injected ?? 0), live: Boolean(res.live) };
}

export async function stopEdgeSimulation(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${EDGE_BASE}/api/edge/simulate/stop`, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { ok: boolean };
    return { ok: data.ok };
  } catch {
    return { ok: false, error: "Gateway unreachable" };
  }
}
