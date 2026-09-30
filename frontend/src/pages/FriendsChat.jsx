import { useState } from 'react'
import { UsersRound } from 'lucide-react'
import FriendsTab from '../components/friends/FriendsTab.jsx'
import ChatTab from '../components/friends/ChatTab.jsx'

const TABS = [
  { id: 'friends', label: 'Friends' },
  { id: 'chat', label: 'Chat' },
]

export default function FriendsChat() {
  const [tab, setTab] = useState('friends')

  return (
    <>
      {/* Full-page fantasy background supplied for the Friends & Chat design. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          width: '100vw',
          maxWidth: 'none',
          backgroundImage: "url('/friends-chat.png')",
          backgroundAttachment: 'fixed',
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[rgba(255,248,236,0.08)]"
        style={{ width: '100vw', maxWidth: 'none' }}
      />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-12 pt-[118px] font-body">
        <section className="flex items-center gap-4">
          <div className="flex h-[58px] w-[58px] flex-none items-center justify-center">
            <UsersRound
              className="h-[54px] w-[54px] text-[#2f78bd] drop-shadow-[0_3px_4px_rgba(47,120,189,0.22)]"
              strokeWidth={2.8}
            />
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-[34px] font-extrabold leading-none tracking-[-1.4px] !text-[#18222E] sm:text-[38px]">
              Friends &amp; Chat
            </h1>

            <p className="mt-2 text-[13px] font-medium leading-tight text-[#344454] sm:text-[15px]">
              Run together. Chat together. Conquer together.
            </p>
          </div>
        </section>

        <div className="mt-5">
          <div className="inline-flex items-center gap-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`rounded-[13px] px-5 py-2 text-sm font-display font-bold transition-all ${tab === t.id
                    ? 'bg-[#c6f135] text-[#18220f] shadow-[0_2px_7px_rgba(121,160,16,0.22)]'
                    : 'bg-white text-[#777e8e] shadow-[0_4px_12px_rgba(44,50,63,0.10)] hover:bg-white hover:text-[#242832]'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          {tab === 'friends' ? <FriendsTab /> : <ChatTab />}
        </div>
      </div>
    </>
  )
}