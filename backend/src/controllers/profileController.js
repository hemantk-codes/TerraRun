import { User } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { sanitizeUser } from '../utils/sanitizeUser.js';
import { isValidHexColor } from '../utils/validators.js';

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw new ApiError(404, 'User not found.');
    res.status(200).json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

// Only these fields are user-editable here. Everything else (calonsTotal,
// streak counters, territory-derived stats, etc.) is written by later
// phases' own backend logic, never directly from a client request — keeping
// an explicit allow-list avoids a mass-assignment bug down the line.
// PHASE 11 — added weeklyEmailOptOut so the Profile page's new toggle
// (frontend/src/pages/Profile.jsx) can actually persist. `emailVerified` is
// deliberately NOT in this list — that's meant to be set by a verification
// flow (not built yet, see jobs/weeklyReportJobs.js's header), never by the
// user directly flipping it.
const EDITABLE_FIELDS = ['name', 'bodyWeightKg', 'heightCm', 'region', 'preferredColor', 'weeklyEmailOptOut'];

export async function updateMe(req, res, next) {
  try {
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (updates.name !== undefined && !updates.name.trim()) {
      throw new ApiError(400, 'Name cannot be empty.');
    }
    if (updates.preferredColor !== undefined && !isValidHexColor(updates.preferredColor)) {
      throw new ApiError(400, 'preferredColor must be a hex color, e.g. #3B82F6.');
    }
    if (updates.weeklyEmailOptOut !== undefined) {
      updates.weeklyEmailOptOut = Boolean(updates.weeklyEmailOptOut);
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true, // enforces the schema's bodyWeightKg/heightCm min/max, etc.
      context: 'query',
    });
    if (!user) throw new ApiError(404, 'User not found.');

    res.status(200).json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}