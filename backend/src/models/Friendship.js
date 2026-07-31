import mongoose from 'mongoose';

const { Schema } = mongoose;

// Each document is ONE direction of a follow (followerId follows
// followingId). "Friends" / mutual status is derived in Phase 9 by checking
// whether the reverse document also exists — there is no separate
// "mutual" flag to keep in sync.
const FriendshipSchema = new Schema(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    followingId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// A user can only follow another user once.
FriendshipSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

export default mongoose.model('Friendship', FriendshipSchema);
