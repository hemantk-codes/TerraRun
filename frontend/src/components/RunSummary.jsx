function formatPace(distanceKm, durationSec) {
  if (!distanceKm) return '--:--'
  const paceSecPerKm = durationSec / distanceKm
  const min = Math.floor(paceSecPerKm / 60)
  const sec = Math.round(paceSecPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')} /km`
}

function formatDuration(durationSec) {
  const h = Math.floor(durationSec / 3600)
  const m = Math.floor((durationSec % 3600) / 60)
  const s = Math.round(durationSec % 60)
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ground-300">{label}</dt>
      <dd className="mt-1 font-display text-lg text-ground-100">{value}</dd>
    </div>
  )
}

/**
 * `activity` is the object returned by POST /api/activities (the Phase 2
 * backend response) — distanceKm, durationSec, elevationGainM, calories,
 * activityType, isLoop, isValidForTerritory.
 */
export default function RunSummary({ activity, onDismiss }) {
  if (!activity) return null

  const { distanceKm, durationSec, elevationGainM, calories, activityType, isLoop, isValidForTerritory } = activity

  return (
    <div className="rounded-xl border border-ground-700 bg-ground-900 p-6">
      <h2 className="font-display text-xl font-semibold text-ground-100">Run complete</h2>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Distance" value={`${distanceKm.toFixed(2)} km`} />
        <Stat label="Time" value={formatDuration(durationSec)} />
        <Stat label="Pace" value={formatPace(distanceKm, durationSec)} />
        <Stat label="Elevation gain" value={`${Math.round(elevationGainM)} m`} />
        <Stat label="Calories" value={`${Math.round(calories)} kcal`} />
        <Stat label="Type" value={activityType} />
        <Stat label="Shape" value={isLoop ? 'Loop' : 'Path'} />
      </dl>

      {!isValidForTerritory && (
        <p className="mt-4 rounded-md border border-invasion-500/40 bg-invasion-500/10 px-3 py-2 text-sm text-invasion-500">
          {activityType === 'vehicle'
            ? 'This looks like it was recorded in a vehicle, so no territory was generated.'
            : "Runs under 1 km don't generate territory, but this one is still saved to your history."}
        </p>
      )}

      <button
        onClick={onDismiss}
        className="mt-6 rounded-md bg-territory-500 px-4 py-2 text-sm font-semibold text-ground-950 transition-opacity hover:opacity-90"
      >
        Done
      </button>
    </div>
  )
}
