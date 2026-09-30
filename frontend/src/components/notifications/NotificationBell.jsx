import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Castle,
  Swords,
  UserPlus,
  Trophy,
  ShieldAlert,
  Crown,
  MessageCircle,
  Split,
  Zap,
  ChevronRight,
  CheckCheck,
} from 'lucide-react'
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

function getNotificationVisual(type) {
  switch (type) {
    case 'territory_fully_decayed':
      return {
        icon: Castle,
        color: '#ff4b8b',
        iconBg: '#ffd5e5',
        stripe: '#ff4b8b',
      }

    case 'territory_invaded':
    case 'territory_under_siege':
      return {
        icon: ShieldAlert,
        color: '#ff4b8b',
        iconBg: '#ffd5e5',
        stripe: '#ff4b8b',
      }

    case 'invasion_succeeded':
      return {
        icon: Crown,
        color: '#7fe600',
        iconBg: '#dfff9b',
        stripe: '#a6ff00',
      }

    case 'friend_request':
      return {
        icon: UserPlus,
        color: '#13bce8',
        iconBg: '#c9f7ff',
        stripe: '#19c4ec',
      }

    case 'leaderboard_overtaken':
      return {
        icon: Trophy,
        color: '#ff9b17',
        iconBg: '#ffe1a9',
        stripe: '#ff9d1c',
      }

    case 'chat_message_received':
      return {
        icon: MessageCircle,
        color: '#13bce8',
        iconBg: '#c9f7ff',
        stripe: '#19c4ec',
      }

    case 'territory_split':
      return {
        icon: Split,
        color: '#8d6cff',
        iconBg: '#e0d8ff',
        stripe: '#8d6cff',
      }

    case 'streak_stopper_earned':
      return {
        icon: Zap,
        color: '#ff9b17',
        iconBg: '#ffe1a9',
        stripe: '#ff9d1c',
      }

    case 'decay_warning':
      return {
        icon: Swords,
        color: '#ff4b8b',
        iconBg: '#ffd5e5',
        stripe: '#ff4b8b',
      }

    default:
      return {
        icon: Bell,
        color: '#13bce8',
        iconBg: '#c9f7ff',
        stripe: '#19c4ec',
      }
  }
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    status,
  } = useNotifications()

  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)

    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative flex-shrink-0">

      {/* Notification Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative bg-[#f0ece1] w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shadow-[0px_3px_0px_0px_#dfdacf] hover:translate-y-[1px] hover:shadow-[0px_2px_0px_0px_#dfdacf] active:translate-y-[3px] active:shadow-none transition-all select-none"
      >
        <Bell
          className="w-[18px] h-[18px] text-[#1a1a1a] fill-[#1a1a1a] mt-[2px]"
        />

        {unreadCount > 0 && (
          <span className="absolute -top-[5px] -right-[5px] min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff4b8b] text-white border-[2px] border-[#FAF8F4] flex items-center justify-center text-[9px] font-black shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {open && (
        <div
          className="
            absolute
            right-0
            top-full
            mt-3
            z-[1000]
            w-[430px]
            max-w-[calc(100vw-24px)]
            overflow-hidden
            rounded-[22px]
            border-[3px]
            border-[#1a1a1a]
            bg-[#f8f1df]
            shadow-[8px_10px_0px_rgba(20,20,20,0.14),0_24px_45px_rgba(0,0,0,0.20)]
          "
        >

          {/* Small top pointer */}
          <div className="absolute -top-[10px] right-[24px] w-[18px] h-[18px] bg-[#f8f1df] border-l-[3px] border-t-[3px] border-[#1a1a1a] rotate-45" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 py-4 bg-[#fffaf0] border-b-[2px] border-[#dfd5c0]">

            <div className="flex items-center gap-3">
              <div className="w-[34px] h-[34px] rounded-[11px] bg-[#ccff00] border-[2px] border-black flex items-center justify-center shadow-[2px_2px_0px_#111]">
                <Bell
                  className="w-[17px] h-[17px] text-black fill-black"
                />
              </div>

              <div>
                <p className="font-black text-[17px] leading-none text-[#171717]">
                  NOTIFICATIONS
                </p>

                <p className="mt-1 text-[10px] font-bold uppercase tracking-[1px] text-[#77705f]">
                  {unreadCount > 0
                    ? `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}`
                    : 'You are all caught up'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="
                  flex
                  items-center
                  gap-1.5
                  rounded-[10px]
                  bg-[#e9e4d6]
                  border-[2px]
                  border-[#d4cdbd]
                  px-3
                  py-2
                  text-[10px]
                  font-black
                  uppercase
                  tracking-[0.5px]
                  text-[#171717]
                  shadow-[0_2px_0px_#cfc6b3]
                  hover:bg-[#ddd7c8]
                  hover:translate-y-[1px]
                  active:translate-y-[2px]
                  active:shadow-none
                  transition-all
                "
              >
                <CheckCheck className="w-[14px] h-[14px]" />
                Read all
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="max-h-[520px] overflow-y-auto px-3 py-3 bg-[#f5eddc]">

            {status === 'loading' && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-[4px] border-[#d7cfbd] border-t-[#ccff00] animate-spin" />
                  <p className="text-sm font-bold text-[#77705f]">
                    Loading notifications...
                  </p>
                </div>
              </div>
            )}

            {status === 'ready' && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">

                <div className="w-[70px] h-[70px] rounded-[20px] bg-[#e7dfcf] border-[2px] border-[#d5cbb9] flex items-center justify-center shadow-[0_5px_0px_#cbc1ad]">
                  <Bell className="w-8 h-8 text-[#8e887b]" />
                </div>

                <p className="mt-4 text-[16px] font-black text-[#33302b]">
                  You&apos;re all caught up
                </p>

                <p className="mt-1 text-[12px] font-semibold text-[#8c8679]">
                  New territory events, follows, and activity alerts will appear here.
                </p>
              </div>
            )}

            {notifications.map((n) => {
              const { title, body } = formatNotification(n)
              const visual = getNotificationVisual(n.type)
              const Icon = visual.icon

              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => {
                    if (!n.read) {
                      markRead(n._id)
                    }
                  }}
                  className={`
                    group
                    relative
                    flex
                    w-full
                    items-center
                    gap-3
                    mb-3
                    overflow-hidden
                    rounded-[18px]
                    border-[2px]
                    border-[#ded4c0]
                    bg-[#fffaf0]
                    px-3
                    py-3
                    text-left
                    shadow-[0_5px_0px_#d8ceba]
                    transition-all
                    hover:-translate-y-[1px]
                    hover:shadow-[0_7px_0px_#cec3ad]
                    active:translate-y-[2px]
                    active:shadow-[0_2px_0px_#cec3ad]
                    ${n.read ? 'opacity-65' : ''}
                  `}
                >

                  {/* Colored left stripe */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[7px]"
                    style={{ backgroundColor: visual.stripe }}
                  />

                  {/* Icon */}
                  <div
                    className="relative ml-1 flex h-[62px] w-[62px] flex-none items-center justify-center rounded-[16px] border-[2px] border-white shadow-[inset_0_-3px_0px_rgba(0,0,0,0.08),0_3px_6px_rgba(0,0,0,0.12)]"
                    style={{ backgroundColor: visual.iconBg }}
                  >
                    <div
                      className="absolute inset-x-2 bottom-1 h-[5px] rounded-full opacity-20"
                      style={{ backgroundColor: visual.color }}
                    />

                    <Icon
                      className="relative z-10 w-[31px] h-[31px]"
                      style={{
                        color: visual.color,
                        fill:
                          n.type === 'territory_fully_decayed'
                            ? visual.color
                            : 'none',
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 py-1">

                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[14px] font-black leading-tight text-[#171717]">
                        {title}
                      </p>

                      {!n.read && (
                        <span
                          className="mt-[3px] h-[11px] w-[11px] flex-none rounded-full border-[2px] border-white shadow-sm"
                          style={{ backgroundColor: visual.color }}
                        />
                      )}
                    </div>

                    {body && (
                      <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-[1.35] text-[#686255]">
                        {body}
                      </p>
                    )}

                    <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.4px] text-[#9a9282]">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#efe7d6] border-[1px] border-[#ded4c0] group-hover:bg-[#e4dbc8] transition-colors">
                    <ChevronRight className="w-[18px] h-[18px] text-[#6f685b]" />
                  </div>

                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}