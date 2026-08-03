import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const SCOPES = [
  { value: 'friends', label: 'Friends' },
  { value: 'regional', label: 'Regional' },
]
const PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

async function fetchLeaderboard({ scope, period, region }) {
  const url = new URL(`${API_BASE_URL}/leaderboard`)
  url.searchParams.set('scope', scope)
  url.searchParams.set('period', period)
  if (region) url.searchParams.set('region', region)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to load leaderboard (${res.status})`)
  }
  return res.json()
}

export default function Leaderboard() {
  // ⚠️ INTEGRATION ASSUMPTION: assumes useAuth()'s `user` object has
  // `region` and either `_id` or `id`. NavBar.jsx only confirms `.name` and
  // `.preferredColor` exist on it — double-check these two field names
  // against your actual AuthContext and adjust the two lines below if they
  // differ.
  const { user } = useAuth()
  const currentUserId = user?._id || user?.id

  const [scope, setScope] = useState('friends')
  const [period, setPeriod] = useState('weekly')
  const [region, setRegion] = useState(user?.region || '')
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState(null)

  const load = useCallback(() => {
    if (scope === 'regional' && !region.trim()) {
      setRows([])
      setStatus('ready')
      return
    }

    setStatus('loading')
    setErrorMessage(null)

    fetchLeaderboard({ scope, period, region: scope === 'regional' ? region.trim() : undefined })
      .then((data) => {
        setRows(data.leaderboard || [])
        setStatus('ready')
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err.message)
      })
  }, [scope, period, region])

  useEffect(() => {
    load()
  }, [load])

  const showRegionPrompt = status === 'ready' && scope === 'regional' && !region.trim()

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ground-100 sm:text-3xl">Leaderboard</h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-ground-700">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setScope(s.value)}
              aria-pressed={scope === s.value}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                scope === s.value
                  ? 'bg-territory-500 text-ground-950'
                  : 'bg-ground-900 text-ground-300 hover:bg-ground-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex overflow-hidden rounded-md border border-ground-700">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-territory-500 text-ground-950'
                  : 'bg-ground-900 text-ground-300 hover:bg-ground-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {scope === 'regional' && (
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region (e.g. Haryana)"
            className="field-input mt-0 w-48"
          />
        )}
      </div>

      {scope === 'friends' && (
        <p className="mt-3 text-xs text-ground-500">
          Friends leaderboard is a placeholder showing all users until Phase 9's follow graph exists.
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-ground-800">
        {status === 'loading' && <p className="px-4 py-6 text-center text-sm text-ground-300">Loading…</p>}

        {status === 'error' && (
          <div className="px-4 py-6 text-center text-sm text-invasion-500">
            <p>{errorMessage}</p>
            <button type="button" onClick={load} className="btn-secondary mt-2 px-3 py-1 text-xs">
              Retry
            </button>
          </div>
        )}

        {showRegionPrompt && (
          <p className="px-4 py-6 text-center text-sm text-ground-300">
            Enter a region above to see its leaderboard.
          </p>
        )}

        {status === 'ready' && !showRegionPrompt && rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-ground-300">No Calons earned here yet.</p>
        )}

        {status === 'ready' && !showRegionPrompt && rows.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="bg-ground-900 text-xs uppercase tracking-wide text-ground-500">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Calons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ground-800">
              {rows.map((row) => (
                <tr key={row.userId} className={row.userId === currentUserId ? 'bg-territory-500/10' : undefined}>
                  <td className="px-4 py-3 text-ground-300">{row.rank}</td>
                  <td className="px-4 py-3 font-medium text-ground-100">
                    {row.name}
                    {row.userId === currentUserId && <span className="ml-2 text-xs text-territory-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-ground-100">{Math.round(row.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
