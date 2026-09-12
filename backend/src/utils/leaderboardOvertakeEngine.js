// PHASE 10 — "leaderboard_overtaken" detection.
//
// Called from jobs/calonsResetJobs.js, once per period (weekly/monthly),
// BEFORE that period's live score field gets zeroed — see that file's own
// comments for why ordering matters. This is deliberately NOT checked on
// every single run (per the phase prompt: "check this in the Phase 5
// weekly/monthly cron jobs, not on every single run").
//
// RULE: user U gets notified about peer P for the period that just closed
// if:
//   P's score-just-closed  >  U's score-just-closed   AND
//   P's score-previous-period  <=  U's score-previous-period
// i.e. P was NOT ahead of U before, but IS ahead of U now — a fresh
// overtake during the period that just ended, not a peer who's simply
// been ahead all along (which would otherwise fire every single week
// forever).
//
// SCOPE (deliberate simplifications, flagged per the master prompt):
//   - Only considers users in `users` — the SAME "score > 0" candidate
//     list calonsResetJobs.js already builds for its own snapshot insert.
//     A user with a zero score this period isn't treated as "overtakeable"
//     here; reasonable for a class project — someone who didn't run this
//     period has no defense to lose anyway.
//   - "friend" = MUTUAL follow only (both directions), matching
//     friendshipEngine.js's isMutual() definition used everywhere else in
//     this codebase.
//   - "regional peer" = another user from that SAME candidate list with an
//     identical `region` string (case-insensitive) — same comparison
//     leaderboardController.js's scope=regional already uses. Also scoped
//     to just the active candidate list, not the whole User collection.
//   - One notification per (user, period) even if several peers overtook
//     them, combined into a single payload (capped at
//     OVERTAKEN_NAMES_LIMIT names) — a rough week doesn't spam several
//     separate toasts.
//   - BOOTSTRAP GUARD: if there's no previous-period snapshot for ANY of
//     these users at all (this job has never run before, or was down for
//     a cycle), there's nothing real to diff against — treating a missing
//     snapshot as "0 for everyone" would make it look like every active
//     user "just overtook" every other active user in one shot. The whole
//     check is skipped for that run rather than firing on data we don't
//     trust; it resumes normally the next time a real previous snapshot
//     exists.

import Friendship from '../models/Friendship.js';
import User from '../models/User.js';
import WeeklyScore from '../models/WeeklyScore.js';
import MonthlyScore from '../models/MonthlyScore.js';
import { notify } from './notificationService.js';

// Tunable — how many overtaking peer names to name explicitly in one
// notification before just saying "and N others".
const OVERTAKEN_NAMES_LIMIT = 3;

const SNAPSHOT_MODEL_BY_PERIOD = {
  weekly: { Model: WeeklyScore, dateField: 'weekStartDate' },
  monthly: { Model: MonthlyScore, dateField: 'monthStartDate' },
};

/** Map<userId(string), Set<peerId(string)>> — mutual pairs only, scoped to `userIds`. */
async function getMutualFriendPairs(userIds) {
  const follows = await Friendship.find({
    followerId: { $in: userIds },
    followingId: { $in: userIds },
    status: 'active',
  })
    .select('followerId followingId')
    .lean();

  const followSet = new Set(follows.map((f) => `${f.followerId}_${f.followingId}`));
  const friendsOf = new Map();

  for (const f of follows) {
    const a = f.followerId.toString();
    const b = f.followingId.toString();
    if (followSet.has(`${b}_${a}`)) {
      if (!friendsOf.has(a)) friendsOf.set(a, new Set());
      friendsOf.get(a).add(b);
    }
  }

  return friendsOf;
}

/** Map<normalizedRegion, [userId(string), ...]> — scoped to `users`. */
function groupByRegion(users) {
  const byRegion = new Map();
  for (const u of users) {
    const region = (u.region || '').trim().toLowerCase();
    if (!region) continue; // no region on file — not comparable to anyone
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(u._id.toString());
  }
  return byRegion;
}

/**
 * @param {'weekly'|'monthly'} period
 * @param {string} scoreField - 'calonsWeekly' | 'calonsMonthly'
 * @param {Date} justEndedPeriodStart - the value calonsResetJobs.js is
 *   about to snapshot WeeklyScore/MonthlyScore rows under.
 * @param {Date} previousPeriodStart - the period immediately before that.
 * @param {Array<{_id, region, [scoreField]: number}>} users - the
 *   candidate list calonsResetJobs.js already fetched (score > 0, pre-reset).
 */
export async function checkAndNotifyOvertakes({
  period,
  scoreField,
  justEndedPeriodStart,
  previousPeriodStart,
  users,
}) {
  if (users.length < 2) return; // nobody to be overtaken BY

  const { Model, dateField } = SNAPSHOT_MODEL_BY_PERIOD[period];
  const userIds = users.map((u) => u._id);

  const [friendsOf, previousRows] = await Promise.all([
    getMutualFriendPairs(userIds),
    Model.find({ userId: { $in: userIds }, [dateField]: previousPeriodStart }).select('userId score').lean(),
  ]);

  // Bootstrap guard — see file header.
  if (previousRows.length === 0) return;

  const previousScoreById = new Map(previousRows.map((r) => [r.userId.toString(), r.score]));
  const currentScoreById = new Map(users.map((u) => [u._id.toString(), u[scoreField]]));
  const regionsById = groupByRegion(users);

  // Names are looked up lazily, only for users who actually end up in a
  // notification payload — avoids an unconditional name lookup for every
  // active user on a check that most weeks finds nothing.
  const nameCache = new Map();
  async function nameOf(userId) {
    if (nameCache.has(userId)) return nameCache.get(userId);
    const u = await User.findById(userId).select('name').lean();
    const name = u?.name || 'Someone';
    nameCache.set(userId, name);
    return name;
  }

  for (const user of users) {
    const userId = user._id.toString();
    const nowScore = currentScoreById.get(userId) || 0;
    const beforeScore = previousScoreById.get(userId) || 0;

    const peerIds = new Set(friendsOf.get(userId) || []);
    const region = (user.region || '').trim().toLowerCase();
    if (region) {
      for (const peerId of regionsById.get(region) || []) {
        if (peerId !== userId) peerIds.add(peerId);
      }
    }
    if (peerIds.size === 0) continue;

    const overtakenByIds = [];
    for (const peerId of peerIds) {
      const peerNow = currentScoreById.get(peerId) || 0;
      const peerBefore = previousScoreById.get(peerId) || 0;
      if (peerNow > nowScore && peerBefore <= beforeScore) {
        overtakenByIds.push(peerId);
      }
    }
    if (overtakenByIds.length === 0) continue;

    const shownNames = await Promise.all(overtakenByIds.slice(0, OVERTAKEN_NAMES_LIMIT).map(nameOf));

    await notify(user._id, 'leaderboard_overtaken', {
      period,
      overtakenByNames: shownNames,
      overtakenByCount: overtakenByIds.length,
      yourScore: nowScore,
    });
  }
}
