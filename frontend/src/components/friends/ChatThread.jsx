import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getThread } from '../../lib/socialApi.js'

/**
 * One open conversation: history (loaded once via REST — see
 * messageController.js's getThread) plus live messages delivered over the
 * shared socket passed down from ChatTab, plus the send box.
 *
 * `mutual` (computed in ChatTab from the /api/friends list) gates the call
 * button per the Phase 9 spec — voice/video itself isn't implemented until
 * Phase 12, this just wires up the disabled state + tooltip now so the UI
 * doesn't need revisiting when that phase lands.
 */
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
    if (seenIds.current.has(id)) return
    seenIds.current.add(id)
    setMessages((prev) => [...prev, msg])
  }

  // Load history + join the socket room whenever the selected conversation
  // changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setSendError(null)
    seenIds.current = new Set()

    getThread(otherUser.id)
      .then(({ messages: history }) => {
        if (cancelled) return
        history.forEach((m) => seenIds.current.add(m._id?.toString?.() || m._id))
        setMessages(history)
        setError(null)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))

    socket.emit('conversation:join', { otherUserId: otherUser.id })

    function handleNew(msg) {
      const senderId = msg.senderId?.toString?.() || msg.senderId
      const belongsHere = senderId === otherUser.id || senderId === myId
      if (belongsHere) addMessage(msg)
    }
    socket.on('message:new', handleNew)

    return () => {
      cancelled = true
      socket.emit('conversation:leave', { otherUserId: otherUser.id })
      socket.off('message:new', handleNew)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUser.id, socket])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function handleSend(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return

    socket.emit('message:send', { otherUserId: otherUser.id, content }, (ack) => {
      setSendError(ack?.ok ? null : ack?.error || 'Failed to send message.')
    })
    setDraft('')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-ground-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-8 flex-none rounded-full border border-ground-700"
            style={{ backgroundColor: otherUser.preferredColor || '#3B82F6' }}
          />
          <p className="text-sm font-medium text-ground-100">{otherUser.name}</p>
        </div>

        <div className="group relative">
          <button
            type="button"
            disabled={!mutual}
            title={mutual ? 'Start a call' : 'Requires a mutual friendship'}
            className="rounded-md border border-ground-700 px-3 py-1.5 text-xs font-medium text-ground-300 transition-colors enabled:hover:bg-ground-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            📞 Call
          </button>
          {!mutual && (
            <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-48 rounded-md border border-ground-700 bg-ground-900 p-2 text-xs text-ground-300 shadow-lg group-hover:block">
              Voice/video calls need a mutual follow — you both need to follow each other.
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading && <p className="text-sm text-ground-500">Loading messages…</p>}
        {error && <p className="text-sm text-invasion-500">{error}</p>}
        {!loading && messages.length === 0 && !error && (
          <p className="text-sm text-ground-500">No messages yet — say hi!</p>
        )}
        {messages.map((m) => {
          const senderId = m.senderId?.toString?.() || m.senderId
          const mine = senderId === myId
          return (
            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  mine ? 'bg-territory-500 text-ground-950' : 'bg-ground-800 text-ground-100'
                }`}
              >
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-ground-800 p-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${otherUser.name}…`}
          className="flex-1 rounded-md border border-ground-700 bg-ground-900 px-3 py-2 text-sm text-ground-100 placeholder:text-ground-500 focus:border-territory-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-territory-500 px-4 py-2 text-sm font-semibold text-ground-950 transition-opacity hover:opacity-90"
        >
          Send
        </button>
      </form>
      {sendError && <p className="px-4 pb-2 text-xs text-invasion-500">{sendError}</p>}
    </div>
  )
}
