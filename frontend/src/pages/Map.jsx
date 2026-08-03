import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getTerritoryStyle } from '../utils/territoryStyle.js'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// --- Tunables (Phase 4) ---
// Initial view before the user pans anywhere. New Delhi is just a plausible
// starting point for this project — change freely, or wire up
// navigator.geolocation later if you want it to open on the user's actual
// location.
const DEFAULT_CENTER = [28.6139, 77.209] // [lat, lng] — Leaflet's own order
const DEFAULT_ZOOM = 15
// Below this zoom, territories (tens-to-low-hundreds of meters across) are
// too small to read meaningfully and the viewport-covering circle would get
// very large. Show a "zoom in" hint instead of querying.
const MIN_ZOOM_FOR_TERRITORIES = 13
// Wait for this many ms of pan/zoom inactivity before refetching.
const REFETCH_DEBOUNCE_MS = 400
// Client-side mirror of the backend's own radius cap in
// territoryController.js — keep the two numbers in sync.
const MAX_RADIUS_METERS = 25000

function formatArea(areaSqm) {
  if (areaSqm >= 10000) return `${(areaSqm / 10000).toFixed(2)} ha`
  return `${Math.round(areaSqm)} m²`
}

function formatHeldDuration(isoDate) {
  if (!isoDate) return 'just now'
  const ms = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days < 1) {
    const hours = Math.max(1, Math.floor(ms / (1000 * 60 * 60)))
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  return `${days} day${days === 1 ? '' : 's'}`
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c])
}

// Leaflet's GeoJSON layer renders popups via raw HTML, not JSX — this stays
// a plain string builder rather than a React component for that reason.
function buildPopupHtml(props) {
  return `
    <div>
      <p class="terrarun-popup-owner">${escapeHtml(props.ownerName)}</p>
      <p class="terrarun-popup-meta">${formatArea(props.areaSqm)} · ${escapeHtml(props.shapeType)}</p>
      <p class="terrarun-popup-meta">~${Math.round(props.calonsEstimate)} Calons <span class="terrarun-popup-est">(est.)</span></p>
      <p class="terrarun-popup-held">Held for ${formatHeldDuration(props.heldSinceISO)}</p>
    </div>
  `
}

async function fetchNearbyTerritories({ lat, lng, radius }, signal) {
  const url = new URL(`${API_BASE_URL}/territories/nearby`)
  url.searchParams.set('lat', lat)
  url.searchParams.set('lng', lng)
  url.searchParams.set('radius', Math.round(radius))

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to load territories (${res.status})`)
  }
  return res.json()
}

/**
 * Invisible helper that watches map pan/zoom and reports the current
 * viewport to the parent as a covering circle (center + radius), debounced.
 * Must render as a child of <MapContainer> — useMapEvents only works there.
 */
function ViewportWatcher({ onViewportChange }) {
  const reportViewport = useCallback(
    (map) => {
      const bounds = map.getBounds()
      const center = bounds.getCenter()
      // Radius to the farthest corner fully covers the visible box — some
      // extra area outside the box gets included too, which just means a
      // few more territories fetched than strictly visible, never fewer.
      const radius = Math.min(center.distanceTo(bounds.getNorthEast()), MAX_RADIUS_METERS)
      onViewportChange({ lat: center.lat, lng: center.lng, radius, zoom: map.getZoom() })
    },
    [onViewportChange]
  )

  const debouncedReport = useDebouncedCallback(reportViewport, REFETCH_DEBOUNCE_MS)

  const map = useMapEvents({
    moveend: () => debouncedReport(map),
    zoomend: () => debouncedReport(map),
  })

  // Report the initial viewport once immediately — no need to debounce the
  // very first load.
  useEffect(() => {
    reportViewport(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function TerritoryLayer({ territories, fetchNonce }) {
  const featureCollection = {
    type: 'FeatureCollection',
    features: territories.map((t) => ({
      type: 'Feature',
      id: t.id,
      geometry: t.geometry,
      properties: {
        color: t.color,
        ownerName: t.owner?.name || 'Unknown runner',
        areaSqm: t.areaSqm,
        shapeType: t.shapeType,
        calonsEstimate: t.calonsEstimate,
        heldSinceISO: t.heldSinceISO,
      },
    })),
  }

  return (
    <GeoJSON
      // react-leaflet's <GeoJSON> doesn't pick up `data` prop changes on an
      // already-mounted layer — keying on the fetch count forces a clean
      // remount every time a new batch of territories arrives.
      key={fetchNonce}
      data={featureCollection}
      style={(feature) => getTerritoryStyle(feature.properties.color)}
      onEachFeature={(feature, layer) => {
        layer.bindPopup(buildPopupHtml(feature.properties))
      }}
    />
  )
}

export default function Map() {
  const [territories, setTerritories] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error' | 'zoomOut'
  const [errorMessage, setErrorMessage] = useState(null)
  const [fetchNonce, setFetchNonce] = useState(0)
  const abortRef = useRef(null)
  const lastViewportRef = useRef(null)

  const handleViewportChange = useCallback((viewport) => {
    lastViewportRef.current = viewport

    if (viewport.zoom < MIN_ZOOM_FOR_TERRITORIES) {
      abortRef.current?.abort()
      setStatus('zoomOut')
      setTerritories([])
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setErrorMessage(null)

    fetchNearbyTerritories(viewport, controller.signal)
      .then((data) => {
        setTerritories(data.territories || [])
        setStatus('ready')
        setFetchNonce((n) => n + 1)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setStatus('error')
        setErrorMessage(err.message)
      })
  }, [])

  const handleRetry = useCallback(() => {
    if (lastViewportRef.current) handleViewportChange(lastViewportRef.current)
  }, [handleViewportChange])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return (
    <div className="relative h-[80vh] min-h-[500px] w-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ backgroundColor: '#0b0f0e' }}
      >
        <TileLayer
          // Switched from plain OSM tiles to CARTO's free dark basemap —
          // matches the "night satellite map" aesthetic index.css already
          // describes, and gives every territory color far more contrast
          // (light OSM tiles were washing out the semi-transparent fills).
          // Still free, no API key — same constraint the original tech
          // choice was made under. Revert any time by swapping back to:
          //   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          //   attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <ViewportWatcher onViewportChange={handleViewportChange} />
        <TerritoryLayer territories={territories} fetchNonce={fetchNonce} />
      </MapContainer>

      {status === 'loading' && (
        <div className="pointer-events-none absolute right-4 top-4 z-[1000] flex items-center gap-2 rounded-full border border-ground-700 bg-ground-900/90 px-4 py-2 text-sm text-ground-300 shadow-lg backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-territory-400" />
          Loading territories…
        </div>
      )}

      {status === 'error' && (
        <div className="absolute right-4 top-4 z-[1000] max-w-xs rounded-lg border border-invasion-500/40 bg-ground-900/95 px-4 py-3 text-sm text-invasion-500 shadow-lg backdrop-blur">
          <p>{errorMessage || 'Could not load territories.'}</p>
          <button type="button" onClick={handleRetry} className="btn-secondary mt-2 px-3 py-1 text-xs">
            Retry
          </button>
        </div>
      )}

      {status === 'zoomOut' && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-ground-700 bg-ground-900/90 px-4 py-2 text-sm text-ground-300 shadow-lg backdrop-blur">
          Zoom in to see territories
        </div>
      )}

      {status === 'ready' && territories.length === 0 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-ground-700 bg-ground-900/90 px-4 py-2 text-sm text-ground-300 shadow-lg backdrop-blur">
          No territory claimed here yet — be the first!
        </div>
      )}
    </div>
  )
}
