/**
 * gen-imd-stations.mjs
 *
 * Maintains the reduced IMD weather-station network embedded in
 * skyguard-app/src/lib/imd-stations.ts (3-4 stations per state/UT).
 *
 * The app previously shipped the complete IndianWeatherAPI/IMD list of 1150
 * stations — far more than the map, alerts and dashboards need, and many of
 * them carried unresolved geocodes hundreds of kilometres off target. The
 * catalog was reduced to a representative network (state capital + major
 * cities first, then geographically spread stations); this script keeps that
 * reduced file correct and reproducible:
 *
 *   1. STATE_ALIASES — merge legacy/duplicate state names (e.g. the split
 *      "Daman & Diu" UT name into the merged UT).
 *   2. COORD_FIXES   — replace wrong or fallback geocodes with the station's
 *      real coordinates (all `approximate: false` afterwards).
 *   3. DROPS         — remove stations that are not in Indian territory or
 *      whose identity in the source list could not be resolved.
 *   4. ADD_STATIONS  — best-effort top-up so every state/UT keeps 3-4 stations.
 *   5. Audits        — per-state counts, coordinate collisions, points outside
 *      India and >800 km outliers are printed before anything is written.
 *
 * Run:  node scripts/gen-imd-stations.mjs            # rewrites the data file
 *       node scripts/gen-imd-stations.mjs --dry-run   # audit only
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "skyguard-app/src/lib/imd-stations.ts");

// Target size of the retained network: 3-4 stations per state/UT.
const MAX_PER_STATE = 4;
const MIN_PER_STATE = 3;

// Legacy state names that must collapse into the current official state/UT.
const STATE_ALIASES = {
  "Daman & Diu": "Dadra & Nagar Haveli and Daman & Diu",
};

// slug -> [latitude, longitude] for stations whose stored coordinates are wrong
// (bad geocode or deterministic fallback). Coordinates are the real station /
// city locations, so these stations no longer need an `approximate` flag.
const COORD_FIXES = {
  // Andaman & Nicobar Islands
  carnicobar: [9.152, 92.82],
  "maya bandar": [12.9167, 92.9],
  nancowrie: [7.9919, 93.5489],
  // Arunachal Pradesh
  "kameng-bichom dam": [27.0526, 92.4947],
  passighat: [28.0667, 95.3333],
  ranganadi: [27.3361, 93.9761],
  // Chandigarh
  "chandigarh-mohali": [30.7046, 76.7179],
  "chandigarh-panchkula": [30.6942, 76.8606],
  // Chhattisgarh
  "patelpali raigarh": [21.8974, 83.395],
  // Dadra & Nagar Haveli and Daman & Diu
  "dadra & nagar haveli": [20.269, 72.947],
  // Delhi
  "new delhi-ayanagar": [28.5006, 77.1331],
  // Goa
  "panjim-pernem": [15.7199, 73.7952],
  "panjim-old goa": [15.5009, 73.912],
  "panjim-mapusa": [15.5937, 73.8142],
  // Ladakh
  "diskit nubra": [34.55, 77.5667],
  // Lakshadweep
  kavarati: [10.5669, 72.642],
  "amini divi": [11.1239, 72.7258],
  // Mizoram
  champhai: [23.4728, 93.3294],
  "aizwal-lengpui": [23.84, 92.6197],
  // Nagaland
  "kohima-dimapur": [25.902, 93.726],
  // Odisha
  "bhubneshwar-cuttack": [20.2961, 85.8245],
  malkangiri: [18.353, 81.8772],
  // Puducherry
  thattanchavady: [11.935, 79.812],
  // Station-level corrections (source stored the parent city centre instead)
  "kolkata-alipur": [22.5352, 88.3319],
  "mumbai-borivali": [19.2307, 72.8567],
  "pune-lohegaon airport": [18.5821, 73.9197],
  "chennai-ennore": [13.2167, 80.3167],
  "teesta iii": [27.603, 88.65],
};

// States/UTs where the upstream city list itself contains fewer than three
// locations. The gap is reported as a note (not a failure) by the audit.
const SOURCE_LIMITATIONS = {
  Manipur: "only Imphal exists in the source city list",
  Meghalaya: "only Shillong and Cherrapunji exist in the source city list",
  Tripura: "only Agartala and Kailashahar exist in the source city list",
};

// Stations removed from the reduced network:
//   jafarpur — source geocode resolves to West Bengal, not the Delhi AWS.
//   gilgit / skardu — not in Indian-administered territory, so they cannot be
//   part of an India-wide weather map.
const DROPS = new Set(["jafarpur", "gilgit", "skardu"]);

// Top-ups: restored from the original 1150-station list so a state that lost
// stations to DROPS keeps its 3-4 station coverage.
const ADD_STATIONS = [
  {
    id: "IMD-42034",
    slug: "leh",
    name: "Leh",
    state: "Ladakh",
    district: "Leh",
    region: "north",
    imdId: "42034",
    // Source row had a broken geocode (49.49N, 0.11E); restored with the real
    // Leh observatory coordinates.
    latitude: 34.1526,
    longitude: 77.5771,
    approximate: false,
  },
  {
    id: "IMD-43346",
    slug: "karaikal",
    name: "Karaikal",
    // Karaikal is a Puducherry district; the upstream list files it under
    // Tamil Nadu, which left Puducherry with only two stations.
    state: "Puducherry",
    district: "Karaikal",
    region: "south",
    imdId: "43346",
    latitude: 10.91667,
    longitude: 79.83333,
    approximate: false,
  },
];

const INDIA_BOUNDS = { latMin: 6.0, latMax: 37.7, lngMin: 67.5, lngMax: 97.5 };

const R = 6371;
function dist(a, b) {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function coordKey(s) {
  return s.latitude.toFixed(3) + "," + s.longitude.toFixed(3);
}

function parseCatalog() {
  const file = readFileSync(SRC, "utf8");
  const m = file.match(/const rawImdStations[^]*?=\s*\[([\s\S]*?)\n\s*\];/);
  if (!m) throw new Error("rawImdStations array not found in " + SRC);
  const stations = new Function("return [" + m[1] + "]")();
  const bad = stations.filter((s) => !s || typeof s.slug !== "string" || typeof s.state !== "string");
  if (bad.length) {
    throw new Error(
      "rawImdStations is malformed: " + bad.length + " entr" + (bad.length === 1 ? "y" : "ies") +
        " are not station objects (check for a stray comma or a missing brace).",
    );
  }
  return { file, stations };
}

function applyRules(stations) {
  const out = [];
  const dropped = [];
  const renamed = [];
  const fixed = [];
  const usedFixes = new Set();

  for (const s of stations) {
    if (DROPS.has(s.slug)) {
      dropped.push(s);
      continue;
    }
    let next = s;
    const merged = STATE_ALIASES[s.state];
    if (merged && merged !== s.state) {
      renamed.push(s.slug + ": " + s.state + " -> " + merged);
      next = { ...next, state: merged };
    }
    const fix = COORD_FIXES[s.slug];
    if (fix) {
      usedFixes.add(s.slug);
      fixed.push(s.slug + ": " + coordKey(s) + "  ->  " + fix[0] + "," + fix[1]);
      next = { ...next, latitude: fix[0], longitude: fix[1], approximate: false };
    }
    out.push(next);
  }

  for (const extra of ADD_STATIONS) {
    if (out.some((s) => s.slug === extra.slug && s.state === extra.state)) continue;
    const last = out.map((s) => s.state).lastIndexOf(extra.state);
    out.splice(last + 1, 0, { ...extra });
  }

  const unusedFixKeys = Object.keys(COORD_FIXES).filter((k) => !usedFixes.has(k));
  return { stations: out, dropped, renamed, fixed, unusedFixKeys };
}

function audit(stations) {
  const problems = [];
  const notes = [];
  const byState = new Map();
  for (const s of stations) {
    if (!byState.has(s.state)) byState.set(s.state, []);
    byState.get(s.state).push(s);
  }

  for (const [state, list] of byState) {
    if (list.length > MAX_PER_STATE) problems.push(state + ": " + list.length + " stations (max " + MAX_PER_STATE + ")");
    if (list.length < MIN_PER_STATE) {
      const why = SOURCE_LIMITATIONS[state];
      const msg = state + ": only " + list.length + " station(s)" + (why ? " — " + why : "");
      (why ? notes : problems).push(msg);
    }
    for (const s of list) {
      if (s.approximate) problems.push(state + " :: " + s.name + " still uses fallback (approximate) coordinates");
      if (
        s.latitude < INDIA_BOUNDS.latMin || s.latitude > INDIA_BOUNDS.latMax ||
        s.longitude < INDIA_BOUNDS.lngMin || s.longitude > INDIA_BOUNDS.lngMax
      ) {
        problems.push(state + " :: " + s.name + " lies outside India (" + coordKey(s) + ")");
      }
      const peers = list.filter((o) => o !== s);
      if (peers.length) {
        const near = Math.min(...peers.map((p) => dist(s, p)));
        if (near > 800) problems.push(state + " :: " + s.name + " is " + Math.round(near) + " km from its closest same-state peer");
      }
    }
  }

  // Duplicate coordinates would be silently collapsed at runtime by
  // deduplicateByCoords(), so they have to be caught at generation time.
  const seen = new Map();
  for (const s of stations) {
    const k = coordKey(s);
    if (seen.has(k)) problems.push("duplicate coordinates " + k + ": " + seen.get(k) + " / " + s.name);
    else seen.set(k, s.name);
  }
  return { byState, problems, notes };
}

function formatStation(s) {
  return (
    "  { id: \"" + s.id + "\", slug: \"" + s.slug + "\", name: \"" + s.name +
    "\", state: \"" + s.state + "\", district: \"" + s.district +
    "\", region: \"" + s.region + "\", imdId: \"" + s.imdId +
    "\", latitude: " + s.latitude + ", longitude: " + s.longitude +
    ", approximate: " + s.approximate + " }"
  );
}

function main() {
  const { file, stations: parsed } = parseCatalog();
  const { stations, dropped, renamed, fixed, unusedFixKeys } = applyRules(parsed);
  const { byState, problems, notes } = audit(stations);

  if (dropped.length) {
    console.log("Dropped (" + dropped.length + "): " + dropped.map((s) => s.name + " [" + s.state + "]").join(", "));
  }
  if (renamed.length) console.log("State names merged (" + renamed.length + "): " + renamed.join(", "));
  if (fixed.length) {
    console.log("Coordinate fixes (" + fixed.length + "):");
    for (const line of fixed) console.log("  " + line);
  }
  if (unusedFixKeys.length) {
    console.warn("WARNING: COORD_FIXES entries never matched a station: " + unusedFixKeys.join(", "));
  }

  console.log("\nPer-state network (" + byState.size + " states/UTs, " + stations.length + " stations):");
  for (const state of [...byState.keys()].sort((a, b) => a.localeCompare(b))) {
    const list = byState.get(state);
    console.log("  " + state.padEnd(42) + " " + list.length + "  " + list.map((s) => s.name).join(", "));
  }

  if (notes.length) {
    console.log("\nNotes (" + notes.length + "):");
    for (const n of notes) console.log("  " + n);
  }
  if (problems.length) {
    console.log("\nAudit problems (" + problems.length + "):");
    for (const p of problems) console.log("  " + p);
  } else {
    console.log("\nAudit: clean — no state above 4, no collisions, no geocode outliers, no out-of-India points.");
  }

  const legacy = ["COORDINATE_OVERRIDES", "imdStationsWithOverrides"].filter((needle) => file.includes(needle));
  if (legacy.length) {
    console.warn("\nWARNING: imd-stations.ts still contains legacy runtime rewriting: " + legacy.join(", "));
  }

  if (process.argv.includes("--dry-run")) {
    console.log("\n(--dry-run) file not written");
    return;
  }

  const eol = file.includes("\r\n") ? "\r\n" : "\n";
  const arrayBlock =
    "const rawImdStations: ImdStation[] = [" + eol +
    stations.map(formatStation).join("," + eol) + eol +
    "];";
  const withArray = file.replace(/const rawImdStations[^]*?=\s*\[([\s\S]*?)\n\s*\];/, arrayBlock);
  const header = [
    "// Generated by scripts/gen-imd-stations.mjs — DO NOT EDIT BY HAND.",
    "// Reduced IMD network: " + stations.length + " representative stations (3-4 per state/UT),",
    "//   trimmed from the 1150-station ShagunDwivedi/IndianWeatherAPI city list — state capital",
    "//   and major cities first, then geographically-spread AWS.",
    "// Coordinates are verified station locations (approximate = deterministic fallback).",
    "",
  ].join(eol);
  const withHeader = withArray.replace(/^[\s\S]{0,600}?(?=export type ImdRegion)/, header);
  // Drop blank-line runs left behind by earlier revisions of the file.
  const tidied = withHeader.replace(/(?:\r?\n){3,}/g, eol + eol);
  writeFileSync(SRC, tidied, "utf8");
  console.log("\nWrote " + stations.length + " stations to imd-stations.ts");
}

main();
