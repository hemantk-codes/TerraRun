import * as turf from '@turf/turf'
import Territory from '../models/Territory.js'
import Friendship from '../models/Friendship.js'
import Notification from '../models/Notification.js' // Phase 7
import User from '../models/User.js' // Phase 7
import {
  generateOrganicPolygonAroundCenter,
} from '../utils/territoryEngine.js' // Phase 7
import {
  awardCalonsForAreaGain,
} from '../utils/calonsEngine.js' // Phase 7

// --- PHASE 4 tunables ---
const DEFAULT_RADIUS_METERS = 5000

const MAX_RADIUS_METERS = 25000

const CIRCLE_STEPS = 64

// Stand-in for the real Calons economy.
const ESTIMATED_POINTS_PER_SQM = 0.1

// --- PHASE 7 tunables ---
const REGENERATE_AREA_RATIO = 0.7

const REGENERATE_OFFSET_RADIUS_MULTIPLIER = 3

function toGeoJSON(geom) {
  return typeof geom?.toObject === 'function'
    ? geom.toObject()
    : geom
}

/**
 * GET /api/territories/nearby?lat=<>&lng=<>&radius=<meters>
 *
 * Returns every territory whose geometry intersects the requested area.
 *
 * The route can be accessed without authentication, but when an access
 * token is present optionalAuth places req.userId on the request. That lets
 * this endpoint calculate viewer-specific relationship information without
 * making the public map require login.
 */
