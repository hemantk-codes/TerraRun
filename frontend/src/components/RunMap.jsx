import { useEffect, useRef } from 'react'
import L from 'leaflet'
// leaflet.css is imported once globally in main.jsx (Phase 2), not here.

// Vite/ESM breaks Leaflet's default marker icon URL resolution — this is
// the standard workaround, unrelated to app logic.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Matches --color-territory-500 in index.css so the live path previews in
// the same color territories will render in once Phase 3 exists.
const PATH_COLOR = '#34d399'

/**
 * Renders `path` ({lat,lng,ele,t}[]) as a growing polyline with a marker at
 * the current position, auto-following as new points arrive. Free/no-API-key
 * OpenStreetMap tiles, per the stack decision in the Master Context Block.
 */
export default function RunMap({ path }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const polylineRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true }).setView([20, 0], 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    polylineRef.current = L.polyline([], { color: PATH_COLOR, weight: 4 }).addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || path.length === 0) return

    const latLngs = path.map((p) => [p.lat, p.lng])
    polylineRef.current.setLatLngs(latLngs)

    const last = latLngs[latLngs.length - 1]
    if (!markerRef.current) {
      markerRef.current = L.marker(last).addTo(map)
    } else {
      markerRef.current.setLatLng(last)
    }
    map.setView(last, map.getZoom() < 15 ? 16 : map.getZoom())
  }, [path])

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-lg border border-ground-700 sm:h-96"
    />
  )
}
