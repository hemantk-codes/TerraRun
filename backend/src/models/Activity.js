import mongoose from 'mongoose';

const { Schema } = mongoose;

// One GPS sample. `ele` (elevation, meters) and `t` (timestamp) are both
// required for the Phase 2 calorie engine (grade + segment duration).
const GpsPointSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    ele: { type: Number, default: 0 }, // meters
    t: { type: Date, required: true },
  },
  { _id: false }
);

const ActivitySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    gpsPath: {
      type: [GpsPointSchema],
      default: [],
    },

    // --- Computed by the Phase 2 calorie/geometry engine ---
    distanceKm: { type: Number, default: 0, min: 0 },
    elevationGainM: { type: Number, default: 0, min: 0 }, // sum of positive deltas only
    durationSec: { type: Number, default: 0, min: 0 },
    calories: { type: Number, default: 0, min: 0 },

    activityType: {
      type: String,
      enum: ['run', 'walk', 'vehicle', 'unknown'],
      default: 'unknown',
    },
    isLoop: { type: Boolean, default: false },

    // Set false by the Phase 2 <1km / vehicle-detection rules. When false,
    // territory generation (Phase 3) is skipped entirely for this activity.
    isValidForTerritory: { type: Boolean, default: false },

    // Populated once Phase 3's territory-generation step runs successfully.
    territoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Territory',
      default: null,
    },
  },
  { timestamps: true }
);

ActivitySchema.index({ userId: 1, startTime: -1 });

export default mongoose.model('Activity', ActivitySchema);
