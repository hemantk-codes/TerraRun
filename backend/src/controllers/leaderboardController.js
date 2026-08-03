import User from '../models/User.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const SCORE_FIELD_BY_PERIOD = {
  weekly: 'calonsWeekly',
  monthly: 'calonsMonthly',
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/leaderboard?scope=friends|regional&period=weekly|monthly&region=<>&limit=<>
 *
 * Reads the LIVE User.calonsWeekly/calonsMonthly fields (not the
 * WeeklyScore/MonthlyScore history collections — those are snapshots for
 * Phase 10/11, this route wants "the leaderboard right now").
 *
 * scope=friends is STUBBED as "all users" until Phase 9's Friendship graph
 * exists — see the TODO below for exactly what to swap in.
 *
 * scope=regional needs to know WHOSE region to filter by. Rather than guess
 * at Phase 1's auth middleware shape, it takes an explicit `region` query
 * param — the frontend passes the logged-in user's own `user.region` from
 * AuthContext when available. (This mirrors territoryController.js's own
 * choice to stay auth-agnostic: the "/leaderboard" route isn't wrapped in
 * <ProtectedRoute> on the frontend either.)
 *
 * ⚠️ INTEGRATION ASSUMPTION: once Phase 9 makes scope=friends real, it WILL
 * need to know the requesting user's id, so that scope will need auth wired
 * in then — today's stub genuinely doesn't need it.
 */
export async function getLeaderboard(req, res, next) {
  try {
    const scope = req.query.scope === 'regional' ? 'regional' : 'friends'; // default: friends
    const period = req.query.period === 'monthly' ? 'monthly' : 'weekly'; // default: weekly
    const scoreField = SCORE_FIELD_BY_PERIOD[period];

    let limit = Number(req.query.limit) || DEFAULT_LIMIT;
    limit = Math.min(Math.max(limit, 1), MAX_LIMIT);

    const filter = {};
    let region = null;

    if (scope === 'regional') {
      region = (req.query.region || '').trim();
      if (!region) {
        return res.status(400).json({ error: 'region is required for scope=regional.' });
      }
      // Case-insensitive exact match — Phase 1's region field comes from a
      // dropdown per the spec, so this should always be an exact match in
      // practice; case-insensitivity is just cheap defensive slack.
      filter.region = new RegExp(`^${escapeRegex(region)}$`, 'i');
    }
    // scope === 'friends':
    // TODO(Phase 9): replace the no-op `filter` above with
    // `filter._id = { $in: mutualFriendIds }`, where mutualFriendIds comes
    // from the same both-direction Friendship lookup the Phase 9 prompt's
    // canChat/mutual-friend logic uses. Requires knowing the REQUESTING
    // user's id — this scope will need auth from that point on.

    const users = await User.find(filter)
      .select(`name region ${scoreField}`)
      .sort({ [scoreField]: -1 })
      .limit(limit)
      .lean();

    const leaderboard = users.map((u, index) => ({
      rank: index + 1,
      userId: u._id,
      name: u.name,
      region: u.region,
      score: u[scoreField],
    }));

    res.status(200).json({ scope, period, region, leaderboard });
  } catch (err) {
    next(err);
  }
}
