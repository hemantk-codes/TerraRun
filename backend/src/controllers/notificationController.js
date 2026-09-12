import Notification from '../models/Notification.js';
import { ApiError } from '../utils/apiError.js';

function resolveUserId(req) {
  return req.userId || req.user?.id || req.user?._id;
}

const LIST_LIMIT_DEFAULT = 20;
const LIST_LIMIT_MAX = 100;

/**
 * GET /api/notifications?before=<ISO date>&limit=<>
 *
 * Newest-first, cursor-paginated the same way messageController.getThread
 * already does (an ISO `before` timestamp rather than page numbers — new
 * notifications keep arriving in real time, so an offset-based "page 2"
 * would double-count/skip items the moment anything new lands). Also
 * returns `unreadCount` so the bell badge has a correct number on first
 * load without a second round trip.
 */
export async function listNotifications(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

    let limit = Number(req.query.limit) || LIST_LIMIT_DEFAULT;
    limit = Math.min(Math.max(limit, 1), LIST_LIMIT_MAX);

    const filter = { userId };
    if (req.query.before) {
      const before = new Date(req.query.before);
      if (!Number.isNaN(before.getTime())) {
        filter.createdAt = { $lt: before };
      }
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ userId, read: false }),
    ]);

    res.status(200).json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/notifications/:id/read
 * Idempotent — marking an already-read notification read again is a 200
 * no-op, same pattern as friendController's follow/unfollow.
 */
export async function markNotificationRead(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

    const notification = await Notification.findOne({ _id: req.params.id, userId });
    if (!notification) throw new ApiError(404, 'Notification not found.');

    if (!notification.read) {
      notification.read = true;
      await notification.save();
    }

    res.status(200).json({ notification });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/notifications/read-all
 * Not explicitly in the phase prompt's two required endpoints, but the
 * bell dropdown's "mark all read" needs SOME way to clear the badge in one
 * call rather than N sequential POST /:id/read requests — cheap to add.
 */
export async function markAllNotificationsRead(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

    await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}
