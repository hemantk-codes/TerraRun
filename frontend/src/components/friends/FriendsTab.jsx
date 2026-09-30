import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { searchUsers, followUser, unfollowUser } from '../../lib/socialApi.js'

const FOLLOW_BUTTON_LABEL = {
  none: 'Follow',
  'followed-by': 'Follow back',
}

const STATUS_META = {
  mutual: { label: 'Friends', className: 'bg-[#dff7bf] text-[#5e8d12]' },
  following: { label: 'Following', className: 'bg-[#eef1f5] text-[#72798a]' },
  'followed-by': { label: 'Follows you', className: 'bg-[#ffe0ec] text-[#bf3a69]' },
  none: { label: 'Not connected', className: 'bg-[#eef1f5] text-[#8790a0]' },
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.none
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function RunnerAvatar({ user }) {
  const initials = user?.name?.trim()?.charAt(0)?.toUpperCase() || '?'

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`${user.name || 'Runner'} avatar`}
        className="h-10 w-10 flex-none rounded-full border-2 border-white object-cover shadow-[0_2px_6px_rgba(40,45,55,0.14)]"
      />
    )
  }

  return (
    <span
      className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 border-white text-sm font-black text-white shadow-[0_2px_6px_rgba(40,45,55,0.14)]"
      style={{ backgroundColor: user?.preferredColor || '#17D6D6' }}
    >
      {initials}
    </span>
  )
}

export default function FriendsTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setError(null)
      setLoading(false)
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
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#9ba2ad]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search friends..."
          className="h-[46px] w-full rounded-[13px] border border-[#dedfe3] bg-white/90 pl-11 pr-4 text-[13px] font-medium text-[#252a31] shadow-[0_4px_12px_rgba(44,50,63,0.05)] outline-none placeholder:text-[#a0a5af] focus:border-[#b8dc4b] focus:ring-4 focus:ring-[#c6f135]/20"
        />
      </div>

      {error && (
        <p className="rounded-[14px] border border-[#f3bfd3] bg-[#fff2f7] px-4 py-3 text-[12px] font-semibold text-[#a33d60] shadow-[0_4px_12px_rgba(44,50,63,0.05)]">
          {error}
        </p>
      )}

      {loading && <p className="px-1 text-[12px] font-semibold text-[#8b92a0]">Searching…</p>}

      {!loading && query.trim() && results.length === 0 && !error && (
        <p className="px-1 text-[12px] font-semibold text-[#8b92a0]">
          No runners found for “{query.trim()}”.
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {results.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-3 rounded-[16px] border border-white/80 bg-white/95 px-3.5 py-3 shadow-[0_6px_18px_rgba(44,50,63,0.08)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <RunnerAvatar user={u} />
              <div className="min-w-0">
                <p className="truncate font-display text-[13px] font-bold text-[#171a1f]">{u.name}</p>
                {u.region && <p className="truncate text-[11px] font-medium text-[#8a919e]">{u.region}</p>}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <StatusPill status={u.status} />
              {u.status === 'following' || u.status === 'mutual' ? (
                <button
                  type="button"
                  disabled={pendingId === u.id}
                  onClick={() => handleUnfollow(u.id)}
                  className="rounded-full bg-[#eef1f5] px-3 py-1.5 text-[11px] font-bold text-[#697180] transition-transform hover:scale-[1.03] disabled:opacity-50"
                >
                  {u.status === 'mutual' ? 'Unfriend' : 'Unfollow'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pendingId === u.id}
                  onClick={() => handleFollow(u.id)}
                  className="rounded-full bg-[#c6f135] px-3 py-1.5 text-[11px] font-extrabold text-[#18220f] shadow-[0_3px_8px_rgba(121,160,16,0.18)] transition-transform hover:scale-[1.03] disabled:opacity-50"
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
