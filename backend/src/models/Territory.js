import mongoose from 'mongoose';

const { Schema } = mongoose;

// Standard GeoJSON Polygon/MultiPolygon. Territory can become a MultiPolygon
// after a split (Phase 7) or a partial invasion (Phase 6), so both types are
// allowed here rather than locking to Polygon only.
const GeoJsonSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Polygon', 'MultiPolygon'],
      required: true,
    },
    coordinates: {
      type: Schema.Types.Mixed, // nested coordinate arrays differ in depth between Polygon/MultiPolygon
      required: true,
    },
  },
  { _id: false }
);

const DecayStateSchema = new Schema(
  {
    startedAt: { type: Date, default: null },
    dailyShrinkRate: { type: Number, default: null }, // sqm/day, see Phase 8
    daysToZero: { type: Number, default: null },
  },
  { _id: false }
);

const TerritorySchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    geometry: {
      type: GeoJsonSchema,
      required: true,
    },
    color: {
      type: String,
      required: true,
      match: [/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/, 'color must be a hex color'],
    },
    areaSqm: { type: Number, required: true, min: 0 },
    shapeType: {
      type: String,
      enum: ['loop', 'line', 'random'],
      required: true,
    },
    // Starts equal to areaSqm at creation (Phase 3). Acts as the "health
    // pool" a siege (Phase 6) has to exceed before a weaker invader can
    // take the territory.
    strength: { type: Number, required: true, min: 0 },

    // Map of invaderId (string) -> accumulated siege damage (Phase 6).
    siegeDamage: {
      type: Map,
      of: Number,
      default: {},
    },

    lastReinforcedAt: { type: Date, default: Date.now },

    // Null/empty until the Phase 8 decay cron activates it after 3+ inactive days.
    decayState: {
      type: DecayStateSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

// 2dsphere enables $geoWithin / $near / $geoIntersects queries used by
// Phase 4 (viewport queries) and Phase 6 (overlap detection).
TerritorySchema.index({ geometry: '2dsphere' });
TerritorySchema.index({ ownerId: 1 });

export default mongoose.model('Territory', TerritorySchema);
