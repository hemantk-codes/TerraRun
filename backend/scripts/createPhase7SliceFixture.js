import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, 'fixtures', 'phase7SliceRun.json');

const CENTER_LAT = 28.61955;

// Start/end are roughly 575 m on either side of the target.
// Total distance is about 1.15 km, so it clears the 1 km
// minimum required for a valid territory activity.
const START_LNG = 77.18330;
const END_LNG = 77.19470;

const POINTS = 80;
const SECONDS_PER_POINT = 10;

const startTime = Date.now();

const gpsPath = [];

for (let i = 0; i <= POINTS; i++) {
  const fraction = i / POINTS;

  gpsPath.push({
    lat: CENTER_LAT,
    lng: START_LNG + (END_LNG - START_LNG) * fraction,
    ele: 250,
    t: new Date(
      startTime + i * SECONDS_PER_POINT * 1000
    ).toISOString(),
  });
}

writeFileSync(
  OUT_PATH,
  JSON.stringify(gpsPath, null, 2)
);

console.log(`Created ${gpsPath.length} GPS points.`);
console.log(`Fixture: ${OUT_PATH}`);
console.log(`Start: ${gpsPath[0].lat}, ${gpsPath[0].lng}`);
console.log(`End:   ${gpsPath[gpsPath.length - 1].lat}, ${gpsPath[gpsPath.length - 1].lng}`);
console.log(`Total duration: ${(POINTS * SECONDS_PER_POINT) / 60} minutes`);