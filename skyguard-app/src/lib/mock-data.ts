export interface Station {
  id: string;
  name: string;
  state: string;
  district: string;
  region: "north" | "south" | "east" | "west" | "central" | "northeast";
  latitude: number;
  longitude: number;
  elevation: number;
  status: "active" | "warning" | "offline" | "maintenance";
  healthScore: number;
  lastSync: string;
  temperature: number;
  humidity: number;
  pressure: number;
  communicationQuality: number;
  batteryLevel: number;
  sensorDrift: number;
}

export interface Reading {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  expectedTemp?: number;
  correctedTemp?: number;
}

export interface Anomaly {
  id: string;
  stationId: string;
  stationName: string;
  state: string;
  parameter: "temperature" | "humidity" | "pressure" | "communication";
  observedValue: string;
  expectedRange: string;
  detectionType:
    | "Point spike"
    | "Frozen value"
    | "Rate-of-change violation"
    | "Seasonal inconsistency"
    | "Multivariate mismatch"
    | "Spatial mismatch"
    | "Communication gap"
    | "Sensor drift"
    | "Suspected calibration issue";
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  detectedAt: string;
  status: "new" | "investigating" | "confirmed" | "dismissed" | "resolved";
  assignedTo?: string;
  explanation: string;
  shapFeatures: { feature: string; contribution: number }[];
  correctedValue?: string;
  readingHistory: Reading[];
}

export interface MaintenanceTask {
  id: string;
  stationId: string;
  stationName: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  completed: boolean;
  assignedTo: string;
  anomalyId?: string;
}

export interface RegionStat {
  region: string;
  stationsOnline: number;
  totalStations: number;
  healthyObs: number;
  activeAnomalies: number;
  criticalStations: number;
}

import { imdStations, type ImdStation } from "./imd-stations";

export { imdStations, type ImdStation } from "./imd-stations";

