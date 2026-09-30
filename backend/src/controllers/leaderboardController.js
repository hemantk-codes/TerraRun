import User from '../models/User.js'
import Territory from '../models/Territory.js'
import Activity from '../models/Activity.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const SCORE_FIELD_BY_PERIOD = {
  weekly: 'calonsWeekly',
  monthly: 'calonsMonthly',
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * GET /api/leaderboard?scope=friends|regional&period=weekly|monthly&region=<>&limit=<>
 *
 * Returns:
 * - leaderboard data
 * - total registered users
 * - total territories across all users
 * - total calories burnt across all recorded activities
 */
export async function getLeaderboard(req, res, next) {
  try {
    const scope =
      req.query.scope === 'regional'
        ? 'regional'
        : 'friends'

    const period =
      req.query.period === 'monthly'
        ? 'monthly'
        : 'weekly'

    const scoreField =
      SCORE_FIELD_BY_PERIOD[period]

    let limit =
      Number(req.query.limit) || DEFAULT_LIMIT

    limit = Math.min(
      Math.max(limit, 1),
      MAX_LIMIT,
    )

    const filter = {}
    let region = null

    if (scope === 'regional') {
      region = (req.query.region || '').trim()

      if (!region) {
        return res.status(400).json({
          error: 'region is required for scope=regional.',
        })
      }

      filter.region = new RegExp(
        `^${escapeRegex(region)}$`,
        'i',
      )
    }

    const [
      users,
      totalUsers,
      totalTerritories,
      totalCaloriesResult,
    ] = await Promise.all([
      User.find(filter)
        .select(`name region ${scoreField}`)
        .sort({ [scoreField]: -1 })
        .limit(limit)
        .lean(),

      User.countDocuments({}),

      Territory.countDocuments({}),

      Activity.aggregate([
        {
          $group: {
            _id: null,
            totalCalories: {
              $sum: {
                $ifNull: ['$calories', 0],
              },
            },
          },
        },
      ]),
    ])

    const totalCalories =
      totalCaloriesResult[0]?.totalCalories || 0

    const leaderboard = users.map(
      (u, index) => ({
        rank: index + 1,
        userId: u._id,
        name: u.name,
        region: u.region,
        score: u[scoreField],
      }),
    )

    res.status(200).json({
      scope,
      period,
      region,
      leaderboard,

      stats: {
        totalUsers,
        totalTerritories,
        totalCalories,
      },
    })
  } catch (err) {
    next(err)
  }
}