import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Overview } from "@/pages/Overview";
import { Network } from "@/pages/Network";
import { Anomalies } from "@/pages/Anomalies";
import { AnomalyDetail } from "@/pages/AnomalyDetail";
import { Stations } from "@/pages/Stations";
import { StationDetail } from "@/pages/StationDetail";
import { Analytics } from "@/pages/Analytics";
import { Maintenance } from "@/pages/Maintenance";
import { Docs } from "@/pages/Docs";
import { Settings } from "@/pages/Settings";
import { Alerts } from "@/pages/Alerts";
import { Reports } from "@/pages/Reports";
import { Complaints } from "@/pages/Complaints";
import { AboutSystem } from "@/pages/AboutSystem";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/network" element={<Network />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/anomalies/:id" element={<AnomalyDetail />} />
          <Route path="/stations" element={<Stations />} />
          <Route path="/stations/:id" element={<StationDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/complaints" element={<Complaints />} />
          <Route path="/about" element={<AboutSystem />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