const customStations: Station[] = [
  {
    id: "MH-042", name: "Pune Observatory", state: "Maharashtra", district: "Pune",
    region: "west", latitude: 18.5204, longitude: 73.8567, elevation: 560,
    status: "active", healthScore: 94, lastSync: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 98, batteryLevel: 87, sensorDrift: 0.3,
  },
  {
    id: "RJ-018", name: "Jaipur Central", state: "Rajasthan", district: "Jaipur",
    region: "north", latitude: 26.9124, longitude: 75.7873, elevation: 431,
    status: "warning", healthScore: 71, lastSync: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 82, batteryLevel: 64, sensorDrift: 1.8,
  },
  {
    id: "DL-007", name: "Delhi Ridge", state: "Delhi", district: "New Delhi",
    region: "north", latitude: 28.6139, longitude: 77.209, elevation: 216,
    status: "active", healthScore: 91, lastSync: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 96, batteryLevel: 92, sensorDrift: 0.5,
  },
  {
    id: "KA-031", name: "Bengaluru Tech", state: "Karnataka", district: "Bengaluru",
    region: "south", latitude: 12.9716, longitude: 77.5946, elevation: 920,
    status: "active", healthScore: 89, lastSync: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 94, batteryLevel: 78, sensorDrift: 0.8,
  },
  {
    id: "TN-025", name: "Chennai Coastal", state: "Tamil Nadu", district: "Chennai",
    region: "south", latitude: 13.0827, longitude: 80.2707, elevation: 6,
    status: "active", healthScore: 86, lastSync: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 91, batteryLevel: 81, sensorDrift: 0.6,
  },
  {
    id: "WB-014", name: "Kolkata Metro", state: "West Bengal", district: "Kolkata",
    region: "east", latitude: 22.5726, longitude: 88.3639, elevation: 9,
    status: "active", healthScore: 88, lastSync: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 93, batteryLevel: 75, sensorDrift: 0.4,
  },
  {
    id: "GJ-019", name: "Ahmedabad Industrial", state: "Gujarat", district: "Ahmedabad",
    region: "west", latitude: 23.0225, longitude: 72.5714, elevation: 53,
    status: "warning", healthScore: 68, lastSync: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 76, batteryLevel: 45, sensorDrift: 2.1,
  },
  {
    id: "UP-033", name: "Lucknow Plains", state: "Uttar Pradesh", district: "Lucknow",
    region: "north", latitude: 26.8467, longitude: 80.9462, elevation: 123,
    status: "active", healthScore: 92, lastSync: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 97, batteryLevel: 88, sensorDrift: 0.2,
  },
  {
    id: "KL-022", name: "Thiruvananthapuram Coast", state: "Kerala", district: "Thiruvananthapuram",
    region: "south", latitude: 8.5241, longitude: 76.9366, elevation: 3,
    status: "active", healthScore: 90, lastSync: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 95, batteryLevel: 82, sensorDrift: 0.4,
  },
  {
    id: "AS-008", name: "Guwahati Hills", state: "Assam", district: "Kamrup",
    region: "northeast", latitude: 26.1445, longitude: 91.7362, elevation: 55,
    status: "offline", healthScore: 12, lastSync: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 0, batteryLevel: 8, sensorDrift: 3.5,
  },
  {
    id: "MP-029", name: "Bhopal Lake", state: "Madhya Pradesh", district: "Bhopal",
    region: "central", latitude: 23.2599, longitude: 77.4126, elevation: 527,
    status: "active", healthScore: 85, lastSync: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 90, batteryLevel: 72, sensorDrift: 0.7,
  },
  {
    id: "HR-011", name: "Chandigarh Sector", state: "Haryana", district: "Chandigarh",
    region: "north", latitude: 30.7333, longitude: 76.7794, elevation: 321,
    status: "maintenance", healthScore: 35, lastSync: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 45, batteryLevel: 55, sensorDrift: 4.2,
  },
  {
    id: "PB-015", name: "Amritsar Golden", state: "Punjab", district: "Amritsar",
    region: "north", latitude: 31.634, longitude: 74.8723, elevation: 234,
    status: "active", healthScore: 87, lastSync: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 92, batteryLevel: 79, sensorDrift: 0.5,
  },
  {
    id: "AP-036", name: "Visakhapatnam Port", state: "Andhra Pradesh", district: "Visakhapatnam",
    region: "south", latitude: 17.6868, longitude: 83.2185, elevation: 7,
    status: "active", healthScore: 91, lastSync: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 96, batteryLevel: 84, sensorDrift: 0.3,
  },
  {
    id: "OD-017", name: "Bhubaneswar Temple", state: "Odisha", district: "Khordha",
    region: "east", latitude: 20.2961, longitude: 85.8245, elevation: 45,
    status: "warning", healthScore: 64, lastSync: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 68, batteryLevel: 38, sensorDrift: 2.4,
  },
  {
    id: "JH-024", name: "Ranchi Plateau", state: "Jharkhand", district: "Ranchi",
    region: "east", latitude: 23.3441, longitude: 85.3096, elevation: 651,
    status: "active", healthScore: 82, lastSync: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 88, batteryLevel: 71, sensorDrift: 0.9,
  },
  {
    id: "UK-009", name: "Dehradun Valley", state: "Uttarakhand", district: "Dehradun",
    region: "north", latitude: 30.3165, longitude: 78.0322, elevation: 450,
    status: "active", healthScore: 93, lastSync: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 97, batteryLevel: 90, sensorDrift: 0.2,
  },
  {
    id: "HP-010", name: "Shimla Hills", state: "Himachal Pradesh", district: "Shimla",
    region: "north", latitude: 31.1048, longitude: 77.1734, elevation: 2205,
    status: "active", healthScore: 88, lastSync: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 91, batteryLevel: 76, sensorDrift: 0.6,
  },
  {
    id: "GA-005", name: "Panaji Beach", state: "Goa", district: "North Goa",
    region: "west", latitude: 15.4909, longitude: 73.8278, elevation: 7,
    status: "active", healthScore: 90, lastSync: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 95, batteryLevel: 83, sensorDrift: 0.4,
  },
  {
    id: "TR-004", name: "Agartala Hills", state: "Tripura", district: "West Tripura",
    region: "northeast", latitude: 23.8315, longitude: 91.2868, elevation: 17,
    status: "active", healthScore: 84, lastSync: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 86, batteryLevel: 69, sensorDrift: 1.1,
  },
  {
    id: "CG-012", name: "Raipur Plains", state: "Chhattisgarh", district: "Raipur",
    region: "central", latitude: 21.2514, longitude: 81.6296, elevation: 298,
    status: "active", healthScore: 79, lastSync: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    temperature: 0, humidity: 0, pressure: 0, communicationQuality: 84, batteryLevel: 67, sensorDrift: 1.3,
  },
];

