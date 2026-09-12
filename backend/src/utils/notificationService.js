import Notification from '../models/Notification.js';
import { getIO } from '../sockets/ioInstance.js';

/**
 * PHASE 10 — the one place every earlier phase's "create a Notification
 * doc" TODO/bare-write now funnels through.
 *
 * (a) Persists a Notification document — what GET /api/notifications and
 *     the bell badge read on next load/reopen ("...and later in the
 *     notification list (app reopened)" per the phase's Definition of Done).
 * (b) Emits a `notification:new` event to the user's personal Socket.io
 *     room (`user:<userId>`, already joined by every authenticated socket
 *     in chatHandlers.js's registerChatHandlers) — the "live toast (app
 *     open)" half of that same line. If the user has no live connection
 *     right now, `io.to(room).emit(...)` is a silent no-op — nobody's in
 *     that room — so there's no need to check "is this user online" first.
 *
 * Deliberately the ONLY function in this codebase that constructs a
 * Notification document from now on. Every earlier-phase file that used to
 * call `Notification.create(...)` directly (invasionEngine.js,
 * splitEngine.js, decayEngine.js, decayJobs.js) now calls this instead —
 * per the Phase 10 integration checklist ("No duplicate notifications from
 * a single event — easy bug: firing both a DB write and a socket emit from
 * two different code paths"), having exactly one function own both halves
 * makes that bug structurally impossible rather than just "remembered not
 * to do".
 *
 * Returns the created Notification document — some callers (e.g.
 * splitEngine.js's pendingSplit.notificationId) still need its _id.
 */
export async function notify(userId, type, payload = {}) {
  const notification = await Notification.create({ userId, type, payload });

  const io = getIO();
  if (io) {
    io.to(`user:${userId.toString()}`).emit('notification:new', {
      _id: notification._id,
      userId: notification.userId,
      type: notification.type,
      payload: notification.payload,
      read: notification.read,
      createdAt: notification.createdAt,
    });
  }

  return notification;
}
