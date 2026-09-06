import Friendship from '../models/Friendship.js';

/**
 * True if `followerId` currently follows `followingId` — an ACTIVE,
 * one-directional Friendship document exists in exactly that direction.
 * (status: 'blocked' rows, if any ever exist, deliberately don't count —
 * there's no block feature built yet, this just future-proofs the check.)
 */
export async function followExists(followerId, followingId) {
  const doc = await Friendship.findOne({
    followerId,
    followingId,
    status: 'active',
  }).lean();
  return Boolean(doc);
}

/**
 * "Friends" per the Phase 9 spec (§2): mutual only when BOTH directions
 * exist as separate documents — there's no standalone "mutual" flag to
 * keep in sync. Exported mainly for Phase 12 to reuse verbatim: its own
 * prompt says calls need "canChat AND the mutual-friend check from Phase 9".
 */
export async function isMutual(userIdA, userIdB) {
  const [aFollowsB, bFollowsA] = await Promise.all([
    followExists(userIdA, userIdB),
    followExists(userIdB, userIdA),
  ]);
  return aFollowsB && bFollowsA;
}

/**
 * Text chat per the Phase 9 spec (§3): allowed whenever EITHER direction of
 * follow exists. Used both by the REST follow-status endpoint's derived
 * status and — importantly — re-checked live inside the socket "send
 * message" handler, not just once at connect time.
 */
export async function canChat(userIdA, userIdB) {
  const [aFollowsB, bFollowsA] = await Promise.all([
    followExists(userIdA, userIdB),
    followExists(userIdB, userIdA),
  ]);
  return aFollowsB || bFollowsA;
}

/**
 * Status of `viewerId` -> `targetId`, from the viewer's point of view:
 *   "mutual"      both directions exist
 *   "following"   viewer -> target only
 *   "followed-by" target -> viewer only
 *   "none"        neither
 */
export async function getStatus(viewerId, targetId) {
  const [viewerFollowsTarget, targetFollowsViewer] = await Promise.all([
    followExists(viewerId, targetId),
    followExists(targetId, viewerId),
  ]);
  if (viewerFollowsTarget && targetFollowsViewer) return 'mutual';
  if (viewerFollowsTarget) return 'following';
  if (targetFollowsViewer) return 'followed-by';
  return 'none';
}
