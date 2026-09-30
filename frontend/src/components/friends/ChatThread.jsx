import { useEffect, useRef, useState } from 'react'
import { Phone, Send, Smile, Video } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getThread } from '../../lib/socialApi.js'

function RunnerAvatar({ user }) {
  const initials =
    user?.name?.trim()?.charAt(0)?.toUpperCase() || '?'

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
      className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 border-white text-[12px] font-black text-white shadow-[0_2px_6px_rgba(40,45,55,0.14)]"
      style={{
        backgroundColor: user?.preferredColor || '#55d9d0',
      }}
    >
      {initials}
    </span>
  )
}

export default function ChatThread({ socket, otherUser, mutual }) {
  const { user } = useAuth()
  const myId = (user?.id || user?._id)?.toString()

  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sendError, setSendError] = useState(null)
  const bottomRef = useRef(null)
  const seenIds = useRef(new Set())

  function addMessage(msg) {
    const id = msg._id?.toString?.() || msg._id

    if (seenIds.current.has(id)) {
      return
    }

    seenIds.current.add(id)
    setMessages((prev) => [...prev, msg])
  }

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setMessages([])
    setSendError(null)
    seenIds.current = new Set()

    getThread(otherUser.id)
      .then(({ messages: history }) => {
        if (cancelled) {
          return
        }

        history.forEach((m) => {
          seenIds.current.add(
            m._id?.toString?.() || m._id,
          )
        })

        setMessages(history)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    socket.emit('conversation:join', {
      otherUserId: otherUser.id,
    })

    function handleNew(msg) {
      const senderId =
        msg.senderId?.toString?.() || msg.senderId

      const belongsHere =
        senderId === otherUser.id || senderId === myId

      if (belongsHere) {
        addMessage(msg)
      }
    }

    socket.on('message:new', handleNew)

    return () => {
      cancelled = true

      socket.emit('conversation:leave', {
        otherUserId: otherUser.id,
      })

      socket.off('message:new', handleNew)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUser.id, socket])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages.length])

  function handleSend(e) {
    e.preventDefault()

    const content = draft.trim()

    if (!content) {
      return
    }

    socket.emit(
      'message:send',
      {
        otherUserId: otherUser.id,
        content,
      },
      (ack) => {
        setSendError(
          ack?.ok
            ? null
            : ack?.error || 'Failed to send message.',
        )
      },
    )

    setDraft('')
  }

  return (
    <div className="flex h-full flex-col bg-[#FCF6E9]">
      <header className="flex items-center justify-between border-b border-[#ece7df] px-4 py-3">
        <div className="flex items-center gap-3">
          <RunnerAvatar user={otherUser} />

          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-bold text-[#161a20]">
              {otherUser.name}
            </p>

            <p className="flex items-center gap-1 text-[11px] font-semibold text-[#8bb928]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b8ee18]" />
              Online
            </p>
          </div>
        </div>

        <div className="group relative flex items-center gap-2">
          <button
            type="button"
            disabled={!mutual}
            title={
              mutual
                ? 'Voice call'
                : 'Requires a mutual friendship'
            }
            className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#eafaC4] text-[#86aa20] transition-transform enabled:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Phone
              className="h-[18px] w-[18px]"
              fill="currentColor"
            />
          </button>

          <button
            type="button"
            disabled={!mutual}
            title={
              mutual
                ? 'Video call'
                : 'Requires a mutual friendship'
            }
            className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#ffdce9] text-[#e54c87] transition-transform enabled:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Video
              className="h-[18px] w-[18px]"
              fill="currentColor"
            />
          </button>

          {!mutual && (
            <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-48 rounded-xl bg-white p-2 text-[11px] leading-snug text-[#666d79] shadow-[0_10px_24px_rgba(20,22,31,0.15)] group-hover:block">
              Voice/video calls need a mutual follow — you
              both need to follow each other.
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading && (
          <p className="text-[12px] font-medium text-[#8b92a0]">
            Loading messages…
          </p>
        )}

        {error && (
          <p className="text-[12px] font-semibold text-[#b43f68]">
            {error}
          </p>
        )}

        {!loading &&
          messages.length === 0 &&
          !error && (
            <p className="text-[12px] font-medium text-[#8b92a0]">
              No messages yet — say hi!
            </p>
          )}

        {messages.map((m) => {
          const senderId =
            m.senderId?.toString?.() || m.senderId

          const mine = senderId === myId

          return (
            <div
              key={m._id}
              className={`flex ${
                mine ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[75%] rounded-[17px] px-3.5 py-2 text-[13px] font-medium leading-snug shadow-[0_2px_5px_rgba(50,55,65,0.04)] ${
                  mine
                    ? 'bg-[#bdf21f] text-[#18200f]'
                    : 'bg-[#eef0f5] text-[#252a31]'
                }`}
              >
                {m.content}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-[#ece7df] p-3"
      >
        <Smile className="ml-0.5 h-[20px] w-[20px] flex-none text-[#ff9b45]" />

        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${otherUser.name}…`}
          className="h-10 min-w-0 flex-1 rounded-full border border-[#e5e6eb] bg-[#f0f1f5] px-4 text-[13px] text-[#252a31] placeholder:text-[#9aa0ab] focus:border-[#b6dc47] focus:bg-white focus:outline-none"
        />

        <button
          type="submit"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] bg-[#bdf21f] text-[#18200f] shadow-[0_3px_8px_rgba(121,160,16,0.18)] transition-transform hover:scale-105"
          aria-label="Send message"
        >
          <Send
            className="h-[18px] w-[18px]"
            fill="currentColor"
          />
        </button>
      </form>

      {sendError && (
        <p className="px-4 pb-2 text-[11px] font-semibold text-[#b43f68]">
          {sendError}
        </p>
      )}
    </div>
  )
}