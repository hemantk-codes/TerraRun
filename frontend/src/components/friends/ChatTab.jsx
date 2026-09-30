import { useEffect, useMemo, useState } from 'react'
import { useSocket } from '../../context/SocketContext.jsx'
import { listConversations, listFriends } from '../../lib/socialApi.js'
import ChatThread from './ChatThread.jsx'

function RunnerAvatar({ user, small = false }) {
  const size = small ? 'h-9 w-9' : 'h-10 w-10'
  const initials = user?.name?.trim()?.charAt(0)?.toUpperCase() || '?'

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`${user.name || 'Runner'} avatar`}
        className={`${size} flex-none rounded-full border-2 border-white object-cover shadow-[0_2px_6px_rgba(40,45,55,0.14)]`}
      />
    )
  }

  return (
    <span
      className={`${size} flex flex-none items-center justify-center rounded-full border-2 border-white text-[12px] font-black text-white shadow-[0_2px_6px_rgba(40,45,55,0.14)]`}
      style={{ backgroundColor: user?.preferredColor || '#55d9d0' }}
    >
      {initials}
    </span>
  )
}

export default function ChatTab() {
  const socket = useSocket()
  const [conversations, setConversations] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function refresh() {
    try {
      const [{ conversations: convos }, { friends }] = await Promise.all([listConversations(), listFriends()])
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
        otherUser: {
          id: c.id,
          name: c.name,
          preferredColor: c.preferredColor,
          avatarUrl: c.avatarUrl,
        },
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

  if (loading) {
    return <p className="rounded-[16px] bg-white/85 px-4 py-3 text-[12px] font-semibold text-[#8a919e] shadow-[0_5px_15px_rgba(44,50,63,0.06)]">Loading conversations…</p>
  }

  if (error) {
    return <p className="rounded-[16px] border border-[#f3bfd3] bg-[#fff2f7] px-4 py-3 text-[12px] font-semibold text-[#a33d60]">{error}</p>
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-[18px] bg-white/95 p-6 text-center text-[12px] font-semibold text-[#8a919e] shadow-[0_10px_24px_rgba(44,50,63,0.08)]">
        Follow another runner from the Friends tab to start chatting.
      </p>
    )
  }

  return (
    <div className="flex h-[60vh] overflow-hidden rounded-[24px] border border-white/80 bg-[#FCF6E9] shadow-[0_14px_34px_rgba(47,55,72,0.14),0_0_20px_rgba(111,159,194,0.10)] backdrop-blur-[5px]">
      <aside className="w-64 flex-none overflow-y-auto border-r border-[#ebe4db] bg-[#FCF6E9] p-2.5">
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setSelectedId(r.key)}
            className={`mb-1.5 flex w-full items-center gap-3 rounded-[15px] px-3 py-3 text-left transition-all last:mb-0 ${
              selected?.key === r.key
                ? 'bg-[#dff7bf] shadow-[inset_0_0_0_1px_rgba(154,194,88,0.18)]'
                : 'hover:bg-white/80'
            }`}
          >
            <RunnerAvatar user={r.otherUser} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[13px] font-bold text-[#171a1f]">{r.otherUser.name}</span>
              <span className="block truncate text-[11px] font-medium text-[#8a919e]">{r.preview}</span>
            </span>
          </button>
        ))}
      </aside>

      <div className="min-w-0 flex-1 bg-[#F5EDDC]">
        {socket && selected ? (
          <ChatThread key={selected.key} socket={socket} otherUser={selected.otherUser} mutual={selected.mutual} />
        ) : (
          <p className="p-4 text-[12px] font-semibold text-[#8a919e]">Select a conversation.</p>
        )}
      </div>
    </div>
  )
}