function getEmptyStation(imd: ImdStation): Station {
  return {
    id: imd.id,
    name: imd.name,
    state: imd.state,
    district: imd.district,
    region: imd.region,
    latitude: imd.latitude,
    longitude: imd.longitude,
    elevation: 0,
    status: "active",
    healthScore: 85,
    lastSync: new Date().toISOString(),
    temperature: 0,
    humidity: 0,
    pressure: 0,
    communicationQuality: 90,
    batteryLevel: 80,
    sensorDrift: 0.5,
  };
}

export const stations: Station[] = [
  ...customStations,
  ...imdStations.map(getEmptyStation),
];

export const demoAnomalies: Anomaly[] = [
  {
    id: "AN-001",
    stationId: "MH-042",
    stationName: "Pune Observatory",
    state: "Maharashtra",
    parameter: "temperature",
    observedValue: "55.0 °C",
    expectedRange: "24.8 – 33.6 °C",
    detectionType: "Point spike",
    severity: "critical",
    confidence: 94,
    detectedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    status: "new",
    assignedTo: "R. Sharma",
    explanation: "The reading is inconsistent with the station's recent pattern and with nearby stations. Pressure and humidity did not change in a way expected for a true local temperature event.",
    shapFeatures: [
      { feature: "Extreme deviation from rolling baseline", contribution: 0.35 },
      { feature: "Sudden rate of change", contribution: 0.28 },
      { feature: "Neighbouring station disagreement", contribution: 0.18 },
      { feature: "Humidity-temperature inconsistency", contribution: 0.12 },
      { feature: "Seasonal context", contribution: 0.07 },
    ],
    correctedValue: "29.4 °C",
    readingHistory: [],
  },
  {
    id: "AN-002",
    stationId: "RJ-018",
    stationName: "Jaipur Central",
    state: "Rajasthan",
    parameter: "pressure",
    observedValue: "Frozen at 1008.3 hPa",
    expectedRange: "998.0 – 1012.0 hPa",
    detectionType: "Frozen value",
    severity: "high",
    confidence: 87,
    detectedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: "investigating",
    assignedTo: "A. Patel",
    explanation: "Pressure sensor has reported the identical value for 6 consecutive readings despite significant atmospheric changes. This suggests a stuck sensor or communication buffer issue.",
    shapFeatures: [
      { feature: "Zero variance over extended window", contribution: 0.42 },
      { feature: "Correlated temperature drift", contribution: 0.22 },
      { feature: "Communication buffer full", contribution: 0.18 },
      { feature: "Seasonal inconsistency", contribution: 0.10 },
      { feature: "Power supply fluctuation", contribution: 0.08 },
    ],
    readingHistory: [],
  },
  {
    id: "AN-003",
    stationId: "GJ-019",
    stationName: "Ahmedabad Industrial",
    state: "Gujarat",
    parameter: "humidity",
    observedValue: "Dropped 45% in 10 minutes",
    expectedRange: "Rate of change < 5%/10min",
    detectionType: "Rate-of-change violation",
    severity: "high",
    confidence: 82,
    detectedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    status: "new",
    assignedTo: "S. Verma",
    explanation: "The rate of humidity change far exceeds physically possible limits for the current season. Likely sensor contamination or a loose hygrometer cap.",
    shapFeatures: [
      { feature: "Excessive rate of change", contribution: 0.38 },
      { feature: "Temperature-pressure stability", contribution: 0.25 },
      { feature: "Neighbouring station normal readings", contribution: 0.20 },
      { feature: "Seasonal context", contribution: 0.10 },
      { feature: "Sensor age", contribution: 0.07 },
    ],
    readingHistory: [],
  },
  {
    id: "AN-004",
    stationId: "DL-007",
    stationName: "Delhi Ridge",
    state: "Delhi",
    parameter: "temperature",
    observedValue: "18.2 °C at 14:30 IST",
    expectedRange: "32.0 – 38.0 °C (mid-April)",
    detectionType: "Seasonal inconsistency",
    severity: "medium",
    confidence: 76,
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    status: "investigating",
    explanation: "The reading falls well outside the seasonal climatology for this location and time of day. Possible sensor cooling or calibration error.",
    shapFeatures: [
      { feature: "Seasonal deviation", contribution: 0.40 },
      { feature: "Diurnal pattern mismatch", contribution: 0.25 },
      { feature: "Neighbouring station consistency", contribution: 0.15 },
      { feature: "Sensor age", contribution: 0.12 },
      { feature: "Power anomaly", contribution: 0.08 },
    ],
    readingHistory: [],
  },
  {
    id: "AN-005",
    stationId: "KA-031",
    stationName: "Bengaluru Tech",
    state: "Karnataka",
    parameter: "temperature",
    observedValue: "41.2 °C",
    expectedRange: "22.0 – 30.0 °C",
    detectionType: "Multivariate mismatch",
    severity: "critical",
    confidence: 91,
    detectedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: "confirmed",
    assignedTo: "P. Kumar",
    explanation: "Temperature spike is not supported by pressure or humidity changes. The combination suggests a direct sensor fault rather than a true weather event.",
    shapFeatures: [
      { feature: "Temperature-pressure divergence", contribution: 0.32 },
      { feature: "Humidity-temperature inconsistency", contribution: 0.28 },
      { feature: "Extreme deviation from baseline", contribution: 0.20 },
      { feature: "Neighbouring disagreement", contribution: 0.12 },
      { feature: "Seasonal context", contribution: 0.08 },
    ],
    correctedValue: "26.8 °C",
    readingHistory: [],
  },
  {
    id: "AN-006",
    stationId: "TN-025",
    stationName: "Chennai Coastal",
    state: "Tamil Nadu",
    parameter: "humidity",
    observedValue: "95% while neighbours report 72%",
    expectedRange: "Spatial variance < 8%",
    detectionType: "Spatial mismatch",
    severity: "medium",
    confidence: 78,
    detectedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    status: "dismissed",
    explanation: "The reading was attributed to a localized fog event confirmed by local observation. Neighbouring stations are too far to capture the microclimate.",
    shapFeatures: [
      { feature: "Spatial outlier", contribution: 0.35 },
      { feature: "Localised weather validation", contribution: 0.30 },
      { feature: "Temporal consistency", contribution: 0.20 },
      { feature: "Sensor health", contribution: 0.10 },
      { feature: "Seasonal context", contribution: 0.05 },
    ],
    readingHistory: [],
  },
  {
    id: "AN-007",
    stationId: "AS-008",
    stationName: "Guwahati Hills",
    state: "Assam",
    parameter: "communication",
    observedValue: "No data for 5 hours",
    expectedRange: "Continuous < 5 min gaps",
    detectionType: "Communication gap",
    severity: "critical",
    confidence: 99,
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: "new",
    assignedTo: "M. Das",
    explanation: "Complete communication failure. Battery level critically low (8%). Solar panel likely damaged by recent weather. Manual inspection required.",
    shapFeatures: [
      { feature: "Zero signal strength", contribution: 0.45 },
      { feature: "Battery voltage drop", contribution: 0.30 },
      { feature: "Solar input zero", contribution: 0.15 },
      { feature: "Temperature within range", contribution: 0.06 },
      { feature: "Previous packet loss trend", contribution: 0.04 },
    ],
    readingHistory: [],
  },
  {
    id: "AN-008",
    stationId: "WB-014",
    stationName: "Kolkata Metro",
    state: "West Bengal",
    parameter: "pressure",
    observedValue: "Gradual drift +4.2 hPa over 72h",
    expectedRange: "Stable ±0.5 hPa",
    detectionType: "Sensor drift",
    severity: "medium",
    confidence: 84,
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    status: "investigating",
    assignedTo: "T. Banerjee",
    explanation: "Barometer reading has drifted consistently upward. The pattern matches known diaphragm fatigue in this sensor model. Replacement recommended.",
    shapFeatures: [
      { feature: "Linear drift over 72h", contribution: 0.38 },
      { feature: "Temperature compensation error", contribution: 0.24 },
      { feature: "Sensor age", contribution: 0.18 },
      { feature: "Neighbouring station stability", contribution: 0.12 },
      { feature: "Humidity correlation", contribution: 0.08 },
    ],
    readingHistory: [],
  },
  {
    id: "AN-009",
    stationId: "HR-011",
    stationName: "Chandigarh Sector",
    state: "Haryana",
    parameter: "temperature",
    observedValue: "45.1 °C (impossible for season)",
    expectedRange: "28.0 – 36.0 °C",
    detectionType: "Suspected calibration issue",
    severity: "high",
    confidence: 89,
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    status: "confirmed",
    assignedTo: "N. Singh",
    explanation: "Value exceeds theoretical maximum for this location and season. Thermocouple likely shifted during maintenance. Recalibration needed before data can be trusted.",
    shapFeatures: [
      { feature: "Physical impossibility", contribution: 0.42 },
      { feature: "Thermocouple offset", contribution: 0.26 },
      { feature: "Maintenance log entry", contribution: 0.16 },
      { feature: "Humidity-temperature inconsistency", contribution: 0.10 },
      { feature: "Neighbouring disagreement", contribution: 0.06 },
    ],
    correctedValue: "33.6 °C",
    readingHistory: [],
  },
  {
    id: "AN-010",
    stationId: "OD-017",
    stationName: "Bhubaneswar Temple",
    state: "Odisha",
    parameter: "humidity",
    observedValue: "Stuck at 80.0% for 2 hours",
    expectedRange: "65% – 78%",
    detectionType: "Frozen value",
    severity: "medium",
    confidence: 81,
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
    status: "new",
    explanation: "Hygrometer output frozen. Likely condensation on sensor or ADC latch-up. Cleaning and reset scheduled.",
    shapFeatures: [
      { feature: "Zero variance", contribution: 0.40 },
      { feature: "Temperature divergence", contribution: 0.22 },
      { feature: "Power fluctuation", contribution: 0.18 },
      { feature: "Sensor age", contribution: 0.12 },
      { feature: "Seasonal context", contribution: 0.08 },
    ],
    readingHistory: [],
  },
  {
    id: "AN-011",
    stationId: "PB-015",
    stationName: "Amritsar Golden",
    state: "Punjab",
    parameter: "temperature",
    observedValue: "Drop of 12°C in 20 minutes",
    expectedRange: "Rate < 3°C/20min",
    detectionType: "Rate-of-change violation",
    severity: "medium",
    confidence: 73,
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    status: "dismissed",
    explanation: "Rate-of-change violation was caused by a passing cold front verified by satellite imagery. The reading is meteorologically valid.",
    shapFeatures: [
      { feature: "Excessive rate of change", contribution: 0.30 },
      { feature: "Frontal passage confirmation", contribution: 0.28 },
      { feature: "Neighbouring station correlation", contribution: 0.22 },
      { feature: "Pressure drop correlation", contribution: 0.12 },
      { feature: "Sensor health", contribution: 0.08 },
    ],
    readingHistory: [],
  },
  {
    id: "AN-012",
    stationId: "MP-029",
    stationName: "Bhopal Lake",
    state: "Madhya Pradesh",
    parameter: "pressure",
    observedValue: "991.2 hPa (low for region)",
    expectedRange: "1008.0 – 1016.0 hPa",
    detectionType: "Spatial mismatch",
    severity: "low",
    confidence: 65,
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    status: "resolved",
    explanation: "Low pressure was associated with a distant depression. Corrected after verification with regional model output.",
    shapFeatures: [
      { feature: "Spatial outlier", contribution: 0.32 },
      { feature: "Regional model validation", contribution: 0.28 },
      { feature: "Temporal consistency", contribution: 0.20 },
      { feature: "Sensor health", contribution: 0.12 },
      { feature: "Seasonal context", contribution: 0.08 },
    ],
    correctedValue: "1014.8 hPa",
    readingHistory: [],
  },
  {
    id: "AN-013",
    stationId: "MH-042",
    stationName: "Pune Observatory",
    state: "Maharashtra",
    parameter: "temperature",
    observedValue: "Gradual rise of 3.2°C over 48h",
    expectedRange: "Stable ±1.5°C/48h",
    detectionType: "Sensor drift",
    severity: "medium",
    confidence: 79,
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    status: "new",
    explanation: "Gradual warming trend detected that does not match regional synoptic patterns. Thermistor insulation likely degraded.",
    shapFeatures: [
      { feature: "Gradual positive drift", contribution: 0.35 },
      { feature: "Regional temperature stable", contribution: 0.25 },
      { feature: "Humidity stable", contribution: 0.18 },
      { feature: "Sensor age", contribution: 0.14 },
      { feature: "Diurnal pattern intact", contribution: 0.08 },
    ],
    readingHistory: [],
  },
];

