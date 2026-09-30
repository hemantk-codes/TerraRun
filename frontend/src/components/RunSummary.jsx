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

function Stat({ label, value, icon }) {
  const colorizedValue = String(value)
    .split(/(\d+(?:\.\d+)?)/g)
    .map((part, index) =>
      /^\d+(?:\.\d+)?$/.test(part) ? (
        <span key={index} className="text-[#FF9933]">
          {part}
        </span>
      ) : (
        <span key={index} className="text-black">
          {part}
        </span>
      ),
    )

  return (
    <div className="stat-plate">
      <dt className="flex items-center justify-center gap-1 text-[10px] font-bold text-black">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>

      <dd className="mt-1 font-display text-lg font-extrabold">
        {colorizedValue}
      </dd>
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
    <div className="panel">
      <h2 className="title-plaque">Run complete</h2>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="🏃" label="Distance" value={`${distanceKm.toFixed(2)} km`} />
        <Stat icon="⏱️" label="Time" value={formatDuration(durationSec)} />
        <Stat icon="⚡" label="Pace" value={formatPace(distanceKm, durationSec)} />
        <Stat icon="⛰️" label="Elevation gain" value={`${Math.round(elevationGainM)} m`} />
        <Stat icon="🔥" label="Calories" value={`${Math.round(calories)} kcal`} />
        <Stat icon="🏷️" label="Type" value={activityType} />
        <Stat icon="🔁" label="Shape" value={isLoop ? 'Loop' : 'Path'} />
      </dl>

      {!isValidForTerritory && (
        <p className="form-error mt-4">
          {activityType === 'vehicle'
            ? 'This looks like it was recorded in a vehicle, so no territory was generated.'
            : "Runs under 1 km don't generate territory, but this one is still saved to your history."}
        </p>
      )}

      <button onClick={onDismiss} className="btn-primary mt-6">
        Done
      </button>
    </div>
  )
}
