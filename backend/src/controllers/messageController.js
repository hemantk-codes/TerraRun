import mongoose from 'mongoose';
import { Message, User } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { getConversationId, getParticipantIds } from '../utils/conversation.js';

// ⚠️ INTEGRATION ASSUMPTION: same as friendController.js — req.userId is set
// by middleware/auth.js (Phase 1).
function resolveUserId(req) {
  return (req.userId || req.user?.id || req.user?._id)?.toString();
}

/**
 * GET /api/messages/conversations
 *
 * Conversation list for the Chat tab: one row per conversationId the
 * requesting user participates in, each with the OTHER participant's
 * profile and a preview of the most recent message.
 *
 * There's no separate Conversation collection (see Message.js's schema
 * comment), so this is derived from Message via aggregation rather than
 * read off a maintained summary table. The regex $match below isn't
 * index-optimized (conversationId is indexed, but not for substring
 * matching) — fine at this project's scale; a real Conversation
 * collection would be the fix if this ever needed to scale further.
 */
export async function listConversations(req, res, next) {
  try {
    const userId = resolveUserId(req);
    // conversationId is always exactly "<id1>_<id2>" (24-hex-char Mongo
    // ObjectIds joined by one underscore), so anchoring on (^|_) / ($|_)
    // guarantees userId matches a WHOLE half, not a substring of one.
    const userIdPattern = new RegExp(`(^|_)${userId}($|_)`);

    const rows = await Message.aggregate([
      { $match: { conversationId: userIdPattern } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    const otherUserIds = rows.map((r) => {
      const [a, b] = getParticipantIds(r._id);
      return a === userId ? b : a;
    });

    const users = await User.find({ _id: { $in: otherUserIds } })
      .select('name preferredColor')
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));

    const conversations = rows
      .map((r) => {
        const [a, b] = getParticipantIds(r._id);
        const otherId = a === userId ? b : a;
        const otherUser = byId.get(otherId);
        // Deleted-user guard — skip rather than 500 the whole list.
        if (!otherUser) return null;
        return {
          conversationId: r._id,
          otherUser: { id: otherId, name: otherUser.name, preferredColor: otherUser.preferredColor },
          lastMessage: {
            senderId: r.lastMessage.senderId,
            type: r.lastMessage.type,
            content: r.lastMessage.content,
            createdAt: r.lastMessage.createdAt,
          },
        };
      })
      .filter(Boolean);

    res.status(200).json({ conversations });
  } catch (err) {
    next(err);
  }
}

const HISTORY_LIMIT_DEFAULT = 50;
const HISTORY_LIMIT_MAX = 200;

/**
 * GET /api/messages/thread/:otherUserId?before=<ISO date>&limit=<>
 *
 * Message history with one specific other user. Deliberately NOT gated on
 * canChat() being true right now: history should stay readable even after
 * an unfollow removes the ability to send NEW messages (see the Socket.io
 * "message:send" handler, where that check actually lives) — per the Phase
 * 9 integration checklist, un-friending must not delete message history.
 * No separate participant-authorization check is needed either: the
 * conversationId is derived FROM the requesting user's own id, so they're
 * definitionally always a participant of whatever thread this returns.
 */
export async function getThread(req, res, next) {
  try {
    const userId = resolveUserId(req);
    const { otherUserId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      throw new ApiError(400, 'otherUserId is not a valid id.');
    }

    const conversationId = getConversationId(userId, otherUserId);

    let limit = Number(req.query.limit) || HISTORY_LIMIT_DEFAULT;
    limit = Math.min(Math.max(limit, 1), HISTORY_LIMIT_MAX);

    const filter = { conversationId };
    if (req.query.before) {
      const before = new Date(req.query.before);
      if (!Number.isNaN(before.getTime())) {
        filter.createdAt = { $lt: before };
      }
    }

    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

    // Query is newest-first (so `before`-based pagination reads naturally
    // backwards); flip to oldest-first before returning — that's the order
    // a chat thread actually renders in.
    messages.reverse();

    res.status(200).json({ conversationId, messages });
  } catch (err) {
    next(err);
  }
}