export async function getNearbyTerritories(req, res, next) {
  try {
    const lat = Number(req.query.lat)
    const lng = Number(req.query.lng)

    let radius =
      req.query.radius !== undefined
        ? Number(req.query.radius)
        : DEFAULT_RADIUS_METERS

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        error:
          'lat must be a number between -90 and 90.',
      })
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        error:
          'lng must be a number between -180 and 180.',
      })
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      return res.status(400).json({
        error:
          'radius must be a positive number of meters.',
      })
    }

    radius = Math.min(
      radius,
      MAX_RADIUS_METERS,
    )

    const circle = turf.circle(
      [lng, lat],
      radius,
      {
        steps: CIRCLE_STEPS,
        units: 'meters',
      },
    )

    const territories =
      await Territory.find({
        geometry: {
          $geoIntersects: {
            $geometry: circle.geometry,
          },
        },
      })
        // IMPORTANT:
        // avatarUrl is included so the Live panel can display
        // the actual owner's uploaded Cloudinary avatar.
        .populate(
          'ownerId',
          'name avatarUrl',
        )
        .lean()

    // -------------------------------------------------------------------------
    // Viewer relationship information
    // -------------------------------------------------------------------------

    const viewerId =
      req.userId || null

    const followingIds = viewerId
      ? new Set(
          (
            await Friendship.find({
              followerId: viewerId,
              status: 'active',
            })
              .select('followingId')
              .lean()
          ).map((row) =>
            row.followingId.toString(),
          ),
        )
      : new Set()

    // -------------------------------------------------------------------------
    // Response payload
    // -------------------------------------------------------------------------

    const payload = territories.map(
      (territory) => {
        const owner =
          territory.ownerId

        const ownerId = owner?._id
          ? owner._id.toString()
          : null

        const isCurrentUser =
          Boolean(viewerId) &&
          Boolean(ownerId) &&
          ownerId ===
            viewerId.toString()

        const isFollowedByViewer =
          Boolean(ownerId) &&
          followingIds.has(ownerId)

        return {
          id: territory._id,

          // Real owner information, including avatar URL.
          owner: owner
            ? {
                id: owner._id,
                name: owner.name,
                avatarUrl:
                  owner.avatarUrl || null,
              }
            : null,

          // Viewer-specific relationship state.
          isCurrentUser,

          isFollowedByViewer,

          geometry:
            territory.geometry,

          color:
            territory.color,

          areaSqm:
            territory.areaSqm,

          shapeType:
            territory.shapeType,

          calonsEstimate:
            Math.round(
              territory.areaSqm *
                ESTIMATED_POINTS_PER_SQM,
            ),

          heldSinceISO:
            territory.createdAt,

          hasPendingSplit:
            Boolean(
              territory.pendingSplit,
            ),
        }
      },
    )

    res.status(200).json({
      center: {
        lat,
        lng,
      },

      radius,

      count:
        payload.length,

      territories:
        payload,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/territories/pending-splits
 *
 * Returns unresolved split decisions belonging to the
 * authenticated user.
 */
export async function getMyPendingSplits(
  req,
  res,
  next,
) {
  try {
    const userId =
      req.user?.id ||
      req.user?._id ||
      req.userId

    if (!userId) {
      return res.status(401).json({
        error: 'Not authenticated.',
      })
    }

    const territories =
      await Territory.find({
        ownerId: userId,
        pendingSplit: {
          $ne: null,
        },
      }).lean()

    const pendingSplits =
      territories.map(
        (territory) => ({
          territoryId:
            territory._id,

          territoryAreaSqm:
            territory.areaSqm,

          territoryShapeType:
            territory.shapeType,

          ...territory.pendingSplit,
        }),
      )

    res.status(200).json({
      pendingSplits,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/territories/:id/resolve-split
 *
 * Body:
 *
 * {
 *   action: 'regenerate',
 *   placement: 'upper' | 'lower' | 'random'
 * }
 *
 * OR
 *
 * {
 *   action: 'reclaim'
 * }
 */
export async function resolveSplit(
  req,
  res,
  next,
) {
  try {
    const userId =
      req.user?.id ||
      req.user?._id ||
      req.userId

    if (!userId) {
      return res.status(401).json({
        error: 'Not authenticated.',
      })
    }

    const {
      action,
      placement,
    } = req.body

    if (
      action !== 'regenerate' &&
      action !== 'reclaim'
    ) {
      return res.status(400).json({
        error:
          'action must be "regenerate" or "reclaim".',
      })
    }

    const territory =
      await Territory.findById(
        req.params.id,
      )

    if (!territory) {
      return res.status(404).json({
        error:
          'Territory not found.',
      })
    }

    if (
      territory.ownerId.toString() !==
      userId.toString()
    ) {
      return res.status(403).json({
        error:
          'You do not own this territory.',
      })
    }

    if (!territory.pendingSplit) {
      return res.status(400).json({
        error:
          'This territory has no pending split decision.',
      })
    }

    const user =
      await User.findById(userId)

    if (!user) {
      return res.status(404).json({
        error: 'User not found.',
      })
    }

    const {
      fragmentTerritoryId,
      notificationId,
      fragmentAreaSqm:
        pendingFragmentAreaSqm,
    } = territory.pendingSplit

    let responseBody

    if (action === 'reclaim') {
      territory.pendingSplit = null

      await territory.save()

      responseBody = {
        territory,

        message:
          "Left as-is — the fragment remains the invader's territory until you re-invade it.",
      }
    } else {
      if (
        placement !== 'upper' &&
        placement !== 'lower' &&
        placement !== 'random'
      ) {
        return res.status(400).json({
          error:
            'placement must be "upper", "lower", or "random".',
        })
      }

      const resolvedPlacement =
        placement === 'random'
          ? Math.random() < 0.5
            ? 'upper'
            : 'lower'
          : placement

      const fragment =
        await Territory.findById(
          fragmentTerritoryId,
        )

      const fragmentAreaSqm =
        fragment
          ? fragment.areaSqm
          : pendingFragmentAreaSqm

      const targetAreaSqm =
        fragmentAreaSqm *
        REGENERATE_AREA_RATIO

      const referenceCentroid =
        turf.centroid(
          turf.feature(
            toGeoJSON(
              territory.geometry,
            ),
          ),
        )

      const approxNewRadiusM =
        Math.sqrt(
          targetAreaSqm / Math.PI,
        )

      const offsetDistanceM =
        approxNewRadiusM *
        REGENERATE_OFFSET_RADIUS_MULTIPLIER

      const bearingDeg =
        resolvedPlacement === 'upper'
          ? 0
          : 180

      const destination =
        turf.destination(
          referenceCentroid,
          offsetDistanceM,
          bearingDeg,
          {
            units: 'meters',
          },
        )

      const {
        geometry,
        areaSqm,
      } =
        generateOrganicPolygonAroundCenter(
          destination.geometry
            .coordinates,
          targetAreaSqm,
        )

      const newTerritory =
        await Territory.create({
          ownerId: user._id,

          geometry,

          color:
            user.preferredColor,

          areaSqm,

          shapeType: 'random',

          strength: areaSqm,
        })

      if (fragment) {
        await Territory.deleteOne({
          _id: fragment._id,
        })
      }

      const calonsEarned =
        await awardCalonsForAreaGain(
          user._id,
          areaSqm,
        )

      territory.pendingSplit = null

      await territory.save()

      responseBody = {
        territory,

        newTerritory,

        calonsEarned,
      }
    }

    if (notificationId) {
      await Notification.findByIdAndUpdate(
        notificationId,
        {
          $set: {
            read: true,
            'payload.resolved': true,
          },
        },
      )
    }

    res.status(200).json(
      responseBody,
    )
  } catch (err) {
    next(err)
  }
}