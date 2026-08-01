// Generates synthetic GPS path fixtures so you can exercise every Phase 2
// branch (loop, line, short run, vehicle) without physically running
// outdoors. Run with: `node scripts/generateGpsFixtures.js` from /backend.
//
// Writes JSON files to scripts/fixtures/ — each is just the gpsPath array
// your frontend would normally collect, ready to POST straight to
// /api/activities as { gpsPath: <file contents> }.

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'fixtures');
mkdirSync(OUT_DIR, { recursive: true });

// Center the fixtures on a real place so they look sane on a map — swap
// this for wherever you actually want to test.
const CENTER = { lat: 29.1492, lng: 75.7217 }; // Hisar, Haryana
const M_PER_DEG_LAT = 111320;

const toRad = (d) => (d * Math.PI) / 180;
const metersToDegLat = (m) => m / M_PER_DEG_LAT;
const metersToDegLng = (m, atLat) => m / (M_PER_DEG_LAT * Math.cos(toRad(atLat)));

function loopPath({ radiusM, points, secondsPerPoint, startTime, eleAmplitude = 3 }) {
  const path = [];
  const start = new Date(startTime).getTime();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = metersToDegLat(radiusM * Math.sin(angle));
    const dLng = metersToDegLng(radiusM * Math.cos(angle), CENTER.lat);
    const ele = 250 + eleAmplitude * Math.sin((i / points) * 4 * Math.PI);
    path.push({
      lat: CENTER.lat + dLat,
      lng: CENTER.lng + dLng,
      ele,
      t: new Date(start + i * secondsPerPoint * 1000).toISOString(),
    });
  }
  return path;
}

function straightPath({ totalDistanceM, points, secondsPerPoint, startTime, bearingDeg = 45 }) {
  const path = [];
  const start = new Date(startTime).getTime();
  const bearing = toRad(bearingDeg);
  for (let i = 0; i <= points; i++) {
    const d = (i / points) * totalDistanceM;
    const dLat = metersToDegLat(d * Math.cos(bearing));
    const dLng = metersToDegLng(d * Math.sin(bearing), CENTER.lat);
    path.push({
      lat: CENTER.lat + dLat,
      lng: CENTER.lng + dLng,
      ele: 250,
      t: new Date(start + i * secondsPerPoint * 1000).toISOString(),
    });
  }
  return path;
}

const now = new Date().toISOString();

const fixtures = {
  // ~1.2km loop at running pace — should generate a "loop" territory (Phase 3).
  loopRun: loopPath({ radiusM: 170, points: 40, secondsPerPoint: 10, startTime: now }),

  // ~5km loop at running pace — used to sanity-check calories land in a
  // believable range (~380 kcal @ 70kg here, comfortably inside 250-450).
  fiveKLoopRun: loopPath({ radiusM: 795, points: 120, secondsPerPoint: 5000 / 120 / (10.5 * 1000 / 3600), startTime: now }),

  // 600m straight path — under the 1km minimum, should save with
  // isValidForTerritory: false.
  shortRun: straightPath({ totalDistanceM: 600, points: 20, secondsPerPoint: 12, startTime: now }),

  // 5km straight path at a steady ~40km/h — should be classified
  // activityType: "vehicle" and get isValidForTerritory: false.
  vehicleTrip: straightPath({ totalDistanceM: 5000, points: 60, secondsPerPoint: 5000 / 60 / (40 * 1000 / 3600), startTime: now }),

  // 2km straight walking path (non-loop) — should generate a "line" ribbon
  // territory once Phase 3 exists; for Phase 2 just confirm isLoop: false
  // and isValidForTerritory: true.
  lineWalk: straightPath({ totalDistanceM: 2000, points: 80, secondsPerPoint: 2000 / 80 / (5 * 1000 / 3600), startTime: now }),
};

for (const [name, gpsPath] of Object.entries(fixtures)) {
  const filePath = path.join(OUT_DIR, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(gpsPath, null, 2));
  console.log(`wrote ${gpsPath.length} points -> ${filePath}`);
}
