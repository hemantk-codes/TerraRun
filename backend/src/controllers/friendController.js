import mongoose from 'mongoose';
import { Friendship, User } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { getStatus } from '../utils/friendshipEngine.js';
import { notify } from '../utils/notificationService.js'; // Phase 10

function resolveUserId(req) {
  return req.userId || req.user?.id || req.user?._id;
}

function assertValidObjectId(id, label = 'id') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `${label} is not a valid id.`);
  }
}

/**
 * POST /api/friends/follow/:userId
 * Idempotent: following someone you already follow is a 200 no-op.
 */
export async function followUser(req, res, next) {
  try {
    const followerId = resolveUserId(req);
    const { userId: followingId } = req.params;
    assertValidObjectId(followingId, 'userId');

    if (followerId.toString() === followingId.toString()) {
      throw new ApiError(400, 'You cannot follow yourself.');
    }

    const target = await User.findById(followingId).select('_id');
    if (!target) throw new ApiError(404, 'User not found.');

    // PHASE 10 — checked BEFORE the upsert so we can tell a genuinely NEW
    // follow apart from a repeated call to this idempotent endpoint (e.g.
    // a double-click, or a retried request after a network blip) — only
    // the former should notify. Small window between this read and the
    // upsert below where a concurrent duplicate request could both see
    // "not already following" and both notify; accepted as-is, consistent
    // with this codebase's existing stance on non-transactional writes
    // (see invasionEngine.js's header) rather than a real correctness bug
    // worth a transaction for.
    const alreadyFollowing = await Friendship.exists({ followerId, followingId, status: 'active' });

    try {
      await Friendship.findOneAndUpdate(
        { followerId, followingId },
        { $setOnInsert: { followerId, followingId, status: 'active' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      // Duplicate-key race (two near-simultaneous follow clicks) — the
      // document already exists either way, so treat it as success.
      if (err.code !== 11000) throw err;
    }

    if (!alreadyFollowing) {
      const follower = await User.findById(followerId).select('name');
      await notify(followingId, 'friend_request', {
        fromUserId: followerId.toString(),
        fromUserName: follower?.name || 'Someone',
      });
    }

    const status = await getStatus(followerId, followingId);
    res.status(200).json({ status });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/friends/unfollow/:userId
 * Idempotent: unfollowing someone you don't follow is a 200 no-op.
 */
export async function unfollowUser(req, res, next) {
  try {
    const followerId = resolveUserId(req);
    const { userId: followingId } = req.params;
    assertValidObjectId(followingId, 'userId');

    await Friendship.deleteOne({ followerId, followingId });

    const status = await getStatus(followerId, followingId);
    res.status(200).json({ status });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/friends/status/:userId
 * "none" | "following" | "followed-by" | "mutual", from the requesting
 * (authenticated) user's point of view toward :userId.
 */
export async function getFriendStatusHandler(req, res, next) {
  try {
    const viewerId = resolveUserId(req);
    const { userId: targetId } = req.params;
    assertValidObjectId(targetId, 'userId');

    if (viewerId.toString() === targetId.toString()) {
      return res.status(200).json({ status: 'mutual' }); // trivially true of yourself
    }

    const status = await getStatus(viewerId, targetId);
    res.status(200).json({ status });
  } catch (err) {
    next(err);
  }
}

const SEARCH_LIMIT_DEFAULT = 20;
const SEARCH_LIMIT_MAX = 50;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/friends/search?q=<fragment>&limit=<>
 */
export async function searchUsers(req, res, next) {
  try {
    const viewerId = resolveUserId(req);
    const q = (req.query.q || '').trim();
    let limit = Number(req.query.limit) || SEARCH_LIMIT_DEFAULT;
    limit = Math.min(Math.max(limit, 1), SEARCH_LIMIT_MAX);

    if (!q) {
      return res.status(200).json({ users: [] });
    }

    const pattern = new RegExp(escapeRegex(q), 'i');
    const candidates = await User.find({
      _id: { $ne: viewerId },
      name: pattern,
    })
      .select('name preferredColor region')
      .limit(limit)
      .lean();

    const users = await Promise.all(
      candidates.map(async (u) => ({
        id: u._id,
        name: u.name,
        region: u.region,
        preferredColor: u.preferredColor,
        status: await getStatus(viewerId, u._id),
      }))
    );

    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/friends
 * Everyone the requesting user can currently CHAT with — i.e. the union of
 * "I follow them" and "they follow me" — each tagged with `mutual`.
 */
export async function listFriends(req, res, next) {
  try {
    const viewerId = resolveUserId(req);

    const [following, followers] = await Promise.all([
      Friendship.find({ followerId: viewerId, status: 'active' }).select('followingId').lean(),
      Friendship.find({ followingId: viewerId, status: 'active' }).select('followerId').lean(),
    ]);

    const followingIds = new Set(following.map((f) => f.followingId.toString()));
    const followerIds = new Set(followers.map((f) => f.followerId.toString()));
    const mutualIds = new Set([...followingIds].filter((id) => followerIds.has(id)));
    const chattableIds = new Set([...followingIds, ...followerIds]);

    const users = await User.find({ _id: { $in: [...chattableIds] } })
      .select('name preferredColor region')
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));

    const friends = [...chattableIds]
      .map((id) => {
        const u = byId.get(id);
        if (!u) return null; // deleted-user guard
        return {
          id: u._id,
          name: u.name,
          region: u.region,
          preferredColor: u.preferredColor,
          mutual: mutualIds.has(id),
        };
      })
      .filter(Boolean);

    res.status(200).json({ friends });
  } catch (err) {
    next(err);
  }
}
