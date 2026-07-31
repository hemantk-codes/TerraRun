const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// The access token lives in memory only (never localStorage/sessionStorage)
// — it's short-lived by design (Phase 1 spec: ~15min), so losing it on a
// full page reload is fine as long as we can silently re-mint one from the
// httpOnly refresh cookie, which AuthContext does on mount.
let accessToken = null
let onUnauthorized = null

export function setAccessToken(token) {
  accessToken = token
}

// AuthContext registers this so a request that fails even after a refresh
// attempt can clear the logged-in state app-wide.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

async function request(path, { method = 'GET', body, skipAuth = false, isRetry = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken && !skipAuth) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // sends/receives the httpOnly refresh cookie
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // No JSON body (e.g. some error responses) — fine, data stays null.
  }

  if (res.status === 401 && !skipAuth && !isRetry) {
    // Access token probably expired mid-session. Try one silent refresh,
    // then retry the original request exactly once.
    const refreshed = await refreshSession()
    if (refreshed) {
      return request(path, { method, body, skipAuth, isRetry: true })
    }
    onUnauthorized?.()
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  return data
}

export async function refreshSession() {
  try {
    const data = await request('/auth/refresh', { method: 'POST', skipAuth: true, isRetry: true })
    setAccessToken(data.accessToken)
    return data
  } catch {
    setAccessToken(null)
    return null
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
}
