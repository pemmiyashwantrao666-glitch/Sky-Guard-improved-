import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CloudSun,
  AlertTriangle,
  Radio,
  BarChart3,
  Wrench,
  Settings,
  LogOut,
  Menu,
  X,
  Activity,
  Bell,
  Info,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/overview",     icon: LayoutDashboard, label: "Dashboard" },
  { to: "/stations",     icon: Radio,            label: "Weather Stations" },
  { to: "/network",      icon: CloudSun,         label: "Real-time Weather" },
  { to: "/analytics",    icon: Activity,         label: "Sensor Health" },
  { to: "/anomalies",    icon: AlertTriangle,    label: "Anomalies" },
  { to: "/alerts",       icon: Bell,             label: "Alerts" },
  { to: "/maintenance",  icon: Wrench,           label: "Maintenance" },
  { to: "/complaints",   icon: MessageSquare,    label: "Complaints" },
  { to: "/reports",      icon: BarChart3,        label: "Reports" },
];

const bottomNav = [
  { to: "/settings",   icon: Settings, label: "Settings" },
  { to: "/about",      icon: Info,     label: "About System" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setCollapsed(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <aside
      className={cn(
        "relative z-20 flex flex-col transition-all duration-300",
        "bg-[#0d1f3c] text-white shadow-[2px_0_16px_rgba(0,0,0,0.35)]",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo / Brand */}
      <div className={cn(
        "flex items-center border-b border-white/10 px-4 py-4",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/skyguard-mark.svg" alt="" className="h-9 w-9" />
            <div className="leading-tight"><p className="text-[15px] font-extrabold tracking-wider text-white">SkyGuard</p><p className="text-[10px] font-medium uppercase tracking-widest text-sky-300/80">AI Monitoring</p></div>
          </div>
        )}
        {collapsed && (
          <img src="/skyguard-mark.svg" alt="SkyGuard AI" className="h-9 w-9" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg text-slate-300 hover:bg-white/8",
            collapsed && "mt-0"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Primary Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={`${item.to}-${item.label}`}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-[#1e6bdc] text-white shadow-[0_2px_12px_rgba(30,107,220,0.4)]"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                {!collapsed && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}

        {/* Divider */}
        <div className="my-2 border-t border-white/8" />

        {/* Bottom nav items */}
        {bottomNav.map((item) => (
          <NavLink
            key={`${item.to}-${item.label}`}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-[#1e6bdc] text-white shadow-[0_2px_12px_rgba(30,107,220,0.4)]"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                {!collapsed && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 p-2.5">
        <NavLink
          to="/login"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-300 hover:bg-white/8 hover:text-white transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0 text-slate-400" />
          {!collapsed && <span>Logout</span>}
        </NavLink>
      </div>
    </aside>
  );
}
