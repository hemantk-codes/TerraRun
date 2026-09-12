import mongoose from 'mongoose';
import { Message } from '../models/index.js';
import { getConversationId } from '../utils/conversation.js';
import { canChat } from '../utils/friendshipEngine.js';
import { notify } from '../utils/notificationService.js'; // Phase 10

const MAX_MESSAGE_LENGTH = 2000;
const ALLOWED_MESSAGE_TYPES = ['text', 'image', 'system'];

// PHASE 10 — checks whether ANY currently-connected socket belonging to
// `userId` is sitting in `roomName` right now. Used below to decide
// whether a chat message should ALSO create a persisted/toast
// Notification: if the recipient already has this exact thread open,
// they're already seeing the message appear live via `message:new` —
// creating a Notification on top of that would be a redundant toast
// stacked on the message bubble that just rendered, which is the kind of
// "duplicate/spammy notification" the Phase 10 integration checklist
// warns about, even though it's not a literal double-fire of one event.
function isUserInRoom(io, userId, roomName) {
  const room = io.sockets.adapter.rooms.get(roomName);
  if (!room) return false;
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId);
    if (s?.userId === userId) return true;
  }
  return false;
}

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
      // the very next message rather than only after a reconnect.
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
      // elsewhere in the app.
      io.to(`user:${otherUserId}`).emit('message:new', payload);

      // PHASE 10 — persisted + toast notification, skipped only when the
      // recipient already has this exact thread open (see isUserInRoom).
      const recipientHasThreadOpen = isUserInRoom(io, otherUserId, `conversation:${conversationId}`);
      if (!recipientHasThreadOpen) {
        await notify(otherUserId, 'chat_message_received', {
          conversationId,
          senderId: socket.userId,
          preview: message.content.slice(0, 140),
        });
      }

      ack?.({ ok: true, message: payload });
    } catch (err) {
      ack?.({ ok: false, error: 'Failed to send message.' });
    }
  });
}
