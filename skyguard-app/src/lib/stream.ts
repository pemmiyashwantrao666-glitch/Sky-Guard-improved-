import { getStationBaseById } from "./station-service";
import { fetchCurrentWeather, type WeatherData } from "./weather-api";

type Listener = (data: WeatherData & { stationId: string; stationName: string; state: string }) => void;

class WeatherPoller {
  private listeners: Map<string, Listener> = new Map();
  private interval: number | null = null;
  private running = false;
  private targetStationId: string | null = null;

  setTargetStation(id: string | null) {
    this.targetStationId = id;
    if (id && !this.listeners.has(id)) {
      const base = getStationBaseById(id);
      if (base) {
        const listener: Listener = (() => {}) as Listener;
        this.listeners.set(id, listener);
        this.start();
      }
    } else if (!id) {
      if (this.targetStationId && this.listeners.has(this.targetStationId)) {
        this.listeners.delete(this.targetStationId);
      }
      if (this.listeners.size === 0) {
        this.stop();
      }
    }
  }

  subscribe(listener: Listener) {
    const id = this.targetStationId;
    if (id) {
      this.listeners.set(id, listener);
      this.start();
    }
    return () => {
      if (id) {
        this.listeners.delete(id);
      }
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  private async poll() {
    for (const stationId of this.listeners.keys()) {
      const base = getStationBaseById(stationId);
      if (!base) continue;

      const weather = await fetchCurrentWeather(base.latitude, base.longitude);
      if (weather) {
        const data = {
          ...weather,
          stationId: base.id,
          stationName: base.name,
          state: base.state,
        };
        // Read the listener back after the request resolves: subscribing
        // while the first fetch is already in flight must not drop it.
        this.listeners.get(stationId)?.(data);
      }
    }
  }

  start() {
    if (this.running || this.listeners.size === 0) return;
    this.running = true;
    this.poll();
    this.interval = window.setInterval(() => {
      this.poll();
    }, 5 * 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
  }
}

export const streamService = new WeatherPoller();
