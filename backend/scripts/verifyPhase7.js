// PHASE 7 — Standalone verification script.
//
// RUN IT FROM THE backend/ FOLDER (so dotenv finds your .env, same as
// src/server.js expects):
//
//   cd backend
//   node scripts/verifyPhase7.js
//
// WHAT THIS DOES: connects directly to your real MongoDB (the same
// MONGODB_URI your dev server uses) and calls your actual Phase 7 code —
// splitEngine.resolveSplits(), and the resolveSplit / getMyPendingSplits
// controllers — directly, with a hand-built GPS path and two throwaway
// test users. It does NOT start an HTTP server and does NOT need your
// Phase 1 login flow: controller functions are called directly with a
// mocked request object (`{ userId, params, body }`), which is exactly
// the shape your real requireAuth middleware produces after a real login,
// so this exercises the same code your live server runs.
//
// It creates two fixed-email test users and cleans up everything it
// creates (both users, all territories, all notifications) in a `finally`
// block — safe to run again and again, including against your real dev DB.
//
// Exits with code 0 if every check passed, 1 if anything failed — so you
// can also wire this into a CI step later if you want.

import 'dotenv/config';
import mongoose from 'mongoose';
import * as turf from '@turf/turf';

import { connectDB } from '../src/config/db.js';
import { User, Territory, Notification } from '../src/models/index.js';
import { resolveSplits } from '../src/utils/splitEngine.js';
import { resolveSplit, getMyPendingSplits } from '../src/controllers/territoryController.js';

