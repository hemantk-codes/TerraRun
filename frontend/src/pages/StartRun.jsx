import { useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed, Minus, Plus } from 'lucide-react'

import { useRunTracker } from '../hooks/useRunTracker.js'
import RunSummary from '../components/RunSummary.jsx'
import { postActivity } from '../lib/api.js'

const DEFAULT_CENTER = [28.6139, 77.209]
const DEFAULT_ZOOM = 15

function RunMap({ path }) {
  const coordinates = path
    .filter(
      (point) =>
        Number.isFinite(Number(point.lat)) &&
        Number.isFinite(Number(point.lng))
    )
    .map((point) => [Number(point.lat), Number(point.lng)])

  return (
    <div className="relative h-[384px] w-full overflow-hidden rounded-[22px] border-[5px] border-white bg-[#0b141d] shadow-[0_0_28px_rgba(201,255,47,0.38),0_0_55px_rgba(84,217,255,0.18)]">

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
        style={{ backgroundColor: '#0b0f0e' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
          maxZoom={19}
        />

        <RunMapControls />

        {coordinates.length > 1 && (
          <Polyline
            positions={coordinates}
            pathOptions={{
              color: '#c9ff2f',
              weight: 6,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}

function RunMapControls() {
  const map = useMap()
  const [locating, setLocating] = useState(false)

  const zoomIn = () => {
    map.zoomIn()
  }

  const zoomOut = () => {
    map.zoomOut()
  }

  const locateUser = () => {
    if (!navigator.geolocation || locating) return

    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextPosition = [
          coords.latitude,
          coords.longitude,
        ]

        map.flyTo(nextPosition, 17, {
          duration: 0.8,
        })

        setLocating(false)
      },
      () => {
        setLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex flex-col gap-2">
      {/* PLUS */}
      <button
        type="button"
        onClick={zoomIn}
        aria-label="Zoom in"
        className="pointer-events-auto flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-black/10 bg-[#FF9933] text-black shadow-[0_7px_18px_rgba(0,0,0,0.30)] transition hover:bg-[#ff8a14] active:scale-95"
      >
        <Plus size={19} strokeWidth={3} />
      </button>

      {/* MINUS */}
      <button
        type="button"
        onClick={zoomOut}
        aria-label="Zoom out"
        className="pointer-events-auto flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-black/10 bg-[#FF9933] text-black shadow-[0_7px_18px_rgba(0,0,0,0.30)] transition hover:bg-[#ff8a14] active:scale-95"
      >
        <Minus size={19} strokeWidth={3} />
      </button>

      {/* SELF LOCATION */}
      <button
        type="button"
        onClick={locateUser}
        aria-label="My location"
        className={`pointer-events-auto flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-white/15 bg-[#111d29]/95 text-white shadow-[0_7px_18px_rgba(0,0,0,0.30)] backdrop-blur-xl transition hover:bg-[#1a2a39] active:scale-95 ${
          locating ? 'animate-pulse text-[#c9ff2f]' : ''
        }`}
      >
        <LocateFixed size={18} strokeWidth={2.6} />
      </button>
    </div>
  )
}

export default function StartRun() {
  const {
    status,
    path,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
  } = useRunTracker()

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [activity, setActivity] = useState(null)

  const handleStop = async () => {
    stop()

    if (path.length < 2) {
      setSubmitError(
        'Not enough GPS points recorded to save this activity.'
      )
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const saved = await postActivity(path, {
        startTime: path[0].t,
        endTime: path[path.length - 1].t,
      })

      setActivity(saved)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismissSummary = () => {
    setActivity(null)
    reset()
  }

  if (activity) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#081019]">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/run.png')",
            backgroundAttachment: 'fixed',
          }}
        />

        <div className="relative z-10 mx-auto max-w-2xl px-6 pb-10 pt-[120px]">
          <RunSummary
            activity={activity}
            onDismiss={handleDismissSummary}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#081019]">
      {/* RUN BACKGROUND */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/run.png')",
          backgroundAttachment: 'fixed',
        }}
      />

      {/* CONTENT BELOW NAVBAR */}
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col gap-4 px-6 pb-10 pt-[120px]">

        {/* MAIN HEADING */}
        <div className="mb-1">
          <h1 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.5px] text-white sm:text-[36px]">
            Make your run.
            <br />
            Claim your territory.
          </h1>
        </div>

        {/* MAP */}
        <RunMap path={path} />

        {/* STATUS */}
        <div className="flex items-center justify-between rounded-[18px] border border-black/10 bg-[#FCC9E8] px-4 py-3 text-sm text-[#18222e] shadow-[0_12px_28px_rgba(0,0,0,0.20)]">
          <span>
            <span className="font-black text-[#18222e]">
              {path.length}
            </span>{' '}
            GPS points recorded
          </span>

          <span
            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
              status === 'tracking'
                ? 'border-[#ff3b30] bg-[#ffd9d6] text-[#ff3b30]'
                : status === 'paused'
                  ? 'border-[#389B39]/40 bg-[#ffb21c]/12 text-[#ffb21c]'
                  : 'border-[#4AA548] bg-[#CDEBB0] text-[#4AA548]'
            }`}
          >
            {status}
          </span>
        </div>

        {/* ERRORS */}
        {error && (
          <p className="rounded-[14px] border border-[#ff3b30]/35 bg-[#ff3b30]/10 px-4 py-3 text-sm text-[#ff8d86]">
            {error}
          </p>
        )}

        {submitError && (
          <p className="rounded-[14px] border border-[#ff3b30]/35 bg-[#ff3b30]/10 px-4 py-3 text-sm text-[#ff8d86]">
            {submitError}
          </p>
        )}

        {/* CONTROLS */}
        <div className="flex flex-wrap gap-3">
          {(status === 'idle' || status === 'stopped') && (
            <button
              type="button"
              onClick={start}
              style={{
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
              className="h-12 min-w-[150px] border-[3px] border-white bg-[#c9ff2f] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#11191f] shadow-[0_5px_0_#7e9d1d,0_10px_24px_rgba(0,0,0,0.24)] transition-transform hover:-translate-y-0.5 active:translate-y-[4px] active:shadow-[0_2px_0_#7e9d1d,0_6px_14px_rgba(0,0,0,0.20)]"
            >
              Start Run
            </button>
          )}

          {status === 'tracking' && (
            <button
              type="button"
              onClick={pause}
              style={{
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
              className="h-12 min-w-[125px] border-[3px] border-white bg-[#ff3b30] px-6 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_5px_0_#b52b22,0_10px_24px_rgba(0,0,0,0.24)] transition-transform hover:-translate-y-0.5 active:translate-y-[4px]"
            >
              Pause
            </button>
          )}

          {status === 'paused' && (
            <button
              type="button"
              onClick={resume}
              style={{
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
              className="h-12 min-w-[145px] border-[3px] border-white bg-[#c9ff2f] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#11191f] shadow-[0_5px_0_#7e9d1d,0_10px_24px_rgba(0,0,0,0.24)] transition-transform hover:-translate-y-0.5 active:translate-y-[4px]"
            >
              Resume
            </button>
          )}

          {(status === 'tracking' || status === 'paused') && (
            <button
              type="button"
              onClick={handleStop}
              disabled={submitting}
              style={{
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
              className="h-12 min-w-[165px] border-[3px] border-white bg-[#ff4fa1] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#140d16] shadow-[0_5px_0_#bd3977,0_10px_24px_rgba(0,0,0,0.24)] transition-transform hover:-translate-y-0.5 active:translate-y-[4px] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitting ? 'Saving…' : 'Stop & Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}