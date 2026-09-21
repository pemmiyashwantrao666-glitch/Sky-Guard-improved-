/**
 * audit-imd-network.mjs — read-only verification of the reduced IMD network
 * embedded in skyguard-app/src/lib/imd-stations.ts.
 *
 * Checks the invariants the app relies on: 3-4 stations per state/UT, unique
 * ids, unique coordinates (deduplicateByCoords would silently drop clashes),
 * no fallback geocodes and no points outside India.
 *
 * Run: node scripts/audit-imd-network.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "skyguard-app/src/lib/imd-stations.ts");
const MAX_PER_STATE = 4;

const file = readFileSync(SRC, "utf8");
const m = file.match(/const rawImdStations[^]*?=\s*\[([\s\S]*?)\n\s*\];/);
if (!m) throw new Error("rawImdStations array not found in " + SRC);
const stations = new Function("return [" + m[1] + "]")();

const byState = new Map();
for (const s of stations) {
  if (!byState.has(s.state)) byState.set(s.state, []);
  byState.get(s.state).push(s);
}

// Generous per-state/UT bounding boxes (lat/lng min,max). A station resolved to
// the wrong place often still lands inside India, so the India-wide bounds
// check alone is not enough — this catches e.g. a Meghalaya station geocoded
// into Nagaland.
const STATE_BOUNDS = {
  "Andaman & Nicobar Islands": [6.5, 14.0, 92.0, 94.5],
  "Andhra Pradesh": [12.5, 19.5, 76.5, 84.9],
  "Arunachal Pradesh": [26.5, 29.5, 91.5, 97.5],
  Assam: [24.0, 28.0, 89.5, 96.1],
  Bihar: [24.2, 27.6, 83.2, 88.4],
  Chandigarh: [30.5, 31.0, 76.5, 77.0],
  Chhattisgarh: [17.7, 24.2, 80.1, 84.4],
  // Daman (20.40N 72.83E) + Diu island (20.71N 70.98E) + Silvassa (20.27N 73.02E)
  "Dadra & Nagar Haveli and Daman & Diu": [19.9, 21.0, 70.5, 73.5],
  Delhi: [28.3, 28.9, 76.8, 77.5],
  Goa: [14.8, 15.9, 73.6, 74.4],
  Gujarat: [20.0, 24.8, 68.0, 74.6],
  Haryana: [27.6, 30.9, 74.4, 77.6],
  "Himachal Pradesh": [30.3, 33.3, 75.5, 79.1],
  "Jammu & Kashmir": [32.2, 35.0, 73.5, 79.5],
  Jharkhand: [21.9, 25.4, 83.2, 87.9],
  Karnataka: [11.5, 18.5, 74.0, 78.6],
  Kerala: [8.2, 12.9, 74.8, 77.5],
  Ladakh: [32.2, 35.7, 76.0, 80.3],
  Lakshadweep: [8.0, 12.0, 71.5, 74.0],
  "Madhya Pradesh": [21.0, 26.9, 74.0, 82.8],
  Maharashtra: [15.6, 22.1, 72.6, 80.9],
  Manipur: [23.8, 25.7, 92.9, 94.8],
  Meghalaya: [25.0, 26.2, 89.7, 92.9],
  Mizoram: [21.9, 24.5, 92.2, 93.5],
  Nagaland: [25.1, 27.1, 93.3, 95.3],
  Odisha: [17.7, 22.6, 81.3, 87.6],
  Puducherry: [10.8, 12.1, 79.6, 80.0],
  Punjab: [29.5, 32.6, 73.8, 76.9],
  Rajasthan: [23.0, 30.2, 69.4, 78.3],
  Sikkim: [27.0, 28.2, 88.0, 89.0],
  "Tamil Nadu": [8.0, 13.6, 76.2, 80.4],
  Telangana: [15.8, 19.9, 77.2, 81.3],
  Tripura: [22.9, 24.6, 91.1, 92.4],
  "Uttar Pradesh": [23.8, 30.4, 77.0, 84.7],
  Uttarakhand: [28.7, 31.1, 77.5, 81.1],
  "West Bengal": [21.5, 27.3, 85.8, 89.9],
};

const problems = [];
const notes = [];

const ids = new Set();
const coords = new Map();
for (const s of stations) {
  if (ids.has(s.id)) problems.push("duplicate id " + s.id + " (" + s.name + ")");
  ids.add(s.id);

  const k = s.latitude.toFixed(3) + "," + s.longitude.toFixed(3);
  if (coords.has(k)) problems.push("duplicate coordinates " + k + ": " + coords.get(k) + " / " + s.name);
  else coords.set(k, s.name);

  if (s.approximate) problems.push(s.state + " :: " + s.name + " still uses fallback coordinates");
  if (s.latitude < 6 || s.latitude > 37.7 || s.longitude < 67.5 || s.longitude > 97.5) {
    problems.push(s.state + " :: " + s.name + " lies outside India (" + k + ")");
  }
  const box = STATE_BOUNDS[s.state];
  if (!box) problems.push(s.state + " :: no state bounding box defined in audit script");
  else if (s.latitude < box[0] || s.latitude > box[1] || s.longitude < box[2] || s.longitude > box[3]) {
    problems.push(
      s.state + " :: " + s.name + " (" + k + ") lies outside its state bounds " +
      box[0] + "-" + box[1] + "N, " + box[2] + "-" + box[3] + "E",
    );
  }
  for (const field of ["id", "slug", "name", "state", "district", "region", "imdId"]) {
    if (!s[field]) problems.push(s.name + ": missing " + field);
  }
}

for (const [state, list] of byState) {
  if (list.length > MAX_PER_STATE) problems.push(state + ": " + list.length + " stations (max " + MAX_PER_STATE + ")");
  if (list.length < 3) notes.push(state + ": " + list.length + " station(s) — limited by the upstream city list");
}

console.log("Catalog: " + stations.length + " stations across " + byState.size + " states/UTs\n");
const stateNames = [...byState.keys()].sort((a, b) => a.localeCompare(b));
const width = Math.max(...stateNames.map((s) => s.length));
for (const state of stateNames) {
  const list = byState.get(state);
  console.log("  " + state.padEnd(width) + "  " + list.length + "  " + list.map((s) => s.name).join(", "));
}

const counts = [...byState.values()].map((l) => l.length);
console.log(
  "\nPer-state counts: min " + Math.min(...counts) + ", max " + Math.max(...counts) +
  ", avg " + (stations.length / byState.size).toFixed(1),
);
if (notes.length) console.log("\nNotes:\n" + notes.map((n) => "  " + n).join("\n"));
if (problems.length) {
  console.log("\nPROBLEMS (" + problems.length + "):\n" + problems.map((p) => "  " + p).join("\n"));
  process.exitCode = 1;
} else {
  console.log("\nAll checks passed.");
}
