import mongoose from 'mongoose';

const { Schema } = mongoose;

// Same idea as WeeklyScore.js — one snapshot per user per closed month,
// pure history for Phase 10/11. The live leaderboard reads
// User.calonsMonthly directly.
const MonthlyScoreSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // The 1st-of-month 00:00 the SNAPSHOTTED (just-closed) month began.
    monthStartDate: { type: Date, required: true },
    score: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MonthlyScoreSchema.index({ userId: 1, monthStartDate: -1 });

export default mongoose.model('MonthlyScore', MonthlyScoreSchema);
