import { useCallback, useRef, useState } from 'react'

// Tunable: how often we accept a new GPS sample while tracking. Lower =
// smoother path / more accurate distance & calories, higher = less battery
// and data. 3s is a reasonable default for running/walking pace.
const SAMPLE_INTERVAL_MS = 3000

/**
 * Wraps navigator.geolocation.watchPosition into Start/Pause/Resume/Stop
 * controls and an accumulating {lat,lng,ele,t} path — the shape the Phase 2
 * backend (POST /api/activities) expects.
 *
 * Known limitation: `coords.altitude` is null on many devices/browsers, so
 * `ele` frequently comes through as 0. That's fine for Phase 2 (elevation
 * gain will just read 0 on those devices) — a real elevation source
 * (barometer sensor, reverse elevation lookup) is a reasonable "future
 * work" item for the mobile app version, same spirit as the vehicle-
 * detection heuristic note on the backend.
 */
export function useRunTracker() {
  const [status, setStatus] = useState('idle') // idle | tracking | paused | stopped
  const [path, setPath] = useState([])
  const [error, setError] = useState(null)

  const watchIdRef = useRef(null)
  const lastSampleAtRef = useRef(0)

  const handlePosition = useCallback((position) => {
    const now = Date.now()
    if (now - lastSampleAtRef.current < SAMPLE_INTERVAL_MS) return
    lastSampleAtRef.current = now

    const { latitude, longitude, altitude } = position.coords
    setPath((prev) => [
      ...prev,
      {
        lat: latitude,
        lng: longitude,
        ele: altitude ?? 0,
        t: new Date(position.timestamp).toISOString(),
      },
    ])
  }, [])

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    setError(null)
    setStatus('tracking')
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => setError(err.message || 'Location permission was denied.'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    )
  }, [handlePosition])

  const pause = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    start()
  }, [start])

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setStatus('stopped')
  }, [])

  const reset = useCallback(() => {
    setPath([])
    setStatus('idle')
    setError(null)
    lastSampleAtRef.current = 0
  }, [])

  return { status, path, error, start, pause, resume, stop, reset }
}
