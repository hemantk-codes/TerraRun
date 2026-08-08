// PHASE 6 — Definition-of-Done automated test harness
//
// Run: node backend/scripts/testPhase6Invasion.js   (from repo root)
//  or: node scripts/testPhase6Invasion.js            (from backend/)
//
// Exits 0 if every check passes, 1 otherwise — safe to wire into a CI step
// or just run by hand before/after touching invasion code.
//
// ============================================================
// WHAT THIS ACTUALLY EXERCISES (read this before trusting the output)
// ============================================================
// Scenarios 1-3 (the overlap/siege/capture checks) call
// `resolveInvasions(territory, invaderUser)` DIRECTLY — this is the real,
// unmodified Phase 6 production function from
// backend/src/utils/invasionEngine.js, imported as-is, NOT a mock or a
// reimplementation. It's the exact same function territoryEngine.js's
// generateTerritory() calls via its onBeforeSave hook, which is the exact
// same function activityController.js's POST /api/activities wires in.
// What's skipped for these three scenarios is everything AROUND that
// function: Express, JWT auth, and — deliberately — Phase 3's calorie/GPS
// -driven geometry generation. That last part is skipped on purpose: this
// harness needs perfectly controlled, repeatable geometry (100% identical
// overlap, or zero overlap) to test the invasion math unambiguously, and
// Phase 3's simplify/rescale pipeline isn't built for that kind of exact
// control. For each attack, this script does exactly what
// generateTerritory() does internally — construct `new Territory({...})`,
// call the onBeforeSave hook, then `.save()` — just with hand-picked
// geometry instead of calorie-derived geometry.
//
// Scenario 4 (the non-overlap sanity check) is the one true end-to-end
// test: it calls the REAL `generateTerritory(activity, user, {
// onBeforeSave: resolveInvasions })`, exactly as activityController.js
// does, including Phase 3's real geometry pipeline. It proves the actual
// wiring (not just the invasion math in isolation) works.
//
// NOT covered here: the HTTP layer (Express routing, JWT auth
// middleware), and the siegeDamage-reset-to-zero codepath specifically for
// a PARTIAL capture (this script's overlaps are always exactly 100%, so
// every successful capture fully consumes the defender's territory —
// there's no partial-remainder case to reset siege damage against). If you
// want that covered too, it'd need a second, offset-square siege scenario;
// happy to add one if useful.
//
// ============================================================
// ISOLATION / CLEANUP
// ============================================================
// - Only touches the two real user documents named below (TEST1_ID,
//   TEST2_ID) — no other users are read or written.
// - Never mutates or deletes any PRE-EXISTING Territory/Notification
//   document. Every Territory/Notification this script creates has its
//   _id pushed into a tracking array the moment it's created; cleanup at
//   the end deletes ONLY those exact _ids — never a broad query-based
//   deleteMany (e.g. "by color" or "by region"), since that could catch a
//   real demo document by coincidence. Cleanup runs in a `finally` block,
//   so it still happens even if a check throws or fails partway.
// - Test territories additionally use a distinct marker color (#FF00FF)
//   and sit in two coordinate regions (0,0 and 10,10) nowhere near any
//   real running route, purely so they're easy to eyeball in
//   Atlas/Compass if you go looking mid-run.
// - Both users' calonsTotal/calonsWeekly/calonsMonthly are snapshotted
//   before anything runs and restored to those exact original values in
//   the same `finally` block, regardless of pass/fail.

import 'dotenv/config';
import mongoose from 'mongoose';
import * as turf from '@turf/turf';

import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Territory from '../src/models/Territory.js';
import Notification from '../src/models/Notification.js';

import { resolveInvasions } from '../src/utils/invasionEngine.js';
import { generateTerritory } from '../src/utils/territoryEngine.js';
import { POINTS_PER_SQM } from '../src/utils/calonsEngine.js';

// ============================================================
// CONFIG
// ============================================================
const TEST1_ID = '6a6c8f7f4c55e5abda1eaf4c';
const TEST2_ID = '6a6c90cf4c55e5abda1eaf55';

// Two coordinate regions, deliberately far from each other and from any
// plausible real running route, so no test polygon in this script can ever
// legitimately overlap a real one (or the other region).
const SIEGE_REGION = { lng: 0, lat: 0 }; // scenarios 1-3 (overlap/siege)
const NO_OVERLAP_REGION = { lng: 10, lat: 10 }; // scenario 4 (sanity check)

const TEST_TERRITORY_COLOR = '#FF00FF'; // magenta — easy to spot if you go looking
const MAX_SIEGE_ITERATIONS = 20; // safety cap so a real bug can't hang the script

