import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  AlertTriangle,
  Bell,
  Clock,
  X,
  CornerDownLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { stations, demoAnomalies as anomalies, demoAlerts as alerts, type Station, type Anomaly } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/use-click-outside";

const RECENT_KEY = "skyguard:recent-searches";
const MAX_RECENT = 5;

type SearchItem = {
  id: string;
  kind: "station" | "anomaly" | "alert";
  title: string;
  subtitle: string;
  to: string;
};

const kindIcons = {
  station: MapPin,
  anomaly: AlertTriangle,
  alert: Bell,
};

interface SearchGroup {
  key: string;
  label: string;
  items: SearchItem[];
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string, current: string[]): string[] {
  const next = [term, ...current.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function HeaderSearch({ fullWidth = false }: { fullWidth?: boolean }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeDropdown = useCallback(() => setOpen(false), []);

  useClickOutside(containerRef, closeDropdown, open);

  const trimmed = query.trim();

  const groups: SearchGroup[] = useMemo(() => {
    if (!trimmed) return [];
    const q = trimmed.toLowerCase();
    const match = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(q));

    const stationItems = stations
      .filter((s: Station) => match(s.name, s.state, s.district, s.id))
      .slice(0, 4)
      .map((s: Station) => ({
        id: s.id,
        kind: "station" as const,
        title: s.name,
        subtitle: `${s.district}, ${s.state}`,
        to: `/stations/${s.id}`,
      }));

    const anomalyItems = anomalies
      .filter((a: Anomaly) => match(a.id, a.stationName, a.state, a.detectionType, a.parameter))
      .slice(0, 4)
      .map((a: Anomaly) => ({
        id: a.id,
        kind: "anomaly" as const,
        title: a.id,
        subtitle: `${a.stationName} · ${a.detectionType}`,
        to: `/anomalies/${a.id}`,
      }));

    const alertItems = alerts
      .filter((a) => match(a.id, a.stationName, a.message))
      .slice(0, 4)
      .map((a) => ({
        id: a.id,
        kind: "alert" as const,
        title: a.stationName,
        subtitle: a.message,
        to: "/alerts",
      }));

    return [
      { key: "stations", label: "Stations", items: stationItems },
      { key: "anomalies", label: "Anomalies", items: anomalyItems },
      { key: "alerts", label: "Alerts", items: alertItems },
    ].filter((g) => g.items.length > 0);
  }, [trimmed]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const effectiveHighlight =
    flatItems.length === 0 ? -1 : highlighted < 0 || highlighted >= flatItems.length ? 0 : highlighted;

  useEffect(() => {
    if (!open && inputRef.current) inputRef.current.blur();
  }, [open]);

  const goTo = (item: SearchItem) => {
    navigate(item.to);
    setRecent((r) => saveRecent(item.title, r));
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") setOpen(true);
      return;
    }
    if (!trimmed) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (Math.max(h, 0) + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h <= 0 ? flatItems.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[effectiveHighlight] ?? flatItems[0];
      if (item) goTo(item);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", fullWidth ? "w-full" : "w-80")}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        ref={inputRef}
        id="header-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search station, location..."
        aria-label="Search stations, anomalies, and alerts"
        aria-expanded={open}
        aria-controls="header-search-results"
        role="combobox"
        aria-autocomplete="list"
        className="h-9 w-full rounded-xl border-slate-200 bg-slate-50 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(true);
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div
          id="header-search-results"
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {!trimmed ? (
            <div className="py-1.5">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Recent searches
                </span>
                {recent.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecent([]);
                      try {
                        localStorage.removeItem(RECENT_KEY);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="text-[11px] font-medium text-blue-500 hover:text-blue-700"
                  >
                    Clear
                  </button>
                )}
              </div>
              {recent.length > 0 ? (
                recent.map((term) => (
                  <button
                    key={term}
                    type="button"
                    role="option"
                    onClick={() => {
                      setQuery(term);
                      setOpen(true);
                      inputRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{term}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-slate-500">
                  Start typing to search stations, anomalies, and alerts.
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <div key={group.key}>
                    <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const flatIdx = flatItems.indexOf(item);
                      const Icon = kindIcons[item.kind];
                      return (
                        <button
                          key={`${group.key}-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={flatIdx === effectiveHighlight}
                          onMouseEnter={() => setHighlighted(flatIdx)}
                          onClick={() => goTo(item)}
                          className={cn(
                            "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors",
                            flatIdx === effectiveHighlight ? "bg-slate-100" : "hover:bg-slate-50"
                          )}
                        >
                          <Icon
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              item.kind === "station" && "text-sky-500",
                              item.kind === "anomaly" && "text-amber-500",
                              item.kind === "alert" && "text-red-400"
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-700">
                              {item.title}
                            </span>
                            <span className="block truncate text-xs text-slate-400">{item.subtitle}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-slate-500">
                  No results for &ldquo;{trimmed}&rdquo;.
                </p>
              )}
            </div>
          )}

          {trimmed && groups.length > 0 && (
            <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 font-sans text-[10px]">↑</kbd>
                <kbd className="rounded border border-slate-200 bg-white px-1 font-sans text-[10px]">↓</kbd>
                navigate
              </span>
              <kbd className="ml-auto rounded border border-slate-200 bg-white px-1 font-sans text-[10px]">esc</kbd>
            </div>
          )}
        </div>
      )}
    </div>
  );
}