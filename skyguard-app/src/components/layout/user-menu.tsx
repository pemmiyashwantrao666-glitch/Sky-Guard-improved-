import { useNavigate } from "react-router-dom";
import { LogOut, Settings, ShieldCheck } from "lucide-react";

export function UserMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <div
      id="header-user-menu"
      role="menu"
      aria-label="User menu"
      className="absolute right-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-5.5rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-bold text-white">
          AR
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">A. Rao</p>
          <p className="truncate text-xs text-slate-400">admin@skyguard.example</p>
        </div>
      </div>

      <div className="py-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={() => go("/analytics")}
          className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
        >
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          System health
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => go("/settings")}
          className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
        >
          <Settings className="h-4 w-4 text-slate-400" />
          Settings
        </button>
      </div>

      <div className="border-t border-slate-100 py-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            navigate("/login");
            onClose();
          }}
          className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}