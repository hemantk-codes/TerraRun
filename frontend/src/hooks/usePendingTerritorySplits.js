import { useCallback, useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// ⚠️ INTEGRATION ASSUMPTION: Phase 1's actual auth files weren't in this
// session's context, so this is a placeholder for however your real
// AuthContext exposes the current JWT access token. Swap this out for
// whatever that is (e.g. `useAuth().accessToken`) — this file just needs
// SOME string to send as a Bearer token to a route that requires auth.
function getAccessToken() {
  return localStorage.getItem('accessToken')
}

/**
 * PHASE 7 — polls GET /api/territories/pending-splits once on mount (i.e.
 * "next login/page-load", per the phase prompt) and exposes the result as a
 * queue. Stands in for the real Phase 10 notification feed, which doesn't
 * exist yet — this hook is the thing Phase 10 should eventually replace
 * with a live socket-pushed list instead of a one-shot fetch.
 *
 * Tolerates being called while logged out (the Map page is reachable
 * without auth — see App.jsx) by treating "no token" as "nothing pending"
 * rather than an error.
 */
export function usePendingTerritorySplits() {
  const [pendingSplits, setPendingSplits] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'

  const refetch = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setPendingSplits([])
      setStatus('ready')
      return
    }

    setStatus('loading')
    try {
      const res = await fetch(`${API_BASE_URL}/territories/pending-splits`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to check for pending territory splits (${res.status})`)
      }
      const data = await res.json()
      setPendingSplits(data.pendingSplits || [])
      setStatus('ready')
    } catch (err) {
      // Fails soft — a broken pending-splits check shouldn't block the rest
      // of the app from rendering, it just means the modal won't show up
      // until the next successful refetch.
      console.error('[usePendingTerritorySplits]', err)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Called by the modal right after a successful resolve-split call, so the
  // resolved item drops out of the queue immediately (moving to the next
  // one, if any) without waiting on a full refetch round-trip. This is also
  // what keeps the modal from being able to re-show itself for the same
  // territory — see the integration checklist item about that.
  const dismiss = useCallback((territoryId) => {
    setPendingSplits((prev) => prev.filter((p) => String(p.territoryId) !== String(territoryId)))
  }, [])

  return { pendingSplits, status, refetch, dismiss }
}
