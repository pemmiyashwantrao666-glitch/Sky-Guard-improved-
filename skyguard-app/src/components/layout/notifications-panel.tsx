import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, Check, Info } from "lucide-react";
import { demoAlerts as alerts } from "@/lib/mock-data";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export function NotificationsPanel({
  readIds,
  onMarkAllRead,
  onClose,
}: {
  readIds: Set<string>;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const unreadCount = alerts.filter((a) => !readIds.has(a.id)).length;

  return (
    <div
      id="header-notifications-panel"
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-5.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-700"
          >
            <Check className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>

      <ul className="max-h-80 overflow-y-auto">
        {alerts.map((alert) => {
          const read = readIds.has(alert.id);
          const Icon = alert.type === "critical" ? AlertTriangle : alert.type === "warning" ? AlertTriangle : Info;
          return (
            <li key={alert.id}>
              <button
                type="button"
                onClick={() => {
                  navigate("/alerts");
                  onClose();
                }}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                  !read && "bg-sky-50/50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    alert.type === "critical" && "bg-red-100 text-red-500",
                    alert.type === "warning" && "bg-amber-100 text-amber-500",
                    alert.type === "info" && "bg-sky-100 text-sky-500"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-[13px] font-medium", read ? "text-slate-500" : "text-slate-800")}>
                      {alert.stationName}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(alert.timestamp)}</span>
                  </span>
                  <span className={cn("mt-0.5 block text-xs leading-snug", read ? "text-slate-400" : "text-slate-600")}>
                    {alert.message}
                  </span>
                </span>
                {!read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-slate-100 p-1.5">
        <button
          type="button"
          onClick={() => {
            navigate("/alerts");
            onClose();
          }}
          className="w-full rounded-lg px-3 py-2 text-center text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
        >
          View all alerts
        </button>
      </div>
    </div>
  );
}