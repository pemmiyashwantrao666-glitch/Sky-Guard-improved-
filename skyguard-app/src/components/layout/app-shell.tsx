import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f1f5f9]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[#f1f5f9] p-5 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