/**
 * Deterministic hourly readings for the 24h window before each demo anomaly
 * was detected. A seeded generator keeps charts stable across reloads, and
 * the flagged signal is injected into the tail so the evidence chart actually
 * shows what the detector raised.
 */
function buildAnomalyReadingHistory(anomaly: Anomaly): Reading[] {
  const seed = [...anomaly.id].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const rand = (i: number) => {
    const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return x - Math.floor(x); // 0..1, deterministic per (anomaly, point)
  };

  const detected = new Date(anomaly.detectedAt).getTime();
  const history: Reading[] = [];
  for (let i = 23; i >= 0; i--) {
    const ts = detected - i * 60 * 60 * 1000;
    const hour = new Date(ts).getHours();
    // Smooth diurnal baseline — this doubles as the "Expected" reference line.
    const wave = Math.sin(((hour - 14) / 24) * Math.PI * 2);
    const temperature = 27 + 4 * wave + (rand(i) - 0.5) * 1.2;
    const humidity = Math.min(96, Math.max(35, 66 - 7 * wave + (rand(i + 40) - 0.5) * 4));
    const pressure = 1010 + 2.2 * wave + (rand(i + 80) - 0.5) * 1.4;
    history.push({
      timestamp: new Date(ts).toISOString(),
      temperature: Number(temperature.toFixed(1)),
      humidity: Number(humidity.toFixed(1)),
      pressure: Number(pressure.toFixed(1)),
      windSpeed: Number((6 + (rand(i + 120) - 0.5) * 5).toFixed(1)),
      expectedTemp: Number((27 + 4 * wave).toFixed(1)),
    });
  }

  // Inject the flagged signal into the tail of the affected parameter.
  const observed = Number((anomaly.observedValue.match(/-?\d+(\.\d+)?/) || [])[0]);
  const isFrozen = /frozen|stuck|no data/i.test(
    `${anomaly.observedValue} ${anomaly.detectionType}`
  );
  const idxFrom = history.length - (isFrozen ? 4 : 2);

  for (let i = idxFrom; i < history.length; i++) {
    const r = history[i];
    const last = i === history.length - 1;
    switch (anomaly.parameter) {
      case "temperature": {
        if (Number.isFinite(observed) && observed > -40 && observed < 70) {
          r.temperature = observed; // absolute value e.g. "55.0 °C"
        } else if (Number.isFinite(observed)) {
          // Relative magnitude (e.g. "Drop of 12°C") → offset from baseline.
          const down = /drop|fall|decreas|lower/i.test(anomaly.observedValue);
          const base = r.expectedTemp ?? 27;
          r.temperature = Number((down ? base - observed : base + observed).toFixed(1));
        } else {
          r.temperature = Number(((r.expectedTemp ?? 27) + 9).toFixed(1));
        }
        if (last && anomaly.correctedValue) {
          const corrected = Number(anomaly.correctedValue.match(/-?\d+(\.\d+)?/)?.[0]);
          if (Number.isFinite(corrected)) r.correctedTemp = corrected;
        }
        break;
      }
      case "humidity": {
        if (Number.isFinite(observed) && observed > 0 && observed <= 100) {
          r.humidity = observed; // absolute value e.g. "Stuck at 80.0%"
        } else if (Number.isFinite(observed)) {
          // Relative drop/rise in % → scale the baseline.
          const down = /drop|fall|decreas/i.test(anomaly.observedValue);
          r.humidity = Number(
            (r.humidity * (down ? 1 - observed / 100 : 1 + observed / 100)).toFixed(1)
          );
        }
        break;
      }
      case "pressure": {
        if (Number.isFinite(observed) && observed >= 850 && observed <= 1080) {
          r.pressure = observed; // absolute value e.g. "991.2 hPa"
        } else if (Number.isFinite(observed)) {
          // Gradual drift given as a delta (e.g. "+4.2 hPa over 72h").
          r.pressure = Number((r.pressure + observed).toFixed(1));
        }
        break;
      }
      case "communication": {
        // "No data for hours" → the last packets repeat (stale buffer).
        const stale = history[Math.max(0, idxFrom - 1)];
        r.temperature = stale.temperature;
        r.humidity = stale.humidity;
        r.pressure = stale.pressure;
        break;
      }
    }
  }
  return history;
}

