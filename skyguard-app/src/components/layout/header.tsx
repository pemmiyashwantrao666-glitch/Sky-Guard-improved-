import { Bell, Search, Settings, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Header() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    month: "long", day: "numeric", year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id="header-search"
          type="search"
          placeholder="Search station, location..."
          className="h-9 w-72 rounded-xl border-slate-200 bg-slate-50 pl-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Date & time */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500 mr-3">
          <span className="font-medium text-slate-600">{dateStr}</span>
          <span className="text-slate-300">|</span>
          <span>{timeStr}</span>
        </div>

        {/* Notification bell */}
        <Button
          id="header-notifications"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow">
            3
          </span>
        </Button>

        {/* Settings */}
        <Button
          id="header-settings"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Settings className="h-4.5 w-4.5" />
        </Button>

        {/* User avatar */}
        <Button
          id="header-user"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <UserCircle className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
