import { useEffect, useMemo, useState } from 'react'
import { useSocket } from '../../context/SocketContext.jsx' // Phase 10
import { listConversations, listFriends } from '../../lib/socialApi.js'
import ChatThread from './ChatThread.jsx'

/**
 * Chat tab: a left-hand list combining existing conversations and any
 * chattable contact you haven't messaged yet, plus the selected thread on
 * the right via ChatThread.
 *
 * PHASE 10 UPDATE: this component used to own the Socket.io connection's
 * whole lifecycle (connect on mount, disconnect on unmount). Notifications
 * (this phase) need that same connection alive on every page, not just
 * while this tab is open, so ownership moved up to <SocketProvider> (see
 * main.jsx / context/SocketContext.jsx). This component now just reads the
 * already-connected socket via useSocket().
 */
export default function ChatTab() {
  const socket = useSocket()
  const [conversations, setConversations] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function refresh() {
    try {
      const [{ conversations: convos }, { friends }] = await Promise.all([
        listConversations(),
        listFriends(),
      ])
      setConversations(convos)
      setContacts(friends)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('message:new', refresh)
    return () => socket.off('message:new', refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  const rows = useMemo(() => {
    const messagedIds = new Set(conversations.map((c) => c.otherUser.id))
    const contactRows = contacts
      .filter((c) => !messagedIds.has(c.id))
      .map((c) => ({
        key: c.id,
        otherUser: { id: c.id, name: c.name, preferredColor: c.preferredColor },
        mutual: c.mutual,
        preview: 'Say hello 👋',
      }))
    const conversationRows = conversations.map((c) => ({
      key: c.otherUser.id,
      otherUser: c.otherUser,
      mutual: contacts.find((f) => f.id === c.otherUser.id)?.mutual ?? false,
      preview: c.lastMessage.content,
    }))
    return [...conversationRows, ...contactRows]
  }, [conversations, contacts])

  const selected = rows.find((r) => r.key === selectedId) || rows[0] || null

  if (loading) return <p className="text-sm text-ground-500">Loading conversations…</p>
  if (error) return <p className="text-sm text-invasion-500">{error}</p>

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ground-500">
        Follow another runner from the Friends tab to start chatting.
      </p>
    )
  }

  return (
    <div className="flex h-[60vh] overflow-hidden rounded-lg border border-ground-800">
      <ul className="w-64 flex-none divide-y divide-ground-800 overflow-y-auto border-r border-ground-800">
        {rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => setSelectedId(r.key)}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                selected?.key === r.key ? 'bg-ground-800' : 'hover:bg-ground-900'
              }`}
            >
              <span
                className="h-8 w-8 flex-none rounded-full border border-ground-700"
                style={{ backgroundColor: r.otherUser.preferredColor || '#3B82F6' }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ground-100">
                  {r.otherUser.name}
                </span>
                <span className="block truncate text-xs text-ground-500">{r.preview}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex-1">
        {socket && selected ? (
          <ChatThread key={selected.key} socket={socket} otherUser={selected.otherUser} mutual={selected.mutual} />
        ) : (
          <p className="p-4 text-sm text-ground-500">Select a conversation.</p>
        )}
      </div>
    </div>
  )
}