// Populate the evidence series for every demo anomaly.
demoAnomalies.forEach((anomaly) => {
  anomaly.readingHistory = buildAnomalyReadingHistory(anomaly);
});

export const demoAlerts: {
  id: string;
  stationId: string;
  stationName: string;
  type: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
}[] = [
  {
    id: "AL-001", stationId: "MH-042", stationName: "Pune Observatory",
    type: "critical", message: "Temperature spike detected — 55.0°C recorded",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: "AL-002", stationId: "AS-008", stationName: "Guwahati Hills",
    type: "critical", message: "Communication link down for 5 hours",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "AL-003", stationId: "RJ-018", stationName: "Jaipur Central",
    type: "warning", message: "Frozen pressure value detected",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "AL-004", stationId: "DL-007", stationName: "Delhi Ridge",
    type: "warning", message: "Seasonal temperature inconsistency",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "AL-005", stationId: "HR-011", stationName: "Chandigarh Sector",
    type: "warning", message: "Station in maintenance mode",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

export const demoMaintenanceTasks: MaintenanceTask[] = [
  {
    id: "MT-001", stationId: "HR-011", stationName: "Chandigarh Sector",
    title: "Recalibrate temperature sensor after suspected failure",
    priority: "high", dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    completed: false, assignedTo: "N. Singh", anomalyId: "AN-009",
  },
  {
    id: "MT-002", stationId: "RJ-018", stationName: "Jaipur Central",
    title: "Inspect and clean pressure sensor housing",
    priority: "high", dueDate: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    completed: false, assignedTo: "A. Patel", anomalyId: "AN-002",
  },
  {
    id: "MT-003", stationId: "AS-008", stationName: "Guwahati Hills",
    title: "Replace solar panel and communication module",
    priority: "high", dueDate: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    completed: false, assignedTo: "M. Das", anomalyId: "AN-007",
  },
  {
    id: "MT-004", stationId: "WB-014", stationName: "Kolkata Metro",
    title: "Replace barometer diaphragm",
    priority: "medium", dueDate: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    completed: false, assignedTo: "T. Banerjee", anomalyId: "AN-008",
  },
  {
    id: "MT-005", stationId: "GJ-019", stationName: "Ahmedabad Industrial",
    title: "Replace hygrometer cap and sensor",
    priority: "medium", dueDate: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    completed: false, assignedTo: "S. Verma",
  },
  {
    id: "MT-006", stationId: "OD-017", stationName: "Bhubaneswar Temple",
    title: "Clean hygrometer and reset ADC",
    priority: "low", dueDate: new Date(Date.now() + 1000 * 60 * 60 * 120).toISOString(),
    completed: false, assignedTo: "R. Patnaik",
  },
];

export const regionStats: RegionStat[] = [
  { region: "North", stationsOnline: 6, totalStations: 6, healthyObs: 97.2, activeAnomalies: 3, criticalStations: 0 },
  { region: "South", stationsOnline: 4, totalStations: 4, healthyObs: 98.8, activeAnomalies: 1, criticalStations: 0 },
  { region: "East", stationsOnline: 3, totalStations: 4, healthyObs: 92.5, activeAnomalies: 2, criticalStations: 0 },
  { region: "West", stationsOnline: 3, totalStations: 4, healthyObs: 89.3, activeAnomalies: 2, criticalStations: 1 },
  { region: "Central", stationsOnline: 2, totalStations: 2, healthyObs: 96.1, activeAnomalies: 1, criticalStations: 0 },
  { region: "Northeast", stationsOnline: 1, totalStations: 2, healthyObs: 45.0, activeAnomalies: 1, criticalStations: 1 },
];

export function getStationById(id: string): Station | undefined {
  return stations.find((s) => s.id === id);
}

export function getAnomalyById(id: string): Anomaly | undefined {
  return demoAnomalies.find((a) => a.id === id);
}

export function getAnomaliesByStation(stationId: string): Anomaly[] {
  return demoAnomalies.filter((a) => a.stationId === stationId);
}
