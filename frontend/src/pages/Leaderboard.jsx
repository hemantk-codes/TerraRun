import { useCallback, useEffect, useState } from 'react'
import { Flame, Flag } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const SCOPES = [
  { value: 'friends', label: 'Friends' },
  { value: 'regional', label: 'Regional' },
]

const PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

async function fetchLeaderboard({ scope, period, region }) {
  const url = new URL(`${API_BASE_URL}/leaderboard`)

  url.searchParams.set('scope', scope)
  url.searchParams.set('period', period)

  if (region) {
    url.searchParams.set('region', region)
  }

  const res = await fetch(url.toString())

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))

    throw new Error(
      body.error ||
      `Failed to load leaderboard (${res.status})`,
    )
  }

  return res.json()
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(
    Math.round(Number(value) || 0),
  )
}

function formatTerritory(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '—'
  }

  return `${number.toFixed(number >= 10 ? 1 : 2)} km²`
}

function getTerritoryKm2(row) {
  return (
    row?.territoryKm2 ??
    row?.territoryAreaKm2 ??
    row?.areaKm2 ??
    null
  )
}

function getAvatarUrl(row, currentUserId, currentUserAvatar) {
  if (row?.avatarUrl) {
    return row.avatarUrl
  }

  if (
    currentUserId &&
    row?.userId &&
    String(row.userId) === String(currentUserId) &&
    currentUserAvatar
  ) {
    return currentUserAvatar
  }

  return null
}

function RunnerAvatar({
  row,
  currentUserId,
  currentUserAvatar,
  large = false,
}) {
  const [failed, setFailed] = useState(false)

  const avatarUrl = getAvatarUrl(
    row,
    currentUserId,
    currentUserAvatar,
  )

  const initial =
    row?.name?.trim()?.charAt(0)?.toUpperCase() || '?'

  const sizeClass = large
    ? 'h-[74px] w-[74px]'
    : 'h-[42px] w-[42px]'

  const textClass = large
    ? 'text-[26px]'
    : 'text-[15px]'

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={`${row?.name || 'Runner'} avatar`}
        onError={() => setFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full border-[3px] border-white object-cover shadow-[0_4px_9px_rgba(40,30,20,0.2)]`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} ${textClass} flex shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-[#38b4e5] font-black text-white shadow-[0_4px_9px_rgba(40,30,20,0.2)]`}
    >
      {initial}
    </div>
  )
}

/*
 * Small trophy sticker used beside "Leaderboard".
 * Drawn inline so it does not depend on an icon library style.
 */
