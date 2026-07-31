import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { COUNTRIES, STATES_BY_COUNTRY } from '../data/regions.js'

// Best-effort split of the single `region` string back into country/state
// for the dropdowns. Region is stored as "State, Country" (or just
// "Country" if the country has no state list) — see data/regions.js for why
// it isn't structured fields yet.
function splitRegion(region) {
  if (!region) return { country: '', state: '' }
  const parts = region.split(',').map((p) => p.trim())
  if (parts.length === 1) return { country: parts[0], state: '' }
  return { state: parts[0], country: parts[1] }
}

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const initialRegion = splitRegion(user?.region)

  const [name, setName] = useState(user?.name || '')
  const [bodyWeightKg, setBodyWeightKg] = useState(user?.bodyWeightKg ?? '')
  const [heightCm, setHeightCm] = useState(user?.heightCm ?? '')
  const [country, setCountry] = useState(initialRegion.country)
  const [state, setState] = useState(initialRegion.state)
  const [preferredColor, setPreferredColor] = useState(user?.preferredColor || '#3B82F6')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  const stateOptions = STATES_BY_COUNTRY[country]

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setBusy(true)
    try {
      const region = state ? `${state}, ${country}` : country

      await updateProfile({
        name,
        bodyWeightKg: bodyWeightKg === '' ? undefined : Number(bodyWeightKg),
        heightCm: heightCm === '' ? undefined : Number(heightCm),
        region: region || undefined,
        preferredColor,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null // ProtectedRoute keeps this page from rendering while logged out

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-ground-100">Your profile</h1>
        <p className="mt-2 text-sm text-ground-300">
          Body weight and elevation feed the calorie engine (Phase 2) — your territory color is how the map
          tells you apart from everyone else.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form-card flex flex-col gap-4">
        {error && <p className="form-error">{error}</p>}
        {success && (
          <p className="rounded-md border border-territory-500/40 bg-territory-500/10 px-3 py-2 text-sm text-territory-400">
            Profile saved.
          </p>
        )}

        <div>
          <label className="field-label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="bodyWeightKg">
              Body weight (kg)
            </label>
            <input
              id="bodyWeightKg"
              type="number"
              min="20"
              max="400"
              step="0.1"
              className="field-input"
              value={bodyWeightKg}
              onChange={(e) => setBodyWeightKg(e.target.value)}
              placeholder="70"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="heightCm">
              Height (cm)
            </label>
            <input
              id="heightCm"
              type="number"
              min="50"
              max="300"
              step="0.1"
              className="field-input"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="175"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="country">
              Country
            </label>
            <select
              id="country"
              className="field-input"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value)
                setState('') // country changed — the old state selection no longer applies
              }}
            >
              <option value="">Select…</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="state">
              State / Province
            </label>
            {stateOptions ? (
              <select id="state" className="field-input" value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Select…</option>
                {stateOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="state"
                className="field-input"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Optional"
              />
            )}
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="preferredColor">
            Territory color
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              id="preferredColor"
              type="color"
              className="h-10 w-14 cursor-pointer rounded-md border border-ground-700 bg-ground-900"
              value={preferredColor}
              onChange={(e) => setPreferredColor(e.target.value)}
            />
            <input
              type="text"
              className="field-input mt-0 flex-1"
              value={preferredColor}
              onChange={(e) => setPreferredColor(e.target.value)}
              placeholder="#3B82F6"
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  )
}
