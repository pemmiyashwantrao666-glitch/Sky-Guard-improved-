import { useCallback, useRef, useState } from "react";
import { Bell, Search, Settings, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderSearch } from "@/components/layout/header-search";
import { NotificationsPanel } from "@/components/layout/notifications-panel";
import { SettingsPopover } from "@/components/layout/settings-popover";
import { UserMenu } from "@/components/layout/user-menu";
import { demoAlerts as alerts } from "@/lib/mock-data";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useMediaQuery } from "@/hooks/use-media-query";

type PopoverId = "notifications" | "settings" | "user";

export function Header() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    month: "long", day: "numeric", year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const headerRef = useRef<HTMLElement>(null);
  const [activePopover, setActivePopover] = useState<PopoverId | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());

  const unreadCount = alerts.filter((a) => !readAlertIds.has(a.id)).length;

  const closePopover = useCallback(() => setActivePopover(null), []);

  useClickOutside(headerRef, closePopover, activePopover !== null);

  const togglePopover = (id: PopoverId) => {
    setActivePopover((current) => (current === id ? null : id));
  };

  return (
    <header
      ref={headerRef}
      className="flex flex-col border-b border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between px-4 py-2 md:px-6 md:py-3">
        {/* Brand (mobile only) */}
        {!isDesktop && (
          <div className="flex items-center gap-2">
            <img src="/skyguard-mark.svg" alt="SkyGuard AI" className="h-7 w-7" />
            <div className="leading-tight">
              <p className="text-[13px] font-extrabold tracking-wider text-slate-800">SkyGuard</p>
              <p className="text-[8px] font-medium uppercase tracking-widest text-sky-500">AI Monitoring</p>
            </div>
          </div>
        )}

        {/* Search (desktop) */}
        {isDesktop && <HeaderSearch />}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1 md:gap-1.5">
          {/* Date & time */}
          <div className="mr-3 hidden items-center gap-2 text-sm text-slate-500 lg:flex">
            <span className="font-medium text-slate-600">{dateStr}</span>
            <span className="text-slate-300">|</span>
            <span>{timeStr}</span>
          </div>

          {/* Mobile search toggle */}
          {!isDesktop && (
            <Button
              id="header-mobile-search"
              variant="ghost-light"
              size="icon"
              aria-label="Search"
              aria-expanded={mobileSearchOpen}
              aria-haspopup="dialog"
              onClick={() => setMobileSearchOpen((open) => !open)}
              className="h-11 w-11 rounded-xl"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          {/* Notification bell */}
          <div className="relative">
            <Button
              id="header-notifications"
              variant="ghost-light"
              size="icon"
              aria-label="Notifications"
              aria-haspopup="dialog"
              aria-expanded={activePopover === "notifications"}
              onClick={() => togglePopover("notifications")}
              className="relative h-11 w-11 rounded-xl md:h-9 md:w-9"
            >
              <Bell className="h-5 w-5 md:h-4.5 md:w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow">
                  {unreadCount}
                </span>
              )}
            </Button>
            {activePopover === "notifications" && (
              <NotificationsPanel
                readIds={readAlertIds}
                onMarkAllRead={() => setReadAlertIds(new Set(alerts.map((a) => a.id)))}
                onClose={closePopover}
              />
            )}
          </div>

          {/* Settings */}
          <div className="relative">
            <Button
              id="header-settings"
              variant="ghost-light"
              size="icon"
              aria-label="Settings"
              aria-haspopup="dialog"
              aria-expanded={activePopover === "settings"}
              onClick={() => togglePopover("settings")}
              className="h-11 w-11 rounded-xl md:h-9 md:w-9"
            >
              <Settings className="h-5 w-5 md:h-4.5 md:w-4.5" />
            </Button>
          </div>

          {/* User avatar */}
          <div className="relative">
            <Button
              id="header-user"
              variant="ghost-light"
              size="icon"
              aria-label="User menu"
              aria-haspopup="menu"
              aria-expanded={activePopover === "user"}
              onClick={() => togglePopover("user")}
              className="h-11 w-11 rounded-xl md:h-9 md:w-9"
            >
              <UserCircle className="h-5.5 w-5.5 md:h-5 md:w-5" />
            </Button>
            {activePopover === "user" && <UserMenu onClose={closePopover} />}
          </div>
        </div>
      </div>

      {/* Mobile search row */}
      {!isDesktop && mobileSearchOpen && (
        <div className="border-t border-slate-100 px-4 py-2">
          <HeaderSearch fullWidth />
        </div>
      )}

      {activePopover === "settings" && <SettingsPopover onClose={closePopover} />}
    </header>
  );
}