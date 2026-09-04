import { stations } from "@/lib/mock-data";

type Listener = (data: any) => void;

class StreamService {
  private listeners: Listener[] = [];
  private interval: number | null = null;
  private running = false;

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  start() {
    if (this.running) return;
    this.running = true;

    this.interval = window.setInterval(() => {
      const activeStations = stations.filter((s) => s.status === "active");
      const randomStation = activeStations[Math.floor(Math.random() * activeStations.length)] || stations[0];
      
      const data = {
        stationId: randomStation.id,
        stationName: randomStation.name,
        state: randomStation.state,
        temperature: +(randomStation.temperature + (Math.random() - 0.5) * 0.8).toFixed(1),
        humidity: Math.min(100, Math.max(0, Math.round(randomStation.humidity + (Math.random() - 0.5) * 3))),
        pressure: +(randomStation.pressure + (Math.random() - 0.5) * 0.6).toFixed(1),
        windSpeed: +(Math.max(0, 5 + Math.random() * 15)).toFixed(1),
        timestamp: new Date().toISOString(),
      };
      this.listeners.forEach((l) => l(data));
    }, 3000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
  }
}

export const streamService = new StreamService();
