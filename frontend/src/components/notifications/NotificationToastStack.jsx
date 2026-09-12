import { useNotifications } from '../../context/NotificationsContext.jsx'
import { formatNotification } from '../../utils/notificationFormat.js'

/**
 * PHASE 10 — the "live toast pop-up while the app is open" half of the
 * spec. Mounted once, near the app root (see App.jsx), fixed to a corner
 * so it floats above whatever page is currently showing.
 */
export default function NotificationToastStack() {
  const { toasts, dismissToast, markRead } = useNotifications()

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[3000] flex w-80 flex-col gap-2">
      {toasts.map((n) => {
        const { title, body } = formatNotification(n)
        return (
          <div
            key={n._id}
            className="pointer-events-auto rounded-lg border border-ground-700 bg-ground-900 p-3 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ground-100">{title}</p>
              <button
                type="button"
                onClick={() => dismissToast(n._id)}
                aria-label="Dismiss"
                className="text-ground-500 hover:text-ground-100"
              >
                ×
              </button>
            </div>
            {body && <p className="mt-1 text-xs text-ground-300">{body}</p>}
            <button
              type="button"
              onClick={() => {
                markRead(n._id)
                dismissToast(n._id)
              }}
              className="mt-2 text-xs font-medium text-territory-400 hover:text-territory-500"
            >
              Mark read
            </button>
          </div>
        )
      })}
    </div>
  )
}
