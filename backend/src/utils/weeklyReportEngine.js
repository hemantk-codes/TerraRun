// PHASE 11 — compiles the data behind each user's weekly report email.
// Pure data-gathering: no Nodemailer/HTML here — see utils/emailTemplates.js
// (rendering) and jobs/weeklyReportJobs.js (the cron entry point that wires
// this together and actually sends).
//
// TIMING: this job runs Monday 06:00, deliberately AFTER Phase 5's Monday
// 00:00 calonsResetJobs.js has already zeroed calonsWeekly and snapshotted
// it into WeeklyScore. So "Calons earned this week" here reads the
// WeeklyScore snapshot for the week that just closed, NOT the live
// (already-reset-to-0) User.calonsWeekly field.

import Activity from '../models/Activity.js';
import Friendship from '../models/Friendship.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import WeeklyScore from '../models/WeeklyScore.js';
import { POINTS_PER_SQM } from './calonsEngine.js';
import { getJustEndedWeekRange } from './weekBoundaries.js';
export { getJustEndedWeekRange };

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sums distanceKm/calories across every Activity the user recorded in
 * [weekStart, weekEnd) — ALL activities, not just isValidForTerritory ones;
 * "distance run" and "calories burnt" are fitness stats, not a territory
 * metric, so a <1km or vehicle-flagged activity still counts here even
 * though it didn't generate territory.
 */
async function getWeeklyActivityTotals(userId, weekStart, weekEnd) {
  const [result] = await Activity.aggregate([
    { $match: { userId, createdAt: { $gte: weekStart, $lt: weekEnd } } },
    {
      $group: {
        _id: null,
        totalDistanceKm: { $sum: '$distanceKm' },
        totalCalories: { $sum: '$calories' },
        runCount: { $sum: 1 },
      },
    },
  ]);
  return result || { totalDistanceKm: 0, totalCalories: 0, runCount: 0 };
}

/**
 * Area LOST this week, derived from Notification history rather than a
 * dedicated ledger (none exists) — sums payload.areaLostSqm off every
 * 'territory_invaded' (Phase 6) and 'territory_split' (Phase 7) notification
 * in the window. KNOWN GAP: gradual decay (Phase 8) shrinks territory daily
 * without notifying the exact sqm lost each day (only a one-time
 * 'decay_warning' on day 1), so slow inactivity-driven loss isn't reflected
 * here — flagged in the email copy itself so it doesn't read as more
 * precise than it is.
 */
async function getWeeklyAreaLostSqm(userId, weekStart, weekEnd) {
  const notifs = await Notification.find({
    userId,
    type: { $in: ['territory_invaded', 'territory_split'] },
    createdAt: { $gte: weekStart, $lt: weekEnd },
  })
    .select('payload')
    .lean();

  return notifs.reduce((sum, n) => sum + (n.payload?.areaLostSqm || 0), 0);
}

function rankWithinGroup(userId, peerIds, scoreByUserId) {
  const ids = [...new Set([userId.toString(), ...peerIds])];
  const sorted = ids
    .map((id) => ({ id, score: scoreByUserId.get(id) || 0 }))
    .sort((a, b) => b.score - a.score);
  const rank = sorted.findIndex((r) => r.id === userId.toString()) + 1;
  return { rank, total: sorted.length };
}

/**
 * Friends + regional rank for the week that just closed, both computed off
 * that week's WeeklyScore snapshots (not live scores, which are already
 * reset to 0 by the time this job runs).
 *
 * "Friends" = mutual follow, same definition friendshipEngine.js's
 * isMutual() and leaderboardOvertakeEngine.js's pairing use elsewhere.
 * Returns null for a rank when the group is empty (no mutual friends / no
 * region set) — the email renders a friendly prompt instead of "#1 of 1".
 */
async function computeWeeklyRanks(user, weekStart) {
  const [followingRows, followerRows] = await Promise.all([
    Friendship.find({ followerId: user._id, status: 'active' }).select('followingId').lean(),
    Friendship.find({ followingId: user._id, status: 'active' }).select('followerId').lean(),
  ]);
  const followingSet = new Set(followingRows.map((r) => r.followingId.toString()));
  const followerSet = new Set(followerRows.map((r) => r.followerId.toString()));
  const mutualFriendIds = [...followingSet].filter((id) => followerSet.has(id));

  let regionalPeerIds = [];
  if (user.region && user.region.trim()) {
    const pattern = new RegExp(`^${escapeRegex(user.region.trim())}$`, 'i');
    const peers = await User.find({ region: pattern, _id: { $ne: user._id } })
      .select('_id')
      .lean();
    regionalPeerIds = peers.map((p) => p._id.toString());
  }

  const relevantIds = [...new Set([user._id.toString(), ...mutualFriendIds, ...regionalPeerIds])];
  const scoreRows = await WeeklyScore.find({
    weekStartDate: weekStart,
    userId: { $in: relevantIds },
  })
    .select('userId score')
    .lean();
  const scoreByUserId = new Map(scoreRows.map((r) => [r.userId.toString(), r.score]));

  const friendsRankInfo = mutualFriendIds.length > 0 ? rankWithinGroup(user._id, mutualFriendIds, scoreByUserId) : null;
  const regionalRankInfo = regionalPeerIds.length > 0 ? rankWithinGroup(user._id, regionalPeerIds, scoreByUserId) : null;

  return {
    friendsRank: friendsRankInfo?.rank ?? null,
    friendsTotal: friendsRankInfo?.total ?? null,
    regionalRank: regionalRankInfo?.rank ?? null,
    regionalTotal: regionalRankInfo?.total ?? null,
  };
}

/**
 * Assembles the full report for one user. `user` needs at least
 * { _id, name, region } — the caller (weeklyReportJobs.js) selects those
 * fields off the User query that decides who's eligible in the first place.
 */
export async function compileWeeklyReportForUser(user, { weekStart, weekEnd }) {
  const [activityTotals, areaLostSqm, weeklyScoreDoc, ranks] = await Promise.all([
    getWeeklyActivityTotals(user._id, weekStart, weekEnd),
    getWeeklyAreaLostSqm(user._id, weekStart, weekEnd),
    WeeklyScore.findOne({ userId: user._id, weekStartDate: weekStart }).select('score').lean(),
    computeWeeklyRanks(user, weekStart),
  ]);

  // Every area-gain event in this codebase (new territory creation,
  // invasion capture, split-regenerate) goes through calonsEngine.js's
  // awardCalonsForAreaGain(), which always credits EXACTLY
  // areaSqmGained * POINTS_PER_SQM. So the inverse gives an exact (not
  // estimated) total area gained this week, straight from the Calons
  // already-snapshotted for it — no separate area-gain ledger needed.
  const calonsEarned = weeklyScoreDoc?.score || 0;
  const areaGainedSqm = calonsEarned / POINTS_PER_SQM;

  return {
    distanceKm: activityTotals.totalDistanceKm,
    calories: activityTotals.totalCalories,
    runCount: activityTotals.runCount,
    calonsEarned,
    areaGainedSqm,
    areaLostSqm,
    netAreaChangeSqm: areaGainedSqm - areaLostSqm,
    region: user.region || null,
    ...ranks,
  };
}