import { io } from 'socket.io-client'

/**
 * ⚠️ INTEGRATION ASSUMPTION: derives the Socket.io URL by stripping a
 * trailing "/api" off VITE_API_BASE_URL (see frontend/.env.example —
 * VITE_API_BASE_URL=http://localhost:5000/api). Socket.io needs the bare
 * server origin, not the REST API prefix, since it attaches its own
 * "/socket.io" path directly on the http.Server (see
 * backend/src/sockets/index.js — same server/port as Express, no separate
 * socket port to configure).
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '')

let socket = null

/**
 * One shared socket for the whole Chat tab's lifetime (not one per open
 * thread — ChatThread only joins/leaves conversation ROOMS on an existing
 * connection, see ChatThread.jsx). Reconnecting with a NEW token (e.g.
 * after Phase 1's access-token refresh) replaces the old connection rather
 * than trying to mutate handshake auth on a live socket, which Socket.io
 * doesn't support.
 */
export function getSocket(accessToken) {
  if (socket && socket.connected) return socket
  if (socket) socket.disconnect()

  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    autoConnect: true,
    transports: ['websocket', 'polling'],
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
