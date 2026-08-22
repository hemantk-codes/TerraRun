import { useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// Same placeholder-token-source caveat as usePendingTerritorySplits.js.
function getAccessToken() {
  return localStorage.getItem('accessToken')
}

// Small local duplicate of Map.jsx's formatArea — not worth a shared utils
// file for one four-line function used in two places, but flagging it here
// in case a third caller shows up later (at that point, promote it to
// frontend/src/utils/formatArea.js).
function formatArea(areaSqm) {
  if (areaSqm >= 10000) return `${(areaSqm / 10000).toFixed(2)} ha`
  return `${Math.round(areaSqm)} m²`
}

const REGENERATE_AREA_RATIO = 0.7 // mirrors the backend's REGENERATE_AREA_RATIO — display-only, not authoritative

const PLACEMENT_OPTIONS = [
  { value: 'upper', label: 'North of here' },
  { value: 'lower', label: 'South of here' },
  { value: 'random', label: 'Either — surprise me' },
]

/**
 * PHASE 7 — shown whenever usePendingTerritorySplits() has at least one
 * unresolved decision. Renders ONE at a time (the front of the queue);
 * resolving it calls onResolved(territoryId), which pops it off and — if
 * more are queued — this same modal re-renders for the next one.
 *
 * Deliberately un-dismissable without making a choice (no backdrop-click-
 * to-close, no [x]) — the phase prompt frames this as a decision the victim
 * needs to make, not an optional toast.
 */
export default function TerritorySplitModal({ pendingSplits, onResolved }) {
  const [placement, setPlacement] = useState('upper')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!pendingSplits || pendingSplits.length === 0) return null

  const current = pendingSplits[0]
  const previewNewAreaSqm = current.fragmentAreaSqm * REGENERATE_AREA_RATIO

  async function resolve(action) {
    setSubmitting(true)
    setError(null)
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_BASE_URL}/territories/${current.territoryId}/resolve-split`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(action === 'regenerate' ? { action, placement } : { action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Could not resolve the split (${res.status})`)
      }
      onResolved(current.territoryId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-ground-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-invasion-500/40 bg-ground-900 p-6 shadow-2xl">
        <span className="rounded-full border border-invasion-500/40 bg-invasion-500/10 px-3 py-1 font-display text-xs uppercase tracking-widest text-invasion-500">
          Territory split
        </span>

        <h2 className="mt-4 font-display text-xl font-semibold text-ground-100">
          {current.invaderName} cut through your territory
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ground-300">
          Their route pierced your land in two places without looping, splitting off a{' '}
          <span className="text-ground-100">{formatArea(current.fragmentAreaSqm)}</span> piece.
          You kept the larger share ({formatArea(current.territoryAreaSqm)}), but that piece is
          now separate ground, currently held by {current.invaderName}.
        </p>

        {error && (
          <p className="mt-3 rounded-md border border-invasion-500/40 bg-invasion-500/10 px-3 py-2 text-sm text-invasion-500">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-ground-700 bg-ground-950/60 p-4">
            <p className="font-display text-sm font-semibold text-ground-100">Rebuild elsewhere</p>
            <p className="mt-1 text-xs leading-relaxed text-ground-300">
              Give up your claim on that piece for good, and get a smaller territory (
              {formatArea(previewNewAreaSqm)}) placed near what you still hold.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {PLACEMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPlacement(opt.value)}
                  aria-pressed={placement === opt.value}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    placement === opt.value
                      ? 'border-territory-500 bg-territory-500/10 text-territory-400'
                      : 'border-ground-700 text-ground-300 hover:border-ground-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => resolve('regenerate')}
              className="mt-3 w-full rounded-md bg-territory-500 px-4 py-2 text-sm font-semibold text-ground-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Working…' : 'Rebuild elsewhere'}
            </button>
          </div>

          <div className="rounded-lg border border-ground-700 bg-ground-950/60 p-4">
            <p className="font-display text-sm font-semibold text-ground-100">Leave it, fight to reclaim</p>
            <p className="mt-1 text-xs leading-relaxed text-ground-300">
              Do nothing for now. The piece stays {current.invaderName}'s territory — the only way
              to get it back is to invade it, same as any other territory.
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => resolve('reclaim')}
              className="mt-3 w-full rounded-md border border-ground-700 bg-ground-900 px-4 py-2 text-sm font-medium text-ground-100 transition-colors hover:bg-ground-800 disabled:opacity-50"
            >
              {submitting ? 'Working…' : 'Leave it for now'}
            </button>
          </div>
        </div>

        {pendingSplits.length > 1 && (
          <p className="mt-4 text-center text-xs text-ground-500">
            {pendingSplits.length - 1} more decision{pendingSplits.length - 1 === 1 ? '' : 's'} waiting after this one
          </p>
        )}
      </div>
    </div>
  )
}
