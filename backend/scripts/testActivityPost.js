// Posts a generated fixture straight to a running backend's
// POST /api/activities, so you can test Phase 2 end-to-end without
// physically running outside.
//
// 1. Run `node scripts/generateGpsFixtures.js` first (or reuse existing
//    fixtures in scripts/fixtures/).
// 2. Log in as one of your Phase 1 test users to get a real access token
//    (e.g. via curl against your /api/auth/login route, or your browser's
//    devtools/localStorage after logging in through the UI).
// 3. Run:
//      ACCESS_TOKEN=<token> node scripts/testActivityPost.js loopRun
//    (fixture name = filename in scripts/fixtures/ without .json; defaults
//    to "loopRun" if omitted)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixtureName = process.argv[2] || 'loopRun';
const apiBase = process.env.API_BASE_URL || 'http://localhost:5000/api';
const accessToken = process.env.ACCESS_TOKEN;

if (!accessToken) {
  console.error('Set ACCESS_TOKEN=<your JWT access token> before running this script.');
  process.exit(1);
}

const fixturePath = path.join(__dirname, 'fixtures', `${fixtureName}.json`);
const gpsPath = JSON.parse(readFileSync(fixturePath, 'utf-8'));

const res = await fetch(`${apiBase}/activities`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ gpsPath }),
});

const data = await res.json();
console.log(`Status: ${res.status}`);
console.log(JSON.stringify(data, null, 2));
