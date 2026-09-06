import mongoose from 'mongoose';
import { Message } from '../models/index.js';
import { getConversationId } from '../utils/conversation.js';
import { canChat } from '../utils/friendshipEngine.js';

// Tunable — generous enough for a real chat message, small enough to stop
// someone pasting a novel into the socket.
const MAX_MESSAGE_LENGTH = 2000;
const ALLOWED_MESSAGE_TYPES = ['text', 'image', 'system'];

/**
 * Registers all chat-related listeners on one connected socket. Called once
 * per connection from sockets/index.js.
 *
 * Room strategy:
 *   - `user:<userId>` — every socket auto-joins its own personal room on
 *     connect. Not used by anything in Phase 9 itself, but reserved for
 *     Phase 10 (server -> user push: new-message badges, notifications)
 *     without requiring the client to have a specific conversation open —
 *     also used below so the Chat tab's conversation LIST updates in real
 *     time even before its thread is opened.
 *   - `conversation:<conversationId>` — joined explicitly when the client
 *     opens a thread. Real-time `message:new` events are broadcast here.
 */
export function registerChatHandlers(io, socket) {
  socket.join(`user:${socket.userId}`);

  socket.on('conversation:join', ({ otherUserId } = {}, ack) => {
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return ack?.({ ok: false, error: 'Invalid otherUserId.' });
    }
    const conversationId = getConversationId(socket.userId, otherUserId);
    socket.join(`conversation:${conversationId}`);
    ack?.({ ok: true, conversationId });
  });

  socket.on('conversation:leave', ({ otherUserId } = {}) => {
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) return;
    const conversationId = getConversationId(socket.userId, otherUserId);
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('message:send', async ({ otherUserId, content, type = 'text' } = {}, ack) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
        return ack?.({ ok: false, error: 'Invalid otherUserId.' });
      }
      if (socket.userId === otherUserId) {
        return ack?.({ ok: false, error: 'You cannot message yourself.' });
      }
      if (typeof content !== 'string' || !content.trim()) {
        return ack?.({ ok: false, error: 'Message content cannot be empty.' });
      }
      if (content.length > MAX_MESSAGE_LENGTH) {
        return ack?.({ ok: false, error: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.` });
      }
      if (!ALLOWED_MESSAGE_TYPES.includes(type)) {
        return ack?.({ ok: false, error: 'Invalid message type.' });
      }

      // Authorization happens HERE, at send time — not just once at
      // connect — so an unfollow that happens mid-session takes effect on
      // the very next message rather than only after a reconnect. This is
      // what the Phase 9 integration checklist's "un-friending disables
      // future [messaging]" behavior actually rests on.
      const allowed = await canChat(socket.userId, otherUserId);
      if (!allowed) {
        return ack?.({
          ok: false,
          error: 'You can only message users you follow or who follow you.',
        });
      }

      const conversationId = getConversationId(socket.userId, otherUserId);
      const message = await Message.create({
        conversationId,
        senderId: socket.userId,
        type,
        content: content.trim(),
      });

      const payload = {
        _id: message._id,
        conversationId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        createdAt: message.createdAt,
      };

      // Broadcast to whoever has the thread open right now...
      io.to(`conversation:${conversationId}`).emit('message:new', payload);
      // ...and nudge the recipient's personal room too, in case they're
      // elsewhere in the app (e.g. viewing the Chat tab's conversation list
      // rather than this specific thread). Harmless double-delivery if
      // they're in both rooms — the frontend dedupes by message _id.
      io.to(`user:${otherUserId}`).emit('message:new', payload);

      ack?.({ ok: true, message: payload });
    } catch (err) {
      ack?.({ ok: false, error: 'Failed to send message.' });
    }
  });
}
