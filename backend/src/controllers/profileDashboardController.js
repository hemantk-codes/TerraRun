import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';
import Territory from '../models/Territory.js';
import User from '../models/User.js';

function areaText(sqm) {
  const value = Number(sqm || 0);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} km²`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)} ha`;
  return `${Math.round(value).toLocaleString()} m²`;
}

function notificationToActivity(notification) {
  const payload = notification?.payload || {};
  const invaderName = payload.invaderName || payload.attackerName || 'a rival';
  const followerName = payload.followerName || payload.name || 'A runner';
  const overtakerName = payload.overtakerName || payload.overtaker || payload.name || 'A runner';
  const senderName = payload.senderName || payload.fromName || 'A runner';
  const capturedArea = payload.areaCapturedSqm ?? payload.overlapAreaSqm ?? payload.areaSqm;

  switch (notification.type) {
    case 'territory_fully_decayed':
      return {
        title: 'Territory lost',
        subtext: 'A territory fully decayed and is gone.',
      };
    case 'territory_invaded':
      return {
        title: 'Territory lost',
        subtext: `You lost ${areaText(payload.areaLostSqm)} to ${invaderName}.`,
      };
    case 'invasion_succeeded':
      return {
        title: 'Invasion successful',
        subtext: `You captured ${areaText(capturedArea)} from ${payload.defenderName || 'a rival'}.`,
      };
    case 'territory_split':
      return {
        title: 'Territory split',
        subtext: 'A territory split needs your attention.',
      };
    case 'friend_request':
      return {
        title: 'New follower',
        subtext: `${followerName} started following you.`,
      };
    case 'leaderboard_overtaken':
      return {
        title: 'Leaderboard overtaken',
        subtext: `${overtakerName} just surpassed you on the leaderboard.`,
      };
    case 'chat_message_received':
      return {
        title: 'New message',
        subtext: `${senderName} sent you a message.`,
      };
    case 'decay_warning':
      return {
        title: 'Territory decay warning',
        subtext: 'A territory is starting to decay. Lace up to defend it.',
      };
    case 'streak_stopper_earned':
      return {
        title: 'Streak reward',
        subtext: 'You earned a streak stopper.',
      };
    case 'streak_stopper_offer':
      return {
        title: 'Streak stopper available',
        subtext: 'You can spend a streak stopper to protect your territory.',
      };
    case 'territory_under_siege':
      return {
        title: 'Territory under siege',
        subtext: `${invaderName} is attacking one of your territories.`,
      };
    default:
      return {
        title: String(notification.type || 'Activity')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        subtext: 'A new TerraRun event happened.',
      };
  }
}

/**
 * GET /api/profile/dashboard
 *
 * Additive dashboard endpoint used only by the visual profile page.
 * It reads current MongoDB state and does not modify any existing Phase 1–11 behavior.
 */
export async function getDashboard(req, res, next) {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const [activityTotals, territoryTotals, higherRankUsers, notifications] = await Promise.all([
      Activity.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: null,
            totalRuns: { $sum: 1 },
            totalCalories: { $sum: { $ifNull: ['$calories', 0] } },
          },
        },
      ]),
      Territory.aggregate([
        { $match: { ownerId: user._id } },
        {
          $group: {
            _id: null,
            totalAreaSqm: { $sum: { $ifNull: ['$areaSqm', 0] } },
          },
        },
      ]),
      User.countDocuments({ calonsTotal: { $gt: Number(user.calonsTotal || 0) } }),
      Notification.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean(),
    ]);

    const totals = activityTotals[0] || { totalRuns: 0, totalCalories: 0 };
    const territory = territoryTotals[0] || { totalAreaSqm: 0 };

    const recentActivity = notifications.map((notification) => ({
      id: notification._id.toString(),
      type: notification.type,
      createdAt: notification.createdAt,
      ...notificationToActivity(notification),
    }));

    res.status(200).json({
      user,
      stats: {
        totalRuns: Number(totals.totalRuns || 0),
        totalCalories: Number(totals.totalCalories || 0),
        totalTerritorySqm: Number(territory.totalAreaSqm || 0),
        globalRank: Number(higherRankUsers || 0) + 1,
      },
      recentActivity,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