function TrophySticker() {
  return (
    <svg
      viewBox="0 0 80 80"
      className="h-[42px] w-[42px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="trophyGold"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor="#ffe36b" />
          <stop offset="55%" stopColor="#ffc72f" />
          <stop offset="100%" stopColor="#e89b08" />
        </linearGradient>
      </defs>

      <path
        d="M29 16h22v18c0 9-4 15-11 18-7-3-11-9-11-18V16Z"
        fill="url(#trophyGold)"
        stroke="#b77700"
        strokeWidth="2.5"
      />

      <path
        d="M29 20H18c0 10 4 16 12 18M51 20h11c0 10-4 16-12 18"
        fill="none"
        stroke="#d18a00"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <path
        d="M40 52v10M28 66h24"
        stroke="#a86c00"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <path
        d="M32 15h16"
        stroke="#fff1a2"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/*
 * Filled crown sticker matching the gold / silver / bronze podium language.
 */
function CrownSticker({ type }) {
  const config = {
    gold: {
      light: '#ffe987',
      mid: '#ffc21d',
      dark: '#d98b00',
      stroke: '#a96b00',
    },
    silver: {
      light: '#f2f4f7',
      mid: '#c7cdd5',
      dark: '#9da5af',
      stroke: '#7d858f',
    },
    bronze: {
      light: '#efbf93',
      mid: '#c98247',
      dark: '#9e5726',
      stroke: '#784019',
    },
  }[type]

  const id = `crown-${type}`

  return (
    <svg
      viewBox="0 0 90 64"
      className="h-[42px] w-[54px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-gradient`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor={config.light}
          />
          <stop
            offset="55%"
            stopColor={config.mid}
          />
          <stop
            offset="100%"
            stopColor={config.dark}
          />
        </linearGradient>
      </defs>

      <path
        d="M9 13 25 29 39 7l12 22L65 7l16 22-7 20H16L9 13Z"
        fill={`url(#${id}-gradient)`}
        stroke={config.stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      <path
        d="M17 49h58"
        stroke={config.stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />

      <circle
        cx="25"
        cy="28"
        r="3"
        fill="#fff8cf"
        opacity="0.8"
      />

      <circle
        cx="65"
        cy="28"
        r="3"
        fill="#fff8cf"
        opacity="0.75"
      />
    </svg>
  )
}

function PodiumCard({
  row,
  rank,
  currentUserId,
  currentUserAvatar,
}) {
  if (!row) {
    return (
      <div className="w-full flex-1" />
    )
  }

  const styles = {
    1: {
      card:
        'bg-[#ffd768] border-[#e9bc3b] shadow-[0_8px_0_#c7972d,0_14px_22px_rgba(75,53,12,0.16),0_0_10px_rgba(255,205,80,0.28),0_0_24px_rgba(255,205,80,0.14)]',
      crown: 'gold',
      rankColor: '#a96f00',
      height: 'min-h-[182px] md:min-h-[194px]',
      position: '-translate-y-[18px]',
    },
    2: {
      card:
        'bg-[#f7f8fa] border-[#d0d5db] shadow-[0_8px_0_#adb4be,0_14px_22px_rgba(50,54,62,0.12),0_0_10px_rgba(255,205,80,0.28),0_0_24px_rgba(255,205,80,0.14)]',
      crown: 'silver',
      rankColor: '#737983',
      height: 'min-h-[172px] md:min-h-[184px]',
      position: 'translate-y-[8px]',
    },
    3: {
      card:
        'bg-[#f6dfca] border-[#d8a87d] shadow-[0_8px_0_#b98057,0_14px_22px_rgba(80,45,25,0.12),0_0_10px_rgba(255,205,80,0.28),0_0_24px_rgba(255,205,80,0.14)]',
      crown: 'bronze',
      rankColor: '#89542d',
      height: 'min-h-[172px] md:min-h-[184px]',
      position: 'translate-y-[8px]',
    },
  }

  const style = styles[rank]

  return (
    <div
      className={`relative flex w-full flex-1 flex-col items-center rounded-[19px] border-[2px] px-3 pb-4 pt-4 text-center ${style.height} ${style.card} ${style.position}`}
    >
      <div className="absolute -top-[24px] left-1/2 flex -translate-x-1/2 items-center justify-center">
        <CrownSticker type={style.crown} />
      </div>

      <div className="mt-4">
        <RunnerAvatar
          row={row}
          currentUserId={currentUserId}
          currentUserAvatar={currentUserAvatar}
          large
        />
      </div>

      <div
        className="mt-2 text-[9px] font-black uppercase tracking-[0.14em]"
        style={{ color: style.rankColor }}
      >
        Rank {rank}
      </div>

      <div className="mt-0.5 max-w-full truncate text-[13px] font-black text-[#171717] md:text-[15px]">
        {row.name}
      </div>

      <div className="mt-2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-[10px] font-black text-[#404040] md:text-[11px]">
          <Flame
            className="h-[12px] w-[12px] text-[#ff7814]"
            fill="currentColor"
          />
          {formatNumber(row.score)} cal
        </div>

        <div className="flex items-center gap-1 text-[9px] font-bold text-[#6f6a63] md:text-[10px]">
          <Flag
            className="h-[12px] w-[12px] text-[#e13f87]"
            fill="currentColor"
          />
          {formatTerritory(getTerritoryKm2(row))}
        </div>
      </div>
    </div>
  )
}

function RankingRow({
  row,
  currentUserId,
  currentUserAvatar,
}) {
  const isYou =
    String(row.userId) === String(currentUserId)

  return (
    <div
      className={`grid grid-cols-[30px_minmax(0,1fr)_82px_82px] items-center gap-2 px-3 py-2.5 sm:grid-cols-[38px_minmax(0,1fr)_115px_100px] sm:gap-3 sm:px-4 ${isYou
        ? 'bg-[#f2ffd7]'
        : 'bg-[#fffaf3]'
        }`}
    >
      <div className="text-center text-[10px] font-black text-[#66605a] sm:text-[12px]">
        {row.rank}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <RunnerAvatar
          row={row}
          currentUserId={currentUserId}
          currentUserAvatar={currentUserAvatar}
        />

        <div className="min-w-0">
          <div className="truncate text-[10px] font-black text-[#282828] sm:text-[12px]">
            {row.name}
          </div>

          {isYou && (
            <div className="text-[7px] font-black uppercase tracking-[0.12em] text-[#79a900] sm:text-[8px]">
              You
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 text-[9px] font-black text-[#3b3b3b] sm:text-[11px]">
        <Flame
          className="h-[12px] w-[12px] text-[#ff7814] sm:h-[13px] sm:w-[13px]"
          fill="currentColor"
        />
        {formatNumber(row.score)}
      </div>

      <div className="flex items-center gap-1 text-[9px] font-black text-[#55504b] sm:text-[11px]">
        <Flag
          className="h-[12px] w-[12px] text-[#e13f87] sm:h-[13px] sm:w-[13px]"
          fill="currentColor"
        />
        {formatTerritory(getTerritoryKm2(row))}
      </div>
    </div>
  )
}

export default function Leaderboard() {
  const { user } = useAuth()

  const currentUserId = user?._id || user?.id
  const currentUserAvatar = user?.avatarUrl || null

  const [scope, setScope] = useState('friends')
  const [period, setPeriod] = useState('weekly')
  const [region, setRegion] = useState(
    user?.region || '',
  )

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] =
    useState('')

  const load = useCallback(async () => {
    if (
      scope === 'regional' &&
      !region.trim()
    ) {
      setRows([])
      setStatus('ready')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      const data = await fetchLeaderboard({
        scope,
        period,
        region:
          scope === 'regional'
            ? region.trim()
            : undefined,
      })

      setRows(data.leaderboard || [])
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error?.message ||
        'Unable to load leaderboard.',
      )
    }
  }, [scope, period, region])

  useEffect(() => {
    load()

    const interval = window.setInterval(() => {
      load()
    }, 15000)

    return () => {
      window.clearInterval(interval)
    }
  }, [load])

  useEffect(() => {
    if (user?.region && !region) {
      setRegion(user.region)
    }
  }, [user?.region, region])

  const showRegionPrompt =
    scope === 'regional' &&
    !region.trim() &&
    status === 'ready'

  const top1 = rows.find(
    (row) => Number(row.rank) === 1,
  )

  const top2 = rows.find(
    (row) => Number(row.rank) === 2,
  )

  const top3 = rows.find(
    (row) => Number(row.rank) === 3,
  )

  const remaining = rows.filter(
    (row) => Number(row.rank) > 3,
  )

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#d9ecfb] pb-10 font-sans">

      {/* EXACT SUPPLIED BACKGROUND */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('/leaderboard.png')",
          backgroundAttachment: 'fixed',
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0 bg-[rgba(255,248,232,0.04)]" />

      {/* NAVBAR-SAFE PAGE AREA */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1040px] flex-col gap-3 px-3 pb-8 pt-[120px] sm:px-5 lg:px-0">

        {/* =====================================================
            SECTION 1 — TITLE
        ===================================================== */}
        <section className="flex items-center justify-center">
          <div className="flex items-center gap-4 rounded-[20px] px-4 py-2">
            <img
              src="/leaderboard-trophy.png"
              alt="Leaderboard trophy"
              className="h-[90px] w-[90px] object-contain drop-shadow-[0_5px_5px_rgba(90,55,10,0.18)] sm:h-[100px] sm:w-[100px]"
            />

            <div>
              <h1 className="text-[38px] font-black leading-none tracking-[-1.5px] text-[#111] sm:text-[46px]">
                Leaderboard
              </h1>

              <p className="mt-2 text-[14px] font-bold leading-tight text-[#686868] sm:text-[16px]">
                Top runners. Biggest territories. Real-world dominance.
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            SECTION 2 — FILTERS
        ===================================================== */}
        <section className="mt-4 flex flex-wrap items-center justify-center gap-4">
          {SCOPES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                setScope(item.value)
              }
              aria-pressed={
                scope === item.value
              }
              className={`rounded-[10px] border-[2px] px-5 py-2.5 text-[12px] font-black shadow-[0_2px_0_rgba(55,40,25,0.12),0_0_10px_rgba(255,205,80,0.28),0_0_24px_rgba(255,205,80,0.14)] transition-transform active:translate-y-[1px] sm:px-5 ${scope === item.value
                ? 'border-[#83b800] bg-[#c8ff32] text-[#182400]'
                : 'border-[#d4cdc3] bg-[#fffdf9] text-[#4d4944]'
                }`}
            >
              {item.label}
            </button>
          ))}

          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                setPeriod(item.value)
              }
              aria-pressed={
                period === item.value
              }
              className={`rounded-[10px] border-[2px] px-5 py-2.5 text-[12px] font-black shadow-[0_2px_0_rgba(55,40,25,0.12),0_0_10px_rgba(255,205,80,0.28),0_0_24px_rgba(255,205,80,0.14)] transition-transform active:translate-y-[1px] sm:px-5 ${period === item.value
                ? 'border-[#83b800] bg-[#c8ff32] text-[#182400]'
                : 'border-[#d4cdc3] bg-[#fffdf9] text-[#4d4944]'
                }`}
            >
              {item.label}
            </button>
          ))}
        </section>

        {/* Regional input stays outside the visual reference sections */}
        {scope === 'regional' && (
          <div className="flex justify-center">
            <input
              type="text"
              value={region}
              onChange={(event) =>
                setRegion(event.target.value)
              }
              placeholder="Region (e.g. Haryana)"
              className="w-full max-w-[250px] rounded-[9px] border-[2px] border-[#d7cfc4] bg-white/95 px-3 py-2 text-center text-[11px] font-bold text-[#454545] outline-none focus:border-[#9bd915]"
            />
          </div>
        )}

        {status === 'error' && (
          <div className="mx-auto w-full max-w-[600px] rounded-[14px] border-[2px] border-[#e3b1c3] bg-[#fff0f5] px-4 py-3 text-center">
            <p className="text-[11px] font-bold text-[#9f3458]">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={load}
              className="mt-2 rounded-[8px] bg-[#ff9a31] px-3 py-1.5 text-[10px] font-black"
            >
              Retry
            </button>
          </div>
        )}

        {showRegionPrompt && (
          <div className="py-4 text-center text-[11px] font-bold text-[#77716a]">
            Enter a region above to see its leaderboard.
          </div>
        )}

        {/* =====================================================
            SECTION 3 — PODIUM
            LEFT  = SILVER #2
            CENTER = GOLD #1
            RIGHT = BRONZE #3
        ===================================================== */}
        {status === 'ready' &&
          !showRegionPrompt &&
          rows.length > 0 && (
            <section className="mt-5 grid grid-cols-3 items-end gap-2.5 pt-7 sm:gap-3.5">
              <PodiumCard
                row={top2}
                rank={2}
                currentUserId={currentUserId}
                currentUserAvatar={
                  currentUserAvatar
                }
              />

              <PodiumCard
                row={top1}
                rank={1}
                currentUserId={currentUserId}
                currentUserAvatar={
                  currentUserAvatar
                }
              />

              <PodiumCard
                row={top3}
                rank={3}
                currentUserId={currentUserId}
                currentUserAvatar={
                  currentUserAvatar
                }
              />
            </section>
          )}

        {status === 'loading' && (
          <section className="py-10 text-center">
            <div className="inline-flex rounded-[12px] border-[2px] border-[#ded4c6] bg-white/85 px-5 py-3 text-[11px] font-black text-[#716c64]">
              Loading rankings…
            </div>
          </section>
        )}

        {status === 'ready' &&
          !showRegionPrompt &&
          rows.length === 0 && (
            <section className="py-10 text-center">
              <div className="inline-flex rounded-[14px] border-[2px] border-[#ded4c6] bg-white/85 px-5 py-3 text-[11px] font-black text-[#716c64]">
                No Calons earned here yet.
              </div>
            </section>
          )}

        {/* =====================================================
            SECTION 4 — LONG RANKING TABLE
        ===================================================== */}
        {status === 'ready' &&
          !showRegionPrompt &&
          rows.length > 3 && (
            <section className="mt-10 overflow-hidden rounded-[18px] border-[2px] border-[#dfd5c8] bg-[#fff8ed]/95 shadow-[0_6px_0_rgba(55,42,28,0.12)]">

              <div className="grid grid-cols-[30px_minmax(0,1fr)_82px_82px] items-center gap-2 bg-[#fff0db] px-3 py-2.5 sm:grid-cols-[38px_minmax(0,1fr)_115px_100px] sm:gap-3 sm:px-4">
                <div className="text-center text-[8px] font-black uppercase tracking-[0.14em] text-[#887e70] sm:text-[9px]">
                  #
                </div>

                <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[#887e70] sm:text-[9px]">
                  Runner
                </div>

                <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[#887e70] sm:text-[9px]">
                  Calons
                </div>

                <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[#887e70] sm:text-[9px]">
                  Territory
                </div>
              </div>

              {remaining.map((row) => (
                <div
                  key={row.userId}
                  className="border-t border-[#e6ddd2] shadow-[0_0_10px_rgba(255,205,80,0.22),0_0_20px_rgba(255,205,80,0.10)]"
                >
                  <RankingRow
                    row={row}
                    currentUserId={currentUserId}
                    currentUserAvatar={
                      currentUserAvatar
                    }
                  />
                </div>
              ))}
            </section>
          )}
      </main>
    </div>
  )
}