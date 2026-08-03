import * as turf from '@turf/turf';
import Territory from '../models/Territory.js';

// --- PHASE 4 tunables ---
// Default radius (meters) used when the caller omits `radius`.
const DEFAULT_RADIUS_METERS = 5000;
// Hard ceiling so a malformed/huge radius can't turn into a near-planet-size
// query. Keep this in sync with MAX_RADIUS_METERS in frontend/src/pages/Map.jsx.
const MAX_RADIUS_METERS = 25000;
// Segments used to approximate the query circle — more = rounder circle,
// slightly heavier query polygon. 64 is plenty smooth at city scale.
const CIRCLE_STEPS = 64;

// Stand-in for the real Calons economy (Phase 5 hasn't landed yet). Mirrors
// the POINTS_PER_SQM constant the Phase 5 prompt specifies (0.1 Calons per
// sqm) so this estimate is at least in the right ballpark once Phase 5
// lands — swap this out for a real stored/derived Calons value then.
const ESTIMATED_POINTS_PER_SQM = 0.1;

/**
 * GET /api/territories/nearby?lat=<>&lng=<>&radius=<meters>
 *
 * Returns every territory whose geometry INTERSECTS a circle of `radius`
 * meters around (lat, lng).
 *
 * DESIGN NOTE — $geoIntersects vs $geoWithin/$near: the phase prompt
 * suggests $geoWithin or $near, but both have a mismatch with what a map
 * viewport actually needs:
 *   - $geoWithin + $centerSphere only matches geometries falling ENTIRELY
 *     inside the circle, so a territory straddling the edge of the visible
 *     area would pop in/out abruptly as you pan — not "query by the visible
 *     viewport", more "query strictly inside it".
 *   - $near requires a point field and returns distance-sorted results; our
 *     territories are polygons, and we want "everything overlapping the
 *     view", not a sorted/limited nearest-N list.
 * $geoIntersects (still 2dsphere-index-backed, same index Phase 0 already
 * created) matches any territory that overlaps the circle at all, which is
 * the correct behavior for "render what's visible". The frontend computes
 * (lat, lng, radius) as the circle that circumscribes its current Leaflet
 * viewport, so in practice this still behaves like a bounding-box query.
 *
 * ⚠️ INTEGRATION ASSUMPTION: mounted WITHOUT auth middleware. The frontend's
 * "/" (Map) route isn't wrapped in <ProtectedRoute> (see App.jsx) — logged-
 * out visitors can already reach the map page — so this mirrors that and
 * stays public. If a later phase moves the map behind login, add Phase 1's
 * auth middleware here to match (Phase 1's actual middleware file wasn't in
 * this session's context, same caveat activityController.js already flags
 * for req.user).
 */
export async function getNearbyTerritories(req, res, next) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    let radius = req.query.radius !== undefined ? Number(req.query.radius) : DEFAULT_RADIUS_METERS;

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'lat must be a number between -90 and 90.' });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'lng must be a number between -180 and 180.' });
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      return res.status(400).json({ error: 'radius must be a positive number of meters.' });
    }
    radius = Math.min(radius, MAX_RADIUS_METERS);

    const circle = turf.circle([lng, lat], radius, { steps: CIRCLE_STEPS, units: 'meters' });

    const territories = await Territory.find({
      geometry: {
        $geoIntersects: { $geometry: circle.geometry },
      },
    })
      .populate('ownerId', 'name')
      .lean();

    const payload = territories.map((t) => ({
      id: t._id,
      // Defensive null check even though ownerId is schema-required: it
      // guards against a deleted-user edge case (no cascade delete wired up
      // anywhere yet) without 500-ing the whole map over one bad territory.
      owner: t.ownerId ? { id: t.ownerId._id, name: t.ownerId.name } : null,
      geometry: t.geometry,
      color: t.color,
      areaSqm: t.areaSqm,
      shapeType: t.shapeType,
      // TODO(Phase 5): replace with the real Calons value once territories
      // carry/derive one. This is a rough estimate using the same
      // points-per-sqm rate the Phase 5 prompt specifies, so it should
      // already be in the right ballpark once that phase lands.
      calonsEstimate: Math.round(t.areaSqm * ESTIMATED_POINTS_PER_SQM),
      // "Held since" == createdAt for now, since nothing can change
      // ownership yet (Phase 6). Once invasions land, either update this
      // timestamp on transfer or add a dedicated `capturedAt` field that
      // resets on ownership change — createdAt alone will otherwise keep
      // reporting the territory's ORIGINAL creation date forever.
      heldSinceISO: t.createdAt,
    }));

    res.status(200).json({
      center: { lat, lng },
      radius,
      count: payload.length,
      territories: payload,
    });
  } catch (err) {
    next(err);
  }
}
