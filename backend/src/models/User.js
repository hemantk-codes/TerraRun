import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Signup is email+password OR phone+OTP (Phase 1) — both are optional at
    // the schema level so either flow can create a user, but the Phase 1
    // controller must enforce that at least one of email/phone is present.
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // allows many docs with no email without violating uniqueness
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    // Not required at the schema level: phone+OTP users (Firebase Phone Auth)
    // never get a local password. Phase 1 enforces "email signup requires
    // this field" in the controller.
    passwordHash: {
      type: String,
      select: false, // never returned by default on find()
    },

    bodyWeightKg: {
      type: Number,
      min: 20,
      max: 400,
    },
    heightCm: {
      type: Number,
      min: 50,
      max: 300,
    },
    // Simple country/state string for now (Phase 1 note: dropdown-driven on
    // the frontend). Auto-geolocation is a later enhancement.
    region: {
      type: String,
      trim: true,
    },
    // Hex color, e.g. "#3B82F6" — used as the fill/outline color for all of
    // this user's territories.
    preferredColor: {
      type: String,
      trim: true,
      default: '#3B82F6',
      match: [/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/, 'preferredColor must be a hex color'],
    },

    // --- Calons (points) — see Phase 5 ---
    calonsTotal: { type: Number, default: 0, min: 0 }, // monotonically non-decreasing, all-time
    calonsWeekly: { type: Number, default: 0, min: 0 }, // reset every Monday 00:00
    calonsMonthly: { type: Number, default: 0, min: 0 }, // reset on the 1st of every month

    // --- Streak / decay — see Phase 8 ---
    currentStreak: { type: Number, default: 0, min: 0 }, // consecutive calendar days with a valid run
    streakStoppers: { type: Number, default: 0, min: 0 }, // earned every 30-day streak, spends to freeze decay
    lastRunDate: { type: Date, default: null },
    lastRunCalories: { type: Number, default: null },

    // Settings — referenced by Phase 11 (weekly email opt-out)
    emailVerified: { type: Boolean, default: false },
    weeklyEmailOptOut: { type: Boolean, default: false },

    // --- Auth (Phase 1) ---
    // Incremented on logout (see authController.logout). Refresh tokens embed
    // the version they were issued under; a mismatch means "log out
    // everywhere" happened since, so that refresh token is rejected even
    // though its signature/expiry are still technically valid.
    refreshTokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);