// ---------------------------------------------------------------------------
// tiny test-runner helpers
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  \x1b[32m✅ PASS\x1b[0m  ${label}`);
    passCount += 1;
  } else {
    console.log(`  \x1b[31m❌ FAIL\x1b[0m  ${label}`);
    failCount += 1;
  }
}

function section(title) {
  console.log(`\n\x1b[36m── ${title} ──\x1b[0m`);
}

function approx(a, b, tolerance = 0.15) {
  return Math.abs(a - b) <= tolerance * Math.max(Math.abs(b), 1);
}

// Mocks Express's (req, res, next) enough for our two controllers, which
// only ever read req.userId / req.params / req.body and call
// res.status(code).json(data) or next(err).
function mockReqRes({ userId, params = {}, body = {} } = {}) {
  const req = { userId, params, body };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  let nextError = null;
  const next = (err) => {
    nextError = err;
  };
  return { req, res, next, getNextError: () => nextError };
}

// ---------------------------------------------------------------------------
// test fixtures — a 120m x 120m square territory, and a straight path that
// crosses it once near the bottom (so the split is ~30% / ~70%, not a
// coin-flip 50/50 — makes "keep the larger piece" an unambiguous check)
// ---------------------------------------------------------------------------
const DEG_PER_METER = 1 / 111320; // same rough conversion territoryEngine.js uses
const CENTER = [77.209, 28.6139]; // [lng, lat] — arbitrary, matches this codebase's default map center
const HALF_WIDTH_M = 60; // → ~120m x 120m square
const hw = HALF_WIDTH_M * DEG_PER_METER;

const VICTIM_EMAIL = 'phase7-verify-victim@test.local';
const INVADER_EMAIL = 'phase7-verify-invader@test.local';

function buildSquarePolygon(center) {
  const [cx, cy] = center;
  const ring = [
    [cx - hw, cy - hw],
    [cx + hw, cy - hw],
    [cx + hw, cy + hw],
    [cx - hw, cy + hw],
    [cx - hw, cy - hw],
  ];
  return turf.polygon([ring]);
}

// A straight horizontal line that enters the west edge and exits the east
// edge at `yOffset` above center — well outside the square on both ends so
// there's no ambiguity about where the boundary crossings are.
function buildPiercingGpsPath(center, yOffsetRatio) {
  const [cx, cy] = center;
  const y = cy + hw * yOffsetRatio;
  const runOutM = 40; // how far past each edge the path extends
  const runOut = runOutM * DEG_PER_METER;
  const coords = [
    [cx - hw - runOut, y],
    [cx, y],
    [cx + hw + runOut, y],
  ];
  const baseTime = Date.now();
  return coords.map(([lng, lat], i) => ({
    lat,
    lng,
    ele: 0,
    t: new Date(baseTime + i * 30_000), // 30s apart, just needs to be increasing
  }));
}

async function cleanup() {
  const users = await User.find({ email: { $in: [VICTIM_EMAIL, INVADER_EMAIL] } });
  const userIds = users.map((u) => u._id);
  if (userIds.length) {
    await Territory.deleteMany({ ownerId: { $in: userIds } });
    await Notification.deleteMany({ userId: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  }
}

async function main() {
  await connectDB();
  console.log('\n=== PHASE 7 VERIFICATION ===');
  console.log('(connected to', mongoose.connection.name + ')');

  // Wipe any leftovers from a previous failed run before we start.
  await cleanup();

  const victim = await User.create({
    name: 'Phase7 Verify Victim',
    email: VICTIM_EMAIL,
    preferredColor: '#34D399',
  });
  const invader = await User.create({
    name: 'Phase7 Verify Invader',
    email: INVADER_EMAIL,
    preferredColor: '#F59E0B',
  });

  // -------------------------------------------------------------------
  // SCENARIO A — detection + cut, then the "reclaim" (do-nothing) path,
  // then confirm it can't be resolved a second time.
  // -------------------------------------------------------------------
  section('Scenario A: detect + cut, then "reclaim"');

  const victimPolygonA = buildSquarePolygon(CENTER);
  const originalAreaA = turf.area(victimPolygonA);

  let territoryA = await Territory.create({
    ownerId: victim._id,
    geometry: victimPolygonA.geometry,
    color: victim.preferredColor,
    areaSqm: originalAreaA,
    shapeType: 'loop',
    strength: originalAreaA,
  });

  const gpsPathA = buildPiercingGpsPath(CENTER, -0.4); // pierces near the bottom → ~30/70 split
  await resolveSplits({ gpsPath: gpsPathA }, invader);

  territoryA = await Territory.findById(territoryA._id);
  check('Victim territory has a pendingSplit after the pierce', Boolean(territoryA?.pendingSplit));

  const fragmentA = territoryA?.pendingSplit
    ? await Territory.findById(territoryA.pendingSplit.fragmentTerritoryId)
    : null;
  check('A fragment territory was created', Boolean(fragmentA));
  check('The fragment is owned by the invader', fragmentA && String(fragmentA.ownerId) === String(invader._id));
  check(
    'Victim kept the LARGER piece (remaining area > fragment area)',
    territoryA && fragmentA && territoryA.areaSqm > fragmentA.areaSqm
  );
  check(
    'Remaining + fragment area is a reasonable share of the original (blade width aside)',
    territoryA && fragmentA && territoryA.areaSqm + fragmentA.areaSqm >= originalAreaA * 0.8
  );

  const notificationA = territoryA?.pendingSplit?.notificationId
    ? await Notification.findById(territoryA.pendingSplit.notificationId)
    : null;
  check('A "territory_split" notification was created for the victim', notificationA?.type === 'territory_split');
  check('The notification is marked unresolved', notificationA?.payload?.resolved === false);

  // getMyPendingSplits — mocked as if the victim just logged in
  {
    const { req, res, next } = mockReqRes({ userId: victim._id });
    await getMyPendingSplits(req, res, next);
    const found = res.body?.pendingSplits?.find((p) => String(p.territoryId) === String(territoryA._id));
    check('GET pending-splits returns this territory for the victim', Boolean(found));
  }

  // resolveSplit — "reclaim"
  {
    const { req, res, next } = mockReqRes({
      userId: victim._id,
      params: { id: String(territoryA._id) },
      body: { action: 'reclaim' },
    });
    await resolveSplit(req, res, next);
    check('resolve-split "reclaim" responds 200', res.statusCode === 200);

    const territoryAfter = await Territory.findById(territoryA._id);
    check('pendingSplit is cleared after "reclaim"', territoryAfter?.pendingSplit == null);

    const fragmentStillThere = await Territory.findById(fragmentA._id);
    check('"reclaim" leaves the fragment as the invader\'s territory (not deleted)', Boolean(fragmentStillThere));
  }

  // resolveSplit called AGAIN on the same territory — must be refused
  {
    const { req, res } = mockReqRes({
      userId: victim._id,
      params: { id: String(territoryA._id) },
      body: { action: 'reclaim' },
    });
    await resolveSplit(req, res, () => {});
    check('Resolving the SAME split twice is rejected (no re-popup bug)', res.statusCode === 400);
  }

  // -------------------------------------------------------------------
  // SCENARIO B — a second, separate slice, resolved with "regenerate"
  // -------------------------------------------------------------------
  section('Scenario B: detect + cut, then "regenerate"');

  const CENTER_B = [CENTER[0] + 0.02, CENTER[1]]; // ~2km away, no overlap with scenario A
  const victimPolygonB = buildSquarePolygon(CENTER_B);
  const originalAreaB = turf.area(victimPolygonB);

  let territoryB = await Territory.create({
    ownerId: victim._id,
    geometry: victimPolygonB.geometry,
    color: victim.preferredColor,
    areaSqm: originalAreaB,
    shapeType: 'loop',
    strength: originalAreaB,
  });

  const gpsPathB = buildPiercingGpsPath(CENTER_B, -0.4);
  await resolveSplits({ gpsPath: gpsPathB }, invader);

  territoryB = await Territory.findById(territoryB._id);
  check('Second victim territory has a pendingSplit', Boolean(territoryB?.pendingSplit));

  const fragmentBId = territoryB?.pendingSplit?.fragmentTerritoryId;
  const fragmentBAreaBefore = territoryB?.pendingSplit?.fragmentAreaSqm;
  const victimBefore = await User.findById(victim._id);

  {
    const { req, res } = mockReqRes({
      userId: victim._id,
      params: { id: String(territoryB._id) },
      body: { action: 'regenerate', placement: 'upper' },
    });
    await resolveSplit(req, res, () => {});
    check('resolve-split "regenerate" responds 200', res.statusCode === 200);
    check('Response includes a newTerritory', Boolean(res.body?.newTerritory));

    const expectedNewArea = fragmentBAreaBefore * 0.7; // matches REGENERATE_AREA_RATIO in territoryController.js
    check(
      'New territory is ~70% of the fragment\'s area',
      res.body?.newTerritory && approx(res.body.newTerritory.areaSqm, expectedNewArea)
    );

    const fragmentGone = await Territory.findById(fragmentBId);
    check('"regenerate" deletes the orphaned fragment', fragmentGone == null);

    const territoryBAfter = await Territory.findById(territoryB._id);
    check('pendingSplit is cleared after "regenerate"', territoryBAfter?.pendingSplit == null);

    const victimAfter = await User.findById(victim._id);
    check(
      'Victim was awarded Calons for the new territory',
      victimAfter.calonsTotal > victimBefore.calonsTotal
    );
  }

  {
    const { req, res } = mockReqRes({
      userId: victim._id,
      params: { id: String(territoryB._id) },
      body: { action: 'regenerate', placement: 'upper' },
    });
    await resolveSplit(req, res, () => {});
    check('Resolving scenario B twice is also rejected', res.statusCode === 400);
  }
}

main()
  .catch((err) => {
    console.error('\n💥 Verification script crashed:', err);
    failCount += 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (err) {
      console.error('Cleanup failed (you may have leftover phase7-verify-* test data):', err);
    }
    await mongoose.disconnect();

    console.log('\n=== SUMMARY ===');
    console.log(`  ${passCount} passed, ${failCount} failed`);
    if (failCount === 0) {
      console.log('\x1b[32m✅ Phase 7 looks good — safe to move on.\x1b[0m\n');
      process.exit(0);
    } else {
      console.log('\x1b[31m❌ Something in Phase 7 needs a look before moving on.\x1b[0m\n');
      process.exit(1);
    }
  });
