import { useEffect, useState } from 'react'
import { searchUsers, followUser, unfollowUser } from '../../lib/socialApi.js'

const FOLLOW_BUTTON_LABEL = {
  none: 'Follow',
  'followed-by': 'Follow back',
}

const STATUS_META = {
  mutual: { label: 'Friends', className: 'border-territory-500 text-territory-400' },
  following: { label: 'Following', className: 'border-ground-700 text-ground-300' },
  'followed-by': { label: 'Follows you', className: 'border-invasion-500 text-invasion-500' },
  none: { label: 'Not connected', className: 'border-ground-700 text-ground-500' },
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.none
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function FriendsTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  // Debounce the search box — fires ~350ms after typing stops rather than
  // hitting the API on every keystroke.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setError(null)
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const { users } = await searchUsers(q)
        setResults(users)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [query])

  async function handleFollow(userId) {
    setPendingId(userId)
    try {
      const { status } = await followUser(userId)
      setResults((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)))
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingId(null)
    }
  }

  async function handleUnfollow(userId) {
    setPendingId(userId)
    try {
      const { status } = await unfollowUser(userId)
      setResults((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)))
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search runners by name…"
        className="w-full rounded-md border border-ground-700 bg-ground-900 px-4 py-2 text-sm text-ground-100 placeholder:text-ground-500 focus:border-territory-500 focus:outline-none"
      />

      {error && <p className="text-sm text-invasion-500">{error}</p>}
      {loading && <p className="text-sm text-ground-500">Searching…</p>}
      {!loading && query.trim() && results.length === 0 && !error && (
        <p className="text-sm text-ground-500">No runners found for &ldquo;{query.trim()}&rdquo;.</p>
      )}

      <ul className="flex flex-col divide-y divide-ground-800">
        {results.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <span
                className="h-8 w-8 flex-none rounded-full border border-ground-700"
                style={{ backgroundColor: u.preferredColor || '#3B82F6' }}
              />
              <div>
                <p className="text-sm font-medium text-ground-100">{u.name}</p>
                {u.region && <p className="text-xs text-ground-500">{u.region}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusPill status={u.status} />
              {u.status === 'following' || u.status === 'mutual' ? (
                <button
                  type="button"
                  disabled={pendingId === u.id}
                  onClick={() => handleUnfollow(u.id)}
                  className="rounded-md border border-ground-700 px-3 py-1.5 text-xs font-medium text-ground-300 transition-colors hover:bg-ground-900 disabled:opacity-50"
                >
                  {u.status === 'mutual' ? 'Unfriend' : 'Unfollow'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pendingId === u.id}
                  onClick={() => handleFollow(u.id)}
                  className="rounded-md bg-territory-500 px-3 py-1.5 text-xs font-semibold text-ground-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {FOLLOW_BUTTON_LABEL[u.status] || 'Follow'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
