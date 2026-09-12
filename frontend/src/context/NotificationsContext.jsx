import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useSocket } from './SocketContext.jsx'
import {
  listNotifications as apiListNotifications,
  markNotificationRead as apiMarkNotificationRead,
  markAllNotificationsRead as apiMarkAllNotificationsRead,
} from '../lib/notificationsApi.js'

const NotificationsContext = createContext(null)

// Tunable — how long a toast stays on screen before auto-dismissing.
const TOAST_AUTO_DISMISS_MS = 6000

export function NotificationsProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const socket = useSocket()

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [toasts, setToasts] = useState([])
  const seenIds = useRef(new Set())

  const refresh = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await apiListNotifications()
      seenIds.current = new Set(data.notifications.map((n) => n._id))
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
      setStatus('ready')
    } catch (err) {
      console.error('[notifications] Failed to load:', err)
      setStatus('error')
    }
  }, [])

  // Load once per login; reset everything on logout so a second user
  // signing in on the same tab doesn't briefly see the previous user's list.
  useEffect(() => {
    if (isAuthenticated) {
      refresh()
    } else {
      setNotifications([])
      setUnreadCount(0)
      setToasts([])
      seenIds.current = new Set()
      setStatus('idle')
    }
  }, [isAuthenticated, refresh])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t._id !== id))
  }, [])

  // Live delivery — the "toast pop-up while the app is open" half of the
  // spec. `notification:new` carries the same shape as a row from
  // GET /api/notifications (see notificationService.js), so it can be
  // prepended directly without a refetch.
  useEffect(() => {
    if (!socket) return

    function handleNew(notification) {
      // Cheap client-side insurance against double-toasting if the same
      // event somehow arrived twice (e.g. a reconnect replay) — notify()
      // itself only ever emits once per DB write.
      if (seenIds.current.has(notification._id)) return
      seenIds.current.add(notification._id)

      setNotifications((prev) => [notification, ...prev])
      setUnreadCount((prev) => prev + 1)
      setToasts((prev) => [...prev, notification])
      setTimeout(() => dismissToast(notification._id), TOAST_AUTO_DISMISS_MS)
    }

    socket.on('notification:new', handleNew)
    return () => socket.off('notification:new', handleNew)
  }, [socket, dismissToast])

  const markRead = useCallback(
    async (id) => {
      const target = notifications.find((n) => n._id === id)
      const wasUnread = Boolean(target && !target.read)

      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1))

      try {
        await apiMarkNotificationRead(id)
      } catch (err) {
        console.error('[notifications] Failed to mark read:', err)
      }
    },
    [notifications]
  )

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await apiMarkAllNotificationsRead()
    } catch (err) {
      console.error('[notifications] Failed to mark all read:', err)
    }
  }, [])

  const value = { notifications, unreadCount, status, refresh, markRead, markAllRead, toasts, dismissToast }

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return ctx
}
