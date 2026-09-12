import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { getSocket, disconnectSocket } from '../lib/socket.js'

/**
 * PHASE 10 — promotes the Socket.io connection from "something ChatTab
 * owns while it's mounted" (Phase 9) to an app-wide singleton owned here
 * for the whole time the user is authenticated. Notifications need this
 * connection alive on every page — not just while Friends & Chat happens
 * to be open — for the bell badge and toasts to work app-wide.
 *
 * frontend/src/components/friends/ChatTab.jsx is updated to read the
 * socket from this context instead of calling
 * getSocket()/disconnectSocket() itself — it no longer owns the
 * connection's lifecycle, just uses it. lib/socket.js itself is
 * unchanged; this is now the one place that calls it.
 *
 * Inherited behavior from Phase 9 worth knowing: since the access token
 * rotates on every silent refresh (~15min, see AuthContext/api.js), this
 * effect's `accessToken` dependency changes that often too, so the socket
 * briefly reconnects with the new token roughly every 15 minutes. That's
 * the same characteristic ChatTab's own connection already had before
 * this phase — not something new introduced here.
 */
const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { accessToken, isAuthenticated } = useAuth()
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket()
      setSocket(null)
      return
    }
    const s = getSocket(accessToken)
    setSocket(s)

    return () => {
      disconnectSocket()
    }
  }, [accessToken, isAuthenticated])

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

export function useSocket() {
  return useContext(SocketContext)
}
