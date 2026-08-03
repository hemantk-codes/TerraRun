// PHASE 2/5 test helper — NOT part of the running app. POSTs a simulated
// ~1.2km loop run to POST /api/activities so you can verify the full
// calorie → territory → Calons chain without needing a real outdoor GPS
// run or a mobile device.
//
// Requires:
//   - backend running (npm run dev / npm run dev:backend)
//   - a logged-in test user's JWT access token
//
// Getting ACCESS_TOKEN: log in through the actual frontend, then open
// browser devtools → Network tab → find any authenticated request (e.g. to
// /api/profile) → check its "Authorization" header, OR check
// Application/Storage tab for wherever Phase 1's AuthContext stores it
// (commonly localStorage). Copy just the token string (no "Bearer " prefix).
//
// ⚠️ If your auth middleware reads the token from an httpOnly COOKIE
// instead of an Authorization header, the Bearer-header approach below
// won't authenticate. In that case this script can't easily impersonate a
// browser session — simplest fix is to temporarily log the decoded
// req.user in your auth middleware, or briefly relax that one route while
// testing, then revert.
//
// Usage:
//   ACCESS_TOKEN=<your JWT> node backend/scripts/testRun.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('Set ACCESS_TOKEN=<your JWT> before running this script. See the comment block at the top of this file for how to get one.');
  process.exit(1);
}

const fixturePath = path.join(__dirname, 'fixtures', 'sampleLoopRun.json');
const gpsPath = JSON.parse(readFileSync(fixturePath, 'utf-8'));

async function main() {
  const res = await fetch(`${API_BASE_URL}/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ gpsPath }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error(`[testRun] Request failed (${res.status}):`, body);
    process.exit(1);
  }

  const { activity, territory, calonsEarned } = body;
  console.log('[testRun] --- Activity ---');
  console.log(`  distanceKm:          ${activity.distanceKm.toFixed(3)}`);
  console.log(`  calories:            ${activity.calories.toFixed(1)}`);
  console.log(`  isLoop:              ${activity.isLoop}`);
  console.log(`  isValidForTerritory: ${activity.isValidForTerritory}`);
  console.log('[testRun] --- Territory ---');
  console.log(territory ? `  shapeType: ${territory.shapeType}, areaSqm: ${territory.areaSqm.toFixed(1)}` : '  (none)');
  console.log('[testRun] --- Calons ---');
  console.log(`  calonsEarned: ${calonsEarned}`);
}

main().catch((err) => {
  console.error('[testRun] Error:', err);
  process.exit(1);
});
