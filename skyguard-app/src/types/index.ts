// TypeScript types for Sky Guard AI

export interface Station {
  station_id: string;
  source: 'NOAA' | 'IMD' | 'ERA5' | 'ESP32';
  lat: number | null;
  lon: number | null;
  elevation: number | null;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE' | 'UNKNOWN';
  last_seen: string | null;  // ISO timestamp
  anomaly_count: number;
  created_at: string;
}

export interface Reading {
  reading_id: number;
  station_id: string;
  timestamp_utc: string;  // ISO timestamp
  temperature_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_ms: number | null;
  wind_direction_deg: number | null;
  rainfall_mm: number | null;
  visibility_m: number | null;
}

export interface Anomaly {
  anomaly_id: number;
  station_id: string;
  reading_id: number;
  timestamp_utc: string;
  anomaly_type: 'SPIKE' | 'FROZEN' | 'DRIFT' | 'COMM_LOSS' | 'PRESSURE_DROP' | 'MULTI_SENSOR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  parameter: 'temperature' | 'humidity' | 'pressure' | 'multi' | 'communication';
  confidence: number;  // 0.0-1.0
  details: string | null;
  created_at: string;
}

export interface DetectionLayer {
  layer_name: string;
  triggered: boolean;
  confidence: number;
  reason: string | null;
}

export interface HealthMetrics {
  total_stations: number;
  healthy_stations: number;
  warning_stations: number;
  critical_stations: number;
  offline_stations: number;
  total_anomalies_24h: number;
  detection_rate: number;  // % of anomalies caught
}

export interface StationDetail extends Station {
  latest_reading: Reading | null;
  recent_anomalies: Anomaly[];
  uptime_24h: number;  // percentage
  data_quality_24h: number;  // percentage
}

export interface TimeSeriesData {
  timestamp: string;
  temperature?: number | null;
  humidity?: number | null;
  pressure?: number | null;
  anomaly?: boolean;
}

export interface DetectionResult {
  is_anomaly: boolean;
  confidence: number;
  anomaly_type: string | null;
  layers: DetectionLayer[];
  reasoning: string;
}
