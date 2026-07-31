import mongoose from 'mongoose';

const { Schema } = mongoose;

// `type` is intentionally a free string rather than a strict enum — new
// notification types get added across later phases (territory_invaded,
// territory_split, invasion_succeeded, chat_message_received, call_incoming,
// friend_request, leaderboard_overtaken, streak_stopper_earned,
// decay_warning, territory_fully_decayed, ...). Phase 10 centralizes the
// list; keeping this open avoids a schema migration every time one's added.
const NotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    // Arbitrary event-specific data (e.g. { territoryId, invaderName, areaLostSqm }).
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export default mongoose.model('Notification', NotificationSchema);