// ============================================================
// Geometry helper — an exact axis-aligned square, used only for the
// controlled-overlap scenarios (1-3). Deliberately NOT reusing
// territoryEngine.js's shape generators here: those are Phase 3's
// calorie-driven, GPS-jitter-aware logic and aren't built for "give me
// exactly 100% overlap." Scenario 4 uses the real generators instead.
// ============================================================
function squareGeometry(centerLng, centerLat, halfSizeDeg) {
  return turf.polygon([
    [
      [centerLng - halfSizeDeg, centerLat - halfSizeDeg],
      [centerLng + halfSizeDeg, centerLat - halfSizeDeg],
      [centerLng + halfSizeDeg, centerLat + halfSizeDeg],
      [centerLng - halfSizeDeg, centerLat + halfSizeDeg],
      [centerLng - halfSizeDeg, centerLat - halfSizeDeg],
    ],
  ]).geometry;
}

// ============================================================
// Test report
// ============================================================
class TestReport {
  constructor() {
    this.results = [];
  }
  pass(label) {
    this.results.push({ label, ok: true });
    console.log(`[PASS] ${label}`);
  }
  fail(label, reason) {
    this.results.push({ label, ok: false, reason });
    console.log(`[FAIL] ${label}${reason ? ` — ${reason}` : ''}`);
  }
  check(label, condition, reason) {
    if (condition) this.pass(label);
    else this.fail(label, reason);
  }
  blank() {
    console.log('');
  }
  get allPassed() {
    return this.results.length > 0 && this.results.every((r) => r.ok);
  }
  printSummary() {
    console.log('\n=====================================');
    console.log(`RESULT: ${this.allPassed ? 'PASS' : 'FAIL'}`);
    console.log('=====================================');
    if (!this.allPassed) {
      const failed = this.results.filter((r) => !r.ok);
      console.log(`\n${failed.length} check(s) failed:`);
      for (const f of failed) {
        console.log(`  - ${f.label}${f.reason ? `: ${f.reason}` : ''}`);
      }
    }
  }
}

// ============================================================
// Cleanup tracking (see ISOLATION / CLEANUP header above)
// ============================================================
const createdTerritoryIds = [];
const createdNotificationIds = [];

async function trackTerritory(doc) {
  createdTerritoryIds.push(doc._id);
  return doc;
}

async function findNewNotifications(userId, sinceDate) {
  const docs = await Notification.find({ userId, createdAt: { $gte: sinceDate } }).sort({ createdAt: 1 });
  for (const d of docs) createdNotificationIds.push(d._id);
  return docs;
}

async function deleteTrackedTerritories() {
  if (createdTerritoryIds.length === 0) return;
  await Territory.deleteMany({ _id: { $in: createdTerritoryIds } });
  createdTerritoryIds.length = 0;
}

// ============================================================
// Scenario 1 — strong attacker, 100% overlap, instant full capture
// ============================================================
async function runStrongAttackerScenario(report) {
  console.log('--- Scenario 1: strong attacker (100% overlap) ---');

  await User.findByIdAndUpdate(TEST1_ID, { $set: { calonsTotal: 1000 } });
  await User.findByIdAndUpdate(TEST2_ID, { $set: { calonsTotal: 100 } });

  const geometry = squareGeometry(SIEGE_REGION.lng, SIEGE_REGION.lat, 0.001);
  const areaSqm = turf.area(geometry);

  const defenderTerritory = await trackTerritory(
    await Territory.create({
      ownerId: TEST2_ID,
      geometry,
      color: TEST_TERRITORY_COLOR,
      areaSqm,
      shapeType: 'loop',
      strength: areaSqm,
    })
  );

  // Standalone check of the exact $geoIntersects query resolveInvasions()
  // runs internally — proves the 2dsphere index + query shape actually
  // finds the overlapping candidate, independent of anything
  // resolveInvasions() does with it afterward.
  const candidates = await Territory.find({
    ownerId: { $ne: TEST1_ID },
    geometry: { $geoIntersects: { $geometry: geometry } },
  });
  report.check(
    'Overlapping territories detected via $geoIntersects',
    candidates.some((c) => c._id.equals(defenderTerritory._id)),
    candidates.length === 0 ? 'query returned zero candidates — check the 2dsphere index' : undefined
  );

  const test1Before = await User.findById(TEST1_ID);
  const beforeCalons = test1Before.calonsTotal;
  const sinceTimestamp = new Date();

  const attackTerritory = new Territory({
    ownerId: TEST1_ID,
    geometry,
    color: TEST_TERRITORY_COLOR,
    areaSqm,
    shapeType: 'loop',
    strength: areaSqm,
  });
  await resolveInvasions(attackTerritory, test1Before);
  await attackTerritory.save();
  await trackTerritory(attackTerritory);

  const defenderAfter = await Territory.findById(defenderTerritory._id);
  report.check(
    'Strong attacker captured overlap (defender territory fully consumed)',
    defenderAfter === null,
    defenderAfter ? `defender territory still exists, areaSqm=${defenderAfter.areaSqm}` : undefined
  );

  const notifications = await findNewNotifications(TEST2_ID, sinceTimestamp);
  const invasionNotif = notifications.find((n) => n.type === 'territory_invaded');
  report.check(
    'territory_invaded notification created',
    !!invasionNotif && invasionNotif.payload?.fullyConsumed === true,
    invasionNotif ? undefined : 'no territory_invaded notification found for test2'
  );

  const test1After = await User.findById(TEST1_ID);
  const expectedGain = areaSqm * POINTS_PER_SQM;
  const actualGain = test1After.calonsTotal - beforeCalons;
  report.check(
    'Calons awarded correctly',
    Math.abs(actualGain - expectedGain) < 0.01,
    `expected +${expectedGain.toFixed(2)}, got +${actualGain.toFixed(2)}`
  );

  report.blank();
}

