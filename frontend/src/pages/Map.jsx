import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import {
  LocateFixed,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import 'leaflet/dist/leaflet.css'

import { useAuth } from '../context/AuthContext.jsx'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.js'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// -----------------------------------------------------------------------------
// Map tunables
// -----------------------------------------------------------------------------

const DEFAULT_CENTER = [28.6139, 77.209]
const DEFAULT_ZOOM = 15
const MIN_ZOOM_FOR_TERRITORIES = 13
const REFETCH_DEBOUNCE_MS = 400
const MAX_RADIUS_METERS = 25000

// Viewer-dependent territory colors.
const FRIEND_TERRITORY_COLOR = '#8BE82F'
const RIVAL_TERRITORY_COLOR = '#ff3b30'
const CONTESTED_TERRITORY_COLOR = '#ffb21c'

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------

function formatAreaKm2(areaSqm) {
  const value = Number(areaSqm)

  if (!Number.isFinite(value) || value <= 0) {
    return '0 m²'
  }

  const km2 = value / 1_000_000

  if (km2 < 0.01) {
    return `${Math.round(value)} m²`
  }

  if (km2 < 10) {
    return `${km2.toFixed(2)} km²`
  }

  return `${km2.toFixed(1)} km²`
}

function formatHeldDuration(isoDate) {
  if (!isoDate) return 'just now'

  const time = new Date(isoDate).getTime()

  if (!Number.isFinite(time)) {
    return 'just now'
  }

  const elapsed = Math.max(0, Date.now() - time)

  const days = Math.floor(
    elapsed / (1000 * 60 * 60 * 24),
  )

  if (days >= 1) {
    return `${days} day${days === 1 ? '' : 's'}`
  }

  const hours = Math.floor(
    elapsed / (1000 * 60 * 60),
  )

  if (hours >= 1) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }

  const minutes = Math.max(
    1,
    Math.floor(elapsed / (1000 * 60)),
  )

  return `${minutes} min${minutes === 1 ? '' : 's'}`
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>\"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  )
}

// -----------------------------------------------------------------------------
// Territory display helpers
// -----------------------------------------------------------------------------

function getTerritoryDisplayColor(territory) {
  if (territory.isCurrentUser) {
    return territory.color
  }

  if (territory.hasPendingSplit) {
    return CONTESTED_TERRITORY_COLOR
  }

  if (territory.isFollowedByViewer) {
    return FRIEND_TERRITORY_COLOR
  }

  return RIVAL_TERRITORY_COLOR
}

function getTerritoryStyle(color) {
  return {
    color: '#061018',
    weight: 2,
    opacity: 1,
    fillColor: color,
    fillOpacity: 1,
  }
}

function buildTerritoryLabelHtml({
  ownerName,
  areaSqm,
}) {
  return `
    <div class="terrarun-territory-label">
      <div class="terrarun-territory-label-owner">
        ${escapeHtml(ownerName)}
      </div>
      <div class="terrarun-territory-label-area">
        ${escapeHtml(formatAreaKm2(areaSqm))}
      </div>
    </div>
  `
}

function buildPopupHtml(props) {
  return `
    <div class="terrarun-popup">
      <p class="terrarun-popup-owner">
        ${escapeHtml(props.ownerName)}
      </p>

      <p class="terrarun-popup-meta">
        ${escapeHtml(formatAreaKm2(props.areaSqm))}
        ·
        ${escapeHtml(props.shapeType)}
      </p>

      <p class="terrarun-popup-meta">
        ~${Math.round(Number(props.calonsEstimate) || 0).toLocaleString('en-IN')}
        Calons
        <span class="terrarun-popup-est">(est.)</span>
      </p>

      <p class="terrarun-popup-held">
        Held for ${escapeHtml(formatHeldDuration(props.heldSinceISO))}
      </p>
    </div>
  `
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

async function fetchNearbyTerritories(
  { lat, lng, radius },
  signal,
  accessToken,
) {
  const url = new URL(
    `${API_BASE_URL}/territories/nearby`,
  )

  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lng', String(lng))
  url.searchParams.set(
    'radius',
    String(Math.round(radius)),
  )

  const res = await fetch(url.toString(), {
    signal,
    headers: accessToken
      ? {
        Authorization: `Bearer ${accessToken}`,
      }
      : {},
  })

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({}))

    throw new Error(
      body.error ||
      `Failed to load territories (${res.status})`,
    )
  }

  return res.json()
}

// -----------------------------------------------------------------------------
// Place search API
// -----------------------------------------------------------------------------

