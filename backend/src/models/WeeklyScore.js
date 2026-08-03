import mongoose from 'mongoose';

const { Schema } = mongoose;

// One snapshot per user per closed week. This is history — the LIVE
// leaderboard (leaderboardController.js) reads User.calonsWeekly directly,
// not this collection. This exists for Phase 10 (leaderboard_overtaken
// detection) and Phase 11 (weekly email reports), which both need "what did
// last week look like" after the live field has already been reset to 0.
const WeeklyScoreSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // The Monday 00:00 the SNAPSHOTTED (just-closed) week began.
    weekStartDate: { type: Date, required: true },
    score: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WeeklyScoreSchema.index({ userId: 1, weekStartDate: -1 });

export default mongoose.model('WeeklyScore', WeeklyScoreSchema);
