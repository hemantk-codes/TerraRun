import * as turf from '@turf/turf';
import Territory from '../models/Territory.js';
import Notification from '../models/Notification.js'; // Phase 7
import User from '../models/User.js'; // Phase 7
import { generateOrganicPolygonAroundCenter } from '../utils/territoryEngine.js'; // Phase 7
import { awardCalonsForAreaGain } from '../utils/calonsEngine.js'; // Phase 7

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

// --- PHASE 7 tunables ---
// Spec: "use ~70% of the fragment's area as the new [regenerated] target".
const REGENERATE_AREA_RATIO = 0.7;
// How far (as a multiple of the new territory's own approximate radius) to
// offset its centroid from the reference point (the victim's remaining
// territory's centroid), so the regenerated territory lands clearly beside
// it rather than overlapping. GAME-BALANCE / visual-placement heuristic —
// tune by playtesting, same pattern as AREA_PER_CALORIE / POINTS_PER_SQM.
const REGENERATE_OFFSET_RADIUS_MULTIPLIER = 3;

function toGeoJSON(geom) {
  return typeof geom?.toObject === 'function' ? geom.toObject() : geom;
}

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
      // Phase 7 — lets the frontend flag a territory on the map as
      // "mid-decision" if you want to (not required, just available).
      hasPendingSplit: Boolean(t.pendingSplit),
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

/**
 * GET /api/territories/pending-splits
 *
 * Phase 7 — returns every territory the requesting user owns that currently
 * has an unresolved split decision (pendingSplit != null). The frontend
 * polls this once on load (see hooks/usePendingTerritorySplits.js) to
 * decide whether to show the resolve-split modal — a stand-in for the real
 * Phase 10 notification feed, which doesn't exist yet.
 *
 * ⚠️ INTEGRATION ASSUMPTION: like createActivity in activityController.js,
 * this assumes it's mounted behind Phase 1's auth middleware with
 * req.user.id / req.user._id / req.userId populated. Unlike
 * getNearbyTerritories above, this one genuinely needs auth — it's
 * per-user data — so make sure routes/territories.js actually wires the
 * middleware in before this ships.
 */
export async function getMyPendingSplits(req, res, next) {
  try {
    const userId = req.user?.id || req.user?._id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const territories = await Territory.find({
      ownerId: userId,
      pendingSplit: { $ne: null },
    }).lean();

    const pendingSplits = territories.map((t) => ({
      territoryId: t._id,
      territoryAreaSqm: t.areaSqm,
      territoryShapeType: t.shapeType,
      ...t.pendingSplit,
    }));

    res.status(200).json({ pendingSplits });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/territories/:id/resolve-split
 *
 * Body: { action: 'regenerate', placement: 'upper' | 'lower' | 'random' }
 *    or { action: 'reclaim' }
 *
 * `:id` is the VICTIM's own (remaining, post-cut) territory — the one
 * carrying the pendingSplit this call resolves. See splitEngine.js's
 * "DESIGN DECISIONS" header comment for why the orphaned fragment itself is
 * a separate Territory document (owned by the invader) rather than data
 * living only on this one.
 *
 * ⚠️ INTEGRATION ASSUMPTION: same auth assumption as getMyPendingSplits
 * above.
 */
export async function resolveSplit(req, res, next) {
  try {
    const userId = req.user?.id || req.user?._id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const { action, placement } = req.body;
    if (action !== 'regenerate' && action !== 'reclaim') {
      return res.status(400).json({ error: 'action must be "regenerate" or "reclaim".' });
    }

    const territory = await Territory.findById(req.params.id);
    if (!territory) {
      return res.status(404).json({ error: 'Territory not found.' });
    }
    if (territory.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'You do not own this territory.' });
    }
    // This is what makes the endpoint idempotent / keeps the frontend modal
    // from being able to re-trigger itself: once pendingSplit is cleared
    // (by either branch below), a second call returns 400 instead of
    // silently doing nothing or double-applying an effect.
    if (!territory.pendingSplit) {
      return res.status(400).json({ error: 'This territory has no pending split decision.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { fragmentTerritoryId, notificationId, fragmentAreaSqm: pendingFragmentAreaSqm } =
      territory.pendingSplit;

    let responseBody;

    if (action === 'reclaim') {
      // Spec: "no immediate effect — just clear the pending decision flag."
      // The fragment (already a normal Territory owned by the invader,
      // per splitEngine.js) is untouched — getting it back later just means
      // beating the invader in an ordinary Phase 6 invasion.
      territory.pendingSplit = null;
      await territory.save();
      responseBody = {
        territory,
        message: 'Left as-is — the fragment remains the invader\'s territory until you re-invade it.',
      };
    } else {
      // action === 'regenerate'
      if (placement !== 'upper' && placement !== 'lower' && placement !== 'random') {
        return res.status(400).json({ error: 'placement must be "upper", "lower", or "random".' });
      }
      const resolvedPlacement = placement === 'random' ? (Math.random() < 0.5 ? 'upper' : 'lower') : placement;

      const fragment = await Territory.findById(fragmentTerritoryId);
      // Fall back to the snapshotted area on pendingSplit if the fragment
      // document has somehow already been removed (shouldn't normally
      // happen — nothing else in this codebase deletes a Territory except
      // Phase 6's full-consumption case, which never targets Phase 7
      // fragments — but this keeps "regenerate" from hard-failing if it does).
      const fragmentAreaSqm = fragment ? fragment.areaSqm : pendingFragmentAreaSqm;
      const targetAreaSqm = fragmentAreaSqm * REGENERATE_AREA_RATIO;

      // Reference point: the victim's OWN remaining territory's centroid,
      // per the phase prompt's suggestion ("e.g. their existing territory's
      // centroid"). Using the post-cut geometry (already saved on this doc
      // by splitEngine.js) so the offset is relative to where their land
      // actually is now, not where it used to be before the slice.
      const referenceCentroid = turf.centroid(turf.feature(toGeoJSON(territory.geometry)));
      const approxNewRadiusM = Math.sqrt(targetAreaSqm / Math.PI);
      const offsetDistanceM = approxNewRadiusM * REGENERATE_OFFSET_RADIUS_MULTIPLIER;
      const bearingDeg = resolvedPlacement === 'upper' ? 0 : 180; // north : south
      const destination = turf.destination(referenceCentroid, offsetDistanceM, bearingDeg, {
        units: 'meters',
      });

      const { geometry, areaSqm } = generateOrganicPolygonAroundCenter(
        destination.geometry.coordinates,
        targetAreaSqm
      );

      const newTerritory = await Territory.create({
        ownerId: user._id,
        geometry,
        color: user.preferredColor,
        areaSqm,
        shapeType: 'random',
        strength: areaSqm,
      });

      if (fragment) {
        // Spec: "Delete the orphaned fragment." See splitEngine.js's DESIGN
        // DECISIONS #2 for why this really does delete the invader's
        // territory rather than transferring it anywhere.
        await Territory.deleteOne({ _id: fragment._id });
      }

      // New ground gained (from nothing, same as any other fresh territory)
      // — reuses the Phase 5 award path rather than inventing a new one.
      const calonsEarned = await awardCalonsForAreaGain(user._id, areaSqm);

      territory.pendingSplit = null;
      await territory.save();

      responseBody = { territory, newTerritory, calonsEarned };
    }

    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, {
        $set: { read: true, 'payload.resolved': true },
      });
    }

    res.status(200).json(responseBody);
  } catch (err) {
    next(err);
  }
}
