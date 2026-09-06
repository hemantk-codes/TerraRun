import { useState } from 'react'
import FriendsTab from '../components/friends/FriendsTab.jsx'
import ChatTab from '../components/friends/ChatTab.jsx'

const TABS = [
  { id: 'friends', label: 'Friends' },
  { id: 'chat', label: 'Chat' },
]

export default function FriendsChat() {
  const [tab, setTab] = useState('friends')

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold text-ground-100">Friends & chat</h1>
      <p className="mt-1 text-sm text-ground-300">
        Follow other runners to unlock text chat — following each other back unlocks calls.
      </p>

      <div className="mt-6 flex gap-1 border-b border-ground-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-b-2 border-territory-500 text-territory-400'
                : 'text-ground-300 hover:text-ground-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === 'friends' ? <FriendsTab /> : <ChatTab />}</div>
    </div>
  )
}