// ============================================================
// Scenario 2/3 — weak attacker: siege builds up, then eventually captures
// ============================================================
async function runWeakAttackerSiegeScenario(report) {
  console.log('--- Scenario 2/3: weak attacker (siege -> eventual capture) ---');

  // 400 vs 1000 -> damage-per-hit multiplier of 0.4, so capture triggers
  // on exactly the 3rd hit (0.4 + 0.4 + 0.4 = 1.2x strength) — enough
  // repeats to prove accumulation without a slow test.
  await User.findByIdAndUpdate(TEST1_ID, { $set: { calonsTotal: 400 } });
  await User.findByIdAndUpdate(TEST2_ID, { $set: { calonsTotal: 1000 } });

  const geometry = squareGeometry(SIEGE_REGION.lng, SIEGE_REGION.lat, 0.001);
  const areaSqm = turf.area(geometry);

  const defenderTerritory = await trackTerritory(
    await Territory.create({
      ownerId: TEST2_ID,
      geometry,
      color: TEST_TERRITORY_COLOR,
      areaSqm,
      shapeType: 'loop',
      strength: areaSqm,
    })
  );

  const damageHistory = []; // siegeDamage value observed after each non-capturing hit
  let sawSiegeNotification = false;
  let ownershipStayedWithDefenderThroughout = true;
  let capturedOnIteration = null;
  let captureNotification = null;
  let iterations = 0;

  while (capturedOnIteration === null && iterations < MAX_SIEGE_ITERATIONS) {
    iterations += 1;
    const invaderUser = await User.findById(TEST1_ID);
    const sinceTimestamp = new Date();

    const attackTerritory = new Territory({
      ownerId: TEST1_ID,
      geometry,
      color: TEST_TERRITORY_COLOR,
      areaSqm,
      shapeType: 'loop',
      strength: areaSqm,
    });
    await resolveInvasions(attackTerritory, invaderUser);
    await attackTerritory.save();
    await trackTerritory(attackTerritory);

    const defenderNow = await Territory.findById(defenderTerritory._id);
    const notifications = await findNewNotifications(TEST2_ID, sinceTimestamp);

    if (defenderNow === null) {
      capturedOnIteration = iterations;
      captureNotification = notifications.find((n) => n.type === 'territory_invaded') || null;
    } else {
      ownershipStayedWithDefenderThroughout =
        ownershipStayedWithDefenderThroughout && defenderNow.ownerId.equals(TEST2_ID);
      damageHistory.push(defenderNow.siegeDamage.get(TEST1_ID.toString()) || 0);
      if (notifications.some((n) => n.type === 'territory_under_siege')) {
        sawSiegeNotification = true;
      }
    }
  }

  report.check(
    'Weak attacker caused siege, not an instant capture',
    damageHistory.length >= 1,
    damageHistory.length === 0 ? 'territory was captured on the first attack — check the Calons-comparison branch' : undefined
  );

  const damageStrictlyIncreased = damageHistory.every((d, i) => i === 0 || d > damageHistory[i - 1]);
  report.check(
    'siegeDamage increased across repeated attacks',
    damageHistory.length >= 1 && damageStrictlyIncreased,
    `observed siegeDamage sequence: [${damageHistory.join(', ')}]`
  );

  report.check('territory_under_siege notification created', sawSiegeNotification);

  report.check(
    'Territory stayed with defender until strength was exceeded',
    ownershipStayedWithDefenderThroughout
  );

  report.check(
    'Siege eventually captured territory',
    capturedOnIteration !== null,
    capturedOnIteration === null ? `did not capture within ${MAX_SIEGE_ITERATIONS} iterations` : `captured on iteration ${capturedOnIteration}`
  );
  if (capturedOnIteration !== null) {
    report.check(
      'territory_invaded notification created on final capture',
      !!captureNotification && captureNotification.payload?.fullyConsumed === true
    );
  }

  report.blank();
}

