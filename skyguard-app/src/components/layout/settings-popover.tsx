import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bell, RefreshCw, Settings, X } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

const quickSettings = [
  { key: "emailAlerts", icon: Bell, label: "Email alerts", hint: "Daily anomaly digest", default: true },
  { key: "desktopAlerts", icon: RefreshCw, label: "Desktop alerts", hint: "Real-time critical warnings", default: true },
  { key: "autoRefresh", icon: RefreshCw, label: "Auto-refresh", hint: "Refresh data every 30s", default: false },
] as const;

type SettingKey = (typeof quickSettings)[number]["key"];

export function SettingsPopover({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  const [values, setValues] = useState<Record<SettingKey, boolean>>(() =>
    Object.fromEntries(quickSettings.map((s) => [s.key, s.default])) as Record<SettingKey, boolean>
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        id="header-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Quick settings"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Quick settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-50 px-5 py-2">
          {quickSettings.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <setting.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-700">{setting.label}</p>
                  <p className="text-xs text-slate-400">{setting.hint}</p>
                </div>
              </div>
              <Toggle
                aria-label={setting.label}
                pressed={values[setting.key]}
                onClick={() => setValues((prev) => ({ ...prev, [setting.key]: !prev[setting.key] }))}
              />
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              navigate("/settings");
              onClose();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Open full settings
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}