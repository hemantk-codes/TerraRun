import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '../../context/NotificationsContext.jsx'
import { formatNotification } from '../../utils/notificationFormat.js'

function timeAgo(isoDate) {
  const ms = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, status } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-md border border-ground-700 p-2 text-ground-300 transition-colors hover:bg-ground-900 hover:text-ground-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2Zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z"
            fill="currentColor"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-invasion-500 px-1 text-[10px] font-bold leading-none text-ground-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-ground-700 bg-ground-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-ground-800 px-3 py-2">
            <p className="text-sm font-semibold text-ground-100">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-territory-400 hover:text-territory-500"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {status === 'loading' && <p className="px-3 py-6 text-center text-sm text-ground-500">Loading…</p>}
            {status === 'ready' && notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ground-500">You're all caught up.</p>
            )}
            {notifications.map((n) => {
              const { title, body } = formatNotification(n)
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => !n.read && markRead(n._id)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-ground-800 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-ground-800 ${
                    n.read ? 'opacity-60' : ''
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ground-100">{title}</span>
                    {!n.read && <span className="h-2 w-2 flex-none rounded-full bg-territory-400" />}
                  </span>
                  {body && <span className="text-xs text-ground-300">{body}</span>}
                  <span className="text-[11px] text-ground-500">{timeAgo(n.createdAt)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