// ============================================================
// Scenario 4 — normal, non-overlapping loop through the REAL
// generateTerritory() path (full end-to-end wiring check)
// ============================================================
async function runNormalNonOverlapScenario(report) {
  console.log('--- Scenario 4: normal non-overlapping loop (full generateTerritory() path) ---');

  const invaderUser = await User.findById(TEST1_ID);

  const half = 0.00015;
  const { lng, lat } = NO_OVERLAP_REGION;
  const gpsPath = [
    { lat: lat - half, lng: lng - half },
    { lat: lat - half, lng: lng + half },
    { lat: lat + half, lng: lng + half },
    { lat: lat + half, lng: lng - half },
  ];

  const fakeActivity = {
    gpsPath,
    calories: 50, // -> targetAreaSqm = 50 * AREA_PER_CALORIE(20) = 1000 sqm
    isLoop: true,
    distanceKm: 0.15,
  };

  const beforeCalons = invaderUser.calonsTotal;
  const notifCountBefore = await Notification.countDocuments({ userId: { $in: [TEST1_ID, TEST2_ID] } });

  const territory = await generateTerritory(fakeActivity, invaderUser, { onBeforeSave: resolveInvasions });
  await trackTerritory(territory);

  report.check('Normal loop produced shapeType "loop"', territory.shapeType === 'loop');

  const expectedCalons = territory.areaSqm * POINTS_PER_SQM;
  const actualCalonsFromHook = territory.$locals.calonsEarned;
  report.check(
    'Normal non-overlap loop: full areaSqm awarded (no double count)',
    Math.abs(actualCalonsFromHook - expectedCalons) < 0.01,
    `expected ${expectedCalons.toFixed(2)}, got ${actualCalonsFromHook}`
  );

  const invaderAfter = await User.findById(TEST1_ID);
  const actualGain = invaderAfter.calonsTotal - beforeCalons;
  report.check(
    'Normal non-overlap loop: Calons actually persisted to the user',
    Math.abs(actualGain - expectedCalons) < 0.01,
    `expected +${expectedCalons.toFixed(2)}, got +${actualGain.toFixed(2)}`
  );

  const notifCountAfter = await Notification.countDocuments({ userId: { $in: [TEST1_ID, TEST2_ID] } });
  report.check(
    'Normal non-overlap loop: no invasion notifications created as a side effect',
    notifCountAfter === notifCountBefore
  );

  report.blank();
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('=====================================');
  console.log('PHASE 6 INVASION TEST');
  console.log('=====================================\n');

  const report = new TestReport();
  await connectDB();

  const test1 = await User.findById(TEST1_ID);
  const test2 = await User.findById(TEST2_ID);
  if (!test1 || !test2) {
    console.error(`FATAL: could not find test user(s). test1 found=${!!test1}, test2 found=${!!test2}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Snapshot so both users go back to exactly what they were, no matter
  // how the run goes.
  const originalCalons = {
    test1: { calonsTotal: test1.calonsTotal, calonsWeekly: test1.calonsWeekly, calonsMonthly: test1.calonsMonthly },
    test2: { calonsTotal: test2.calonsTotal, calonsWeekly: test2.calonsWeekly, calonsMonthly: test2.calonsMonthly },
  };

  try {
    const indexes = await Territory.collection.indexes();
    const hasGeoIndex = indexes.some((idx) => idx.key && idx.key.geometry === '2dsphere');
    report.check(
      'Territory.geometry has a 2dsphere index',
      hasGeoIndex,
      hasGeoIndex
        ? undefined
        : 'not found on the live collection — Mongoose autoIndex should create it on model init; if missing, run Territory.syncIndexes() once'
    );
    report.blank();

    await runStrongAttackerScenario(report);
    await deleteTrackedTerritories(); // reset test data between scenarios
    await runWeakAttackerSiegeScenario(report);
    await deleteTrackedTerritories();
    await runNormalNonOverlapScenario(report);
  } finally {
    await deleteTrackedTerritories();
    if (createdNotificationIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: createdNotificationIds } });
    }
    await User.findByIdAndUpdate(TEST1_ID, { $set: originalCalons.test1 });
    await User.findByIdAndUpdate(TEST2_ID, { $set: originalCalons.test2 });
  }

  report.printSummary();
  await mongoose.disconnect();
  process.exit(report.allPassed ? 0 : 1);
}

main().catch(async (err) => {
  console.error('FATAL ERROR:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // already disconnected or never connected — nothing more to do
  }
  process.exit(1);
});