async function searchPlace(query, signal) {
  const url = new URL(
    'https://photon.komoot.io/api/',
  )

  url.searchParams.set('q', query)
  url.searchParams.set('limit', '5')

  const res = await fetch(url.toString(), {
    signal,
  })

  if (!res.ok) {
    throw new Error('Place search failed.')
  }

  return res.json()
}

// -----------------------------------------------------------------------------
// Viewport watcher
// -----------------------------------------------------------------------------

function ViewportWatcher({ onViewportChange }) {
  const reportViewport = useCallback(
    (map) => {
      const bounds = map.getBounds()
      const center = bounds.getCenter()

      const radius = Math.min(
        center.distanceTo(bounds.getNorthEast()),
        MAX_RADIUS_METERS,
      )

      onViewportChange({
        lat: center.lat,
        lng: center.lng,
        radius,
        zoom: map.getZoom(),
      })
    },
    [onViewportChange],
  )

  const debouncedReport = useDebouncedCallback(
    reportViewport,
    REFETCH_DEBOUNCE_MS,
  )

  const map = useMapEvents({
    moveend: () => debouncedReport(map),
    zoomend: () => debouncedReport(map),
  })

  useEffect(() => {
    reportViewport(map)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

// -----------------------------------------------------------------------------
// Map controls
// -----------------------------------------------------------------------------

function MapControls() {
  const map = useMap()

  const [searchOpen, setSearchOpen] =
    useState(false)

  const [query, setQuery] =
    useState('')

  const [results, setResults] =
    useState([])

  const [searching, setSearching] =
    useState(false)

  const [dropdownPosition, setDropdownPosition] =
    useState({
      left: 24,
      top: 176,
    })

  const searchContainerRef =
    useRef(null)

  const zoomIn = () => {
    map.zoomIn()
  }

  const zoomOut = () => {
    map.zoomOut()
  }

  const locateUser = () => {
    if (!navigator.geolocation) {
      return
    }

    map.locate({
      setView: true,
      maxZoom: 17,
      enableHighAccuracy: true,
    })
  }

  // ---------------------------------------------------------------------------
  // Keep the portal dropdown directly below the search bar
  // ---------------------------------------------------------------------------

  const updateDropdownPosition = useCallback(() => {
    if (!searchContainerRef.current) {
      return
    }

    const rect =
      searchContainerRef.current.getBoundingClientRect()

    setDropdownPosition({
      left: rect.left,
      top: rect.bottom + 6,
    })
  }, [])

  useEffect(() => {
    if (!searchOpen) {
      return
    }

    updateDropdownPosition()

    const handlePositionChange = () => {
      updateDropdownPosition()
    }

    window.addEventListener(
      'resize',
      handlePositionChange,
    )

    window.addEventListener(
      'scroll',
      handlePositionChange,
      true,
    )

    return () => {
      window.removeEventListener(
        'resize',
        handlePositionChange,
      )

      window.removeEventListener(
        'scroll',
        handlePositionChange,
        true,
      )
    }
  }, [
    searchOpen,
    updateDropdownPosition,
  ])

  // ---------------------------------------------------------------------------
  // Live search
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setResults([])
      setSearching(false)
      return
    }

    const controller =
      new AbortController()

    setSearching(true)

    const timeoutId =
      window.setTimeout(() => {
        searchPlace(
          trimmedQuery,
          controller.signal,
        )
          .then((data) => {
            if (controller.signal.aborted) {
              return
            }

            const features =
              Array.isArray(data?.features)
                ? data.features
                : []

            setResults(
              features.slice(0, 5),
            )

            requestAnimationFrame(
              updateDropdownPosition,
            )
          })
          .catch((error) => {
            if (
              error?.name === 'AbortError' ||
              controller.signal.aborted
            ) {
              return
            }

            setResults([])
          })
          .finally(() => {
            if (!controller.signal.aborted) {
              setSearching(false)

              requestAnimationFrame(
                updateDropdownPosition,
              )
            }
          })
      }, 200)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    query,
    updateDropdownPosition,
  ])

  // ---------------------------------------------------------------------------
  // Close search when clicking outside
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(
          event.target,
        )
      ) {
        setSearchOpen(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
      )
    }
  }, [])

  const getPlaceLabel = (place) => {
    const properties =
      place?.properties || {}

    return [
      properties.name,
      properties.city,
      properties.state,
      properties.country,
    ]
      .filter(Boolean)
      .filter(
        (value, index, array) =>
          array.indexOf(value) === index,
      )
      .join(', ')
  }

  const selectPlace = (place) => {
    const coordinates =
      place?.geometry?.coordinates

    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2
    ) {
      return
    }

    const lng = Number(coordinates[0])
    const lat = Number(coordinates[1])

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return
    }

    map.flyTo(
      [lat, lng],
      15,
      {
        duration: 0.9,
      },
    )

    setSearchOpen(false)
    setResults([])
    setQuery('')
  }

  const openSearch = () => {
    setSearchOpen(true)

    requestAnimationFrame(() => {
      updateDropdownPosition()
    })
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setResults([])
    setQuery('')
  }

  const showDropdown =
    searchOpen &&
    query.trim() &&
    (
      searching ||
      results.length > 0 ||
      (!searching && results.length === 0)
    )

  return (
    <>
      <div className="pointer-events-auto absolute left-6 top-[125px] z-[1100] flex flex-col gap-3">

        {/* Search */}
        <div
          ref={searchContainerRef}
          className="relative"
        >
          {!searchOpen ? (
            <button
              type="button"
              onClick={openSearch}
              aria-label="Search places"
              className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/20 bg-white/95 text-[#18222e] shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:scale-[1.03] active:scale-[0.97]"
            >
              <Search
                className="h-5 w-5"
                strokeWidth={2.8}
              />
            </button>
          ) : (
            <div className="w-[300px]">
              <div className="flex h-11 items-center rounded-[14px] border border-white/20 bg-white/95 px-3 shadow-[0_8px_20px_rgba(0,0,0,0.24)]">
                <Search
                  className="h-5 w-5 shrink-0 text-[#18222e]"
                  strokeWidth={2.6}
                />

                <input
                  type="text"
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                  autoFocus
                  placeholder="Search a place..."
                  className="min-w-0 flex-1 bg-transparent px-2.5 text-[13px] font-semibold text-[#18222e] outline-none placeholder:text-[#6d7884]"
                />

                <button
                  type="button"
                  onClick={closeSearch}
                  aria-label="Close search"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#18222e] transition hover:bg-black/10"
                >
                  <X
                    className="h-4 w-4"
                    strokeWidth={2.8}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Zoom in */}
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/20 bg-white/95 text-[#18222e] shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:scale-[1.03] active:scale-[0.97]"
        >
          <Plus
            className="h-5 w-5"
            strokeWidth={3}
          />
        </button>

        {/* Zoom out */}
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/20 bg-white/95 text-[#18222e] shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:scale-[1.03] active:scale-[0.97]"
        >
          <Minus
            className="h-5 w-5"
            strokeWidth={3}
          />
        </button>

        {/* Live location */}
        <button
          type="button"
          onClick={locateUser}
          aria-label="Locate me"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/20 bg-white/95 text-[#18222e] shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition hover:scale-[1.03] active:scale-[0.97]"
        >
          <LocateFixed
            className="h-5 w-5"
            strokeWidth={2.7}
          />
        </button>
      </div>

      {/* ---------------------------------------------------------------------
          Search results portal
          ------------------------------------------------------------------ */}
      {showDropdown &&
        createPortal(
          <div
            className="pointer-events-auto fixed w-[300px] overflow-hidden rounded-[16px] border border-black/10 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
            style={{
              left: `${dropdownPosition.left}px`,
              top: `${dropdownPosition.top}px`,
              zIndex: 99999,
            }}
          >
            {searching && (
              <div className="px-4 py-3 text-[12px] font-semibold text-[#6d7884]">
                Searching...
              </div>
            )}

            {!searching &&
              results.length > 0 && (
                <div className="py-1.5">
                  {results
                    .slice(0, 5)
                    .map(
                      (place, index) => {
                        const label =
                          getPlaceLabel(
                            place,
                          )

                        return (
                          <button
                            key={
                              place?.properties
                                ?.osm_id ||
                              `${label}-${index}`
                            }
                            type="button"
                            onClick={() =>
                              selectPlace(
                                place,
                              )
                            }
                            className="block w-full border-b border-black/5 px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f2f5f7]"
                          >
                            <p className="truncate text-[13px] font-black text-[#18222e]">
                              {place
                                ?.properties
                                ?.name ||
                                label}
                            </p>

                            <p className="mt-0.5 truncate text-[11px] font-medium text-[#6d7884]">
                              {label}
                            </p>
                          </button>
                        )
                      },
                    )}
                </div>
              )}

            {!searching &&
              query.trim() &&
              results.length === 0 && (
                <div className="px-4 py-3 text-[12px] font-semibold text-[#6d7884]">
                  No places found.
                </div>
              )}
          </div>,
          document.body,
        )}
    </>
  )
}

// -----------------------------------------------------------------------------
// Territory layer
// -----------------------------------------------------------------------------

function TerritoryLayer({
  territories,
  fetchNonce,
}) {
  const featureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',

      features: territories.map((territory) => {
        const displayColor =
          getTerritoryDisplayColor(territory)

        return {
          type: 'Feature',
          id: territory.id,
          geometry: territory.geometry,

          properties: {
            color: displayColor,

            ownerName:
              territory.owner?.name ||
              'Unknown runner',

            areaSqm:
              territory.areaSqm,

            shapeType:
              territory.shapeType ||
              'territory',

            calonsEstimate:
              territory.calonsEstimate ||
              0,

            heldSinceISO:
              territory.heldSinceISO,

            isCurrentUser:
              Boolean(
                territory.isCurrentUser,
              ),

            isFollowedByViewer:
              Boolean(
                territory.isFollowedByViewer,
              ),

            hasPendingSplit:
              Boolean(
                territory.hasPendingSplit,
              ),

            territoryId:
              territory.id,
          },
        }
      }),
    }),
    [territories],
  )

  return (
    <GeoJSON
      key={fetchNonce}
      data={featureCollection}
      style={(feature) =>
        getTerritoryStyle(
          feature.properties.color,
        )
      }
      onEachFeature={(feature, layer) => {
        const props = feature.properties

        layer.bindTooltip(
          buildTerritoryLabelHtml({
            ownerName: props.ownerName,
            areaSqm: props.areaSqm,
          }),
          {
            permanent: true,
            direction: 'center',
            className:
              'terrarun-permanent-territory-tooltip',
            opacity: 1,
          },
        )

        layer.bindPopup(
          buildPopupHtml(props),
        )
      }}
    />
  )
}

// -----------------------------------------------------------------------------
// Owner avatar
// -----------------------------------------------------------------------------

function OwnerAvatar({
  name,
  avatarUrl,
  size = 'normal',
}) {
  const [failed, setFailed] = useState(false)

  const initial =
    name?.trim()?.charAt(0)?.toUpperCase() ||
    '?'

  const sizeClass =
    size === 'small'
      ? 'h-8 w-8 text-[12px]'
      : 'h-10 w-10 text-[14px]'

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={`${name || 'Runner'} avatar`}
        onError={() => setFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full border-2 border-white/90 object-cover shadow-[0_4px_10px_rgba(0,0,0,0.22)]`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border-2 border-white/90 bg-[#38b4e5] font-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.22)]`}
    >
      {initial}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Live panel
// -----------------------------------------------------------------------------

function LivePanel({ territories }) {
  const visibleTerritories =
    territories.slice(0, 4)

  const activeOwners = new Set(
    territories
      .map((territory) =>
        territory.owner?.id
          ? String(territory.owner.id)
          : null,
      )
      .filter(Boolean),
  )

  return (
    <div className="pointer-events-none absolute right-6 top-[125px] z-[1000] w-[285px] rounded-[22px] border border-white/15 bg-[#111d29]/92 p-4 text-white shadow-[0_16px_36px_rgba(0,0,0,0.30)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#8BE82F] shadow-[0_0_12px_rgba(139,232,47,0.85)]" />

          <span className="text-[14px] font-black tracking-[0.04em]">
            LIVE
          </span>
        </div>

        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80">
          {activeOwners.size} active
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        {visibleTerritories.length === 0 && (
          <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] font-semibold text-white/55">
            No nearby territory activity yet.
          </div>
        )}

        {visibleTerritories.map(
          (territory) => {
            const ownerName =
              territory.owner?.name ||
              'Unknown runner'

            const displayColor =
              getTerritoryDisplayColor(
                territory,
              )

            return (
              <div
                key={territory.id}
                className="flex items-center gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.045] px-2.5 py-2.5"
              >
                <OwnerAvatar
                  name={ownerName}
                  avatarUrl={
                    territory.owner
                      ?.avatarUrl
                  }
                  size="small"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          displayColor,
                        opacity: 1,
                      }}
                    />

                    <p className="truncate text-[12px] font-black text-white">
                      {ownerName}
                    </p>
                  </div>

                  <p className="mt-1 text-[10px] font-semibold text-white/55">
                    {formatAreaKm2(
                      territory.areaSqm,
                    )}{' '}
                    ·{' '}
                    {formatHeldDuration(
                      territory.heldSinceISO,
                    )}
                  </p>
                </div>
              </div>
            )
          },
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Legend
// -----------------------------------------------------------------------------

function MapLegend({ userColor }) {
  const items = [
    {
      label: 'Your Territory',
      color:
        userColor || '#9df21d',
    },
    {
      label: 'Rival Territory',
      color:
        RIVAL_TERRITORY_COLOR,
    },
    {
      label: 'Friend Territory',
      color:
        FRIEND_TERRITORY_COLOR,
    },
    {
      label: 'Contested',
      color:
        CONTESTED_TERRITORY_COLOR,
    },
  ]

  return (
    <div className="pointer-events-none absolute bottom-7 left-6 z-[1000] min-w-[205px] rounded-[20px] border border-white/15 bg-[#111d29]/92 px-5 py-8 text-white shadow-[0_16px_36px_rgba(0,0,0,0.30)] backdrop-blur-xl">
      <div className="flex flex-col gap-6">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3"
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-white/25 opacity-100"
              style={{
                backgroundColor:
                  item.color,
                opacity: 1,
                filter: 'none',
              }}
            />

            <span className="text-[14px] font-bold leading-none text-white">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main map page
// -----------------------------------------------------------------------------

export default function Map() {
  const navigate = useNavigate()
  const { user, accessToken } =
    useAuth()

  const [territories, setTerritories] =
    useState([])

  const [status, setStatus] =
    useState('loading')

  const [errorMessage, setErrorMessage] =
    useState(null)

  const [fetchNonce, setFetchNonce] =
    useState(0)

  const lastViewportRef =
    useRef(null)

  const abortRef =
    useRef(null)

  const requestIdRef =
    useRef(0)

  const loadTerritories =
    useCallback(
      (
        viewport,
        { silent = false } = {},
      ) => {
        if (!viewport) return

        lastViewportRef.current =
          viewport

        if (
          viewport.zoom <
          MIN_ZOOM_FOR_TERRITORIES
        ) {
          abortRef.current?.abort()

          setStatus('zoomOut')
          setTerritories([])

          return
        }

        abortRef.current?.abort()

        const controller =
          new AbortController()

        abortRef.current =
          controller

        const requestId =
          ++requestIdRef.current

        if (!silent) {
          setStatus('loading')
          setErrorMessage(null)
        }

        fetchNearbyTerritories(
          viewport,
          controller.signal,
          accessToken,
        )
          .then((data) => {
            if (
              controller.signal.aborted ||
              requestId !==
              requestIdRef.current
            ) {
              return
            }

            setTerritories(
              data.territories || [],
            )

            setStatus('ready')
            setErrorMessage(null)

            setFetchNonce(
              (previous) =>
                previous + 1,
            )
          })
          .catch((error) => {
            if (
              error.name ===
              'AbortError' ||
              controller.signal.aborted
            ) {
              return
            }

            if (
              requestId !==
              requestIdRef.current
            ) {
              return
            }

            if (!silent) {
              setStatus('error')

              setErrorMessage(
                error.message ||
                'Could not load territories.',
              )
            }
          })
      },
      [accessToken],
    )

  const handleViewportChange =
    useCallback(
      (viewport) => {
        loadTerritories(viewport, {
          silent: false,
        })
      },
      [loadTerritories],
    )

  const handleRetry =
    useCallback(() => {
      if (lastViewportRef.current) {
        loadTerritories(
          lastViewportRef.current,
          {
            silent: false,
          },
        )
      }
    }, [loadTerritories])

  // Refresh relationship-aware colors periodically.
  useEffect(() => {
    const intervalId =
      window.setInterval(() => {
        if (lastViewportRef.current) {
          loadTerritories(
            lastViewportRef.current,
            {
              silent: true,
            },
          )
        }
      }, 4000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadTerritories])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0b1726] font-body">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={10}
        maxZoom={19}
        scrollWheelZoom
        zoomControl={false}
        className="absolute inset-0 z-0 h-full w-full"
        style={{
          backgroundColor: '#0b1726',
        }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxNativeZoom={19}
          maxZoom={19}
        />

        <ViewportWatcher
          onViewportChange={
            handleViewportChange
          }
        />

        <MapControls />

        <TerritoryLayer
          territories={territories}
          fetchNonce={fetchNonce}
        />
      </MapContainer>

      <style>
        {`
          .leaflet-tile-pane {
            filter:
              brightness(.48)
              saturate(1.32)
              contrast(1.10)
              sepia(.16)
              hue-rotate(178deg);
          }

          .terrarun-permanent-territory-tooltip {
            background: rgba(17, 29, 41, .94) !important;
            border: 1px solid rgba(255,255,255,.16) !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 24px rgba(0,0,0,.28) !important;
            color: white !important;
            padding: 7px 10px !important;
          }

          .terrarun-permanent-territory-tooltip::before {
            display: none !important;
          }

          .terrarun-territory-label {
            text-align: center;
            line-height: 1.05;
            pointer-events: none;
          }

          .terrarun-territory-label-owner {
            font-size: 11px;
            font-weight: 900;
            letter-spacing: .01em;
            color: #ffffff;
            white-space: nowrap;
            text-shadow:
              0 1px 2px rgba(0,0,0,.82),
              0 2px 6px rgba(0,0,0,.75);
          }

          .terrarun-territory-label-area {
            margin-top: 3px;
            font-size: 10px;
            font-weight: 800;
            color: rgba(255,255,255,.82);
            white-space: nowrap;
            text-shadow:
              0 1px 2px rgba(0,0,0,.82),
              0 2px 6px rgba(0,0,0,.75);
          }

          .terrarun-popup {
            min-width: 170px;
            padding: 2px;
          }

          .terrarun-popup-owner {
            margin: 0 0 6px;
            font-size: 15px;
            font-weight: 900;
            color: #18222e;
          }

          .terrarun-popup-meta {
            margin: 4px 0;
            font-size: 12px;
            font-weight: 700;
            color: #536273;
          }

          .terrarun-popup-est {
            opacity: .55;
          }

          .terrarun-popup-held {
            margin: 7px 0 0;
            font-size: 11px;
            font-weight: 800;
            color: #6d7a87;
          }

          .leaflet-popup-content-wrapper,
          .leaflet-popup-tip {
            border-radius: 14px !important;
          }
        `}
      </style>

      {status === 'loading' && (
        <div className="pointer-events-none absolute right-6 top-[125px] z-[1000] flex items-center gap-2 rounded-full border border-white/10 bg-[#111d29]/92 px-4 py-2.5 text-[12px] font-bold text-white/75 shadow-[0_10px_26px_rgba(0,0,0,0.26)] backdrop-blur-xl">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#8BE82F]" />
          Loading territories…
        </div>
      )}

      {status === 'error' && (
        <div className="pointer-events-auto absolute right-6 top-[125px] z-[1000] max-w-[300px] rounded-[18px] border border-[#ff3b30]/40 bg-[#111d29]/95 px-4 py-4 text-white shadow-[0_18px_38px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <p className="text-[13px] font-bold text-white/90">
            {errorMessage ||
              'Could not load territories.'}
          </p>

          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black text-white transition hover:bg-white/15"
          >
            RETRY
          </button>
        </div>
      )}

      {status === 'zoomOut' && (
        <div className="pointer-events-none absolute bottom-[122px] left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-white/10 bg-[#111d29]/92 px-5 py-2.5 text-[12px] font-bold text-white/75 shadow-[0_10px_26px_rgba(0,0,0,0.26)] backdrop-blur-xl">
          Zoom in to see territories
        </div>
      )}

      <LivePanel
        territories={territories}
      />

      <MapLegend
        userColor={user?.preferredColor}
      />

      <button
        type="button"
        onClick={() => navigate('/run')}
        style={{
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
        className="pointer-events-auto absolute bottom-7 right-7 z-[1000] flex h-[68px] min-w-[255px] items-center justify-center gap-3 border-[5px] border-white bg-[#ff4fa1] px-8 text-[17px] font-extrabold tracking-[0.01em] text-[#140d16] shadow-[0_7px_0_#bd3977,0_12px_26px_rgba(0,0,0,0.30)] transition-transform hover:-translate-y-0.5 active:translate-y-[5px] active:shadow-[0_2px_0_#bd3977,0_7px_14px_rgba(0,0,0,0.22)]"
      >
        <span
          className="text-[28px] leading-none"
          aria-hidden="true"
        >
          🏃
        </span>

        <span
          className="text-[17px] font-black"
          style={{
            WebkitTextStroke: '0.7px currentColor',
            textShadow: `
              0.5px 0 currentColor,
              -0.5px 0 currentColor,
              0 0.5px currentColor,
              0 -0.5px currentColor
            `,
          }}
        >
          START A RUN
        </span>
      </button>
    </div>
  )
}