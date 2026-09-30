import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Castle,
  ChevronRight,
  Check,
  Crown,
  FileText,
  Flag,
  Flame,
  Footprints,
  Mail,
  MapPin,
  MessageCircle,
  Palette,
  Pencil,
  Save,
  Settings,
  Trophy,
  UserPlus,
  UserRound,
  Zap,
} from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { COUNTRIES, STATES_BY_COUNTRY } from '../data/regions.js'

function splitRegion(region) {
  if (!region) return { country: '', state: '' }

  const parts = String(region)
    .split(',')
    .map((part) => part.trim())

  if (parts.length === 1) {
    return { country: parts[0], state: '' }
  }

  return {
    state: parts[0],
    country: parts.slice(1).join(', '),
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function StatIcon({ children, className = '' }) {
  return (
    <div
      className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[18px] border-[2px] border-black/10 shadow-[0_5px_0_rgba(0,0,0,0.12),inset_0_2px_0_rgba(255,255,255,0.55)] ${className}`}
    >
      {children}
    </div>
  )
}

function SettingsRow({
  icon,
  iconBg = 'bg-white',
  label,
  children,
  onClick,
  onArrowClick,
  editable = true,
}) {
  return (
    <div
      className={`group flex min-h-[58px] items-center justify-between gap-3 rounded-[14px] border border-[#dfd6c8] bg-white/70 px-3 py-2 transition-all ${editable
        ? 'cursor-pointer hover:bg-white hover:shadow-[0_3px_10px_rgba(74,53,27,0.08)]'
        : ''
        }`}
      onClick={onClick}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] border border-black/5 shadow-[0_2px_5px_rgba(0,0,0,0.05)] ${iconBg}`}
        >
          {icon}
        </div>

        <span className="truncate text-[15px] font-black tracking-[-0.2px] text-[#171717]">
          {label}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {children}

        {editable && onArrowClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onArrowClick()
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#f7f1e8] shadow-[0_3px_0_#d9cfc1] transition-all hover:translate-y-[1px] hover:shadow-[0_2px_0_#d9cfc1]"
            aria-label={`Edit ${label}`}
          >
            <ChevronRight
              className="h-4 w-4 text-[#444]"
              strokeWidth={2.8}
            />
          </button>
        ) : (
          <ChevronRight
            className="h-4 w-4 shrink-0 text-[#444]"
            strokeWidth={2.8}
          />
        )}
      </div>
    </div>
  )
}

function ActivityRow({
  icon,
  iconBg,
  accent,
  title,
  subtext,
  time,
}) {
  return (
    <div className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-[16px] border-[2px] border-[#decdb8] bg-[#fffaf0]/95 px-3 py-3 shadow-[0_5px_0_rgba(86,61,31,0.14),0_10px_20px_rgba(74,53,27,0.08),inset_0_2px_0_rgba(255,255,255,0.72)] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_0_rgba(86,61,31,0.16),0_12px_22px_rgba(74,53,27,0.1),inset_0_2px_0_rgba(255,255,255,0.78)]">
      {/* Colored notification-style accent */}
      <div
        className="absolute left-0 top-0 h-full w-[6px]"
        style={{ backgroundColor: accent }}
      />

      <div className="flex min-w-0 items-center gap-3 pl-1">
        {/* Notification-style icon tile */}
        <div
          className={`flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[15px] border-[2px] border-white/80 shadow-[0_4px_0_rgba(100,80,50,0.12),inset_0_2px_0_rgba(255,255,255,0.75)] ${iconBg}`}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div className="truncate text-[15px] font-black tracking-[-0.1px] text-[#171717]">
            {title}
          </div>

          <div className="mt-1 truncate text-[11.5px] font-semibold leading-snug text-[#6a6a6a]">
            {subtext}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[10px] font-black tracking-wide text-[#7b746a]">
          {time}
        </span>

        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#f7f1e8] shadow-[0_4px_0_#d9cfc1] transition-all group-hover:translate-y-[1px] group-hover:shadow-[0_3px_0_#d9cfc1]">
          <ChevronRight
            className="h-5 w-5 text-[#4f4a44]"
            strokeWidth={2.8}
          />
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, updateProfile, uploadAvatar } = useAuth()
  const avatarInputRef = useRef(null)

  const initial = useMemo(
    () => splitRegion(user?.region),
    [user?.region]
  )

  const [name, setName] = useState(user?.name || '')
  const [bodyWeightKg, setBodyWeightKg] = useState(
    user?.bodyWeightKg ?? ''
  )
  const [heightCm, setHeightCm] = useState(
    user?.heightCm ?? ''
  )
  const [country, setCountry] = useState(initial.country)
  const [state, setState] = useState(initial.state)

  const [preferredColor, setPreferredColor] = useState(
    user?.preferredColor || '#0055ff'
  )

  const [weeklyEmailOptOut, setWeeklyEmailOptOut] = useState(
    Boolean(user?.weeklyEmailOptOut)
  )

  const [busy, setBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [dashboard, setDashboard] = useState({
    stats: {
      totalRuns: 0,
      totalCalons: 0,
      totalTerritorySqm: 0,
      globalRank: 0,
    },
    recentActivity: [],
  })

  const [dashboardLoading, setDashboardLoading] = useState(true)

  useEffect(() => {
    const next = splitRegion(user?.region)

    setName(user?.name || '')
    setBodyWeightKg(user?.bodyWeightKg ?? '')
    setHeightCm(user?.heightCm ?? '')
    setCountry(next.country)
    setState(next.state)

    setPreferredColor(
      user?.preferredColor || '#0055ff'
    )

    setWeeklyEmailOptOut(
      Boolean(user?.weeklyEmailOptOut)
    )

    setDirty(false)
    setSuccess(false)
  }, [user])

  // Live dashboard refresh
  useEffect(() => {
    let cancelled = false

    async function loadDashboard(showSpinner = false) {
      if (showSpinner) {
        setDashboardLoading(true)
      }

      try {
        const data = await api.get('/profile/dashboard')

        if (!cancelled) {
          setDashboard(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
            'Unable to load profile data.'
          )
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false)
        }
      }
    }

    loadDashboard(true)

    const intervalId = window.setInterval(
      () => loadDashboard(false),
      15000
    )

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [user?._id])

  const stateOptions =
    STATES_BY_COUNTRY[country]

  const countrySelectRef = useRef(null)
  const stateSelectRef = useRef(null)
  const colorInputRef = useRef(null)
  const nameInputRef = useRef(null)

  const displayEmail =
    user?.email || 'testone@example.com'

  const displayCountry =
    country || 'India'

  const displayState =
    state || 'Haryana'

  const displayHeight =
    heightCm === ''
      ? '175'
      : String(heightCm)

  const displayWeight =
    bodyWeightKg === ''
      ? '70'
      : String(bodyWeightKg)

  /*
   * Recent activity uses the same visual language as the notification
   * bell: pastel icon tile + colored accent + raised 3D styling.
   */
  const recentActivity =
    dashboard.recentActivity.map((item) => {
      let icon
      let iconBg = 'bg-[#dffaff]'
      let accent = '#54c8e6'

      switch (item.type) {
        case 'territory_fully_decayed':
        case 'territory_invaded':
          icon = (
            <Castle
              className="h-7 w-7 text-[#ff4b8b]"
              fill="currentColor"
            />
          )
          iconBg = 'bg-[#ffe0ec]'
          accent = '#ff4b8b'
          break

        case 'invasion_succeeded':
          icon = (
            <Crown
              className="h-7 w-7 text-[#86db24]"
              fill="currentColor"
            />
          )
          iconBg = 'bg-[#eaffc8]'
          accent = '#91e92d'
          break

        case 'friend_request':
          icon = (
            <UserPlus
              className="h-7 w-7 text-[#27aeea]"
              strokeWidth={2.5}
            />
          )
          iconBg = 'bg-[#dff6ff]'
          accent = '#35b9ec'
          break

        case 'leaderboard_overtaken':
          icon = (
            <Trophy
              className="h-7 w-7 text-[#ffae22]"
              fill="currentColor"
            />
          )
          iconBg = 'bg-[#fff0ca]'
          accent = '#ffb52e'
          break

        case 'chat_message_received':
          icon = (
            <MessageCircle
              className="h-7 w-7 text-[#4ac5e8]"
              fill="currentColor"
            />
          )
          iconBg = 'bg-[#dcfaff]'
          accent = '#54c8e6'
          break

        case 'streak_stopper_earned':
          icon = (
            <Zap
              className="h-7 w-7 text-[#ffac25]"
              fill="currentColor"
            />
          )
          iconBg = 'bg-[#fff0cc]'
          accent = '#ffb52e'
          break

        default:
          icon = (
            <Flag
              className="h-7 w-7 text-[#8bcf24]"
              fill="currentColor"
            />
          )
          iconBg = 'bg-[#efffd3]'
          accent = '#a8d92a'
      }

      const ms =
        Date.now() -
        new Date(item.createdAt).getTime()

      const mins = Math.max(
        0,
        Math.floor(ms / 60000)
      )

      const time =
        mins < 1
          ? 'just now'
          : mins < 60
            ? `${mins}m ago`
            : mins < 1440
              ? `${Math.floor(mins / 60)}h ago`
              : `${Math.floor(mins / 1440)}d ago`

      return {
        ...item,
        time,
        icon,
        iconBg,
        accent,
      }
    })

  const dashboardStats =
    dashboard.stats || {}

  /*
   * Calons = TerraRun game points.
   * Prefer dashboard.totalCalons, then fall back to
   * the authenticated user's all-time Calons value.
   */
  const totalCalons = Number(
    dashboardStats.totalCalons ??
    user?.calonsTotal ??
    0
  )

  const totalTerritoryKm2 =
    Number(
      dashboardStats.totalTerritorySqm || 0
    ) / 1_000_000

  const totalTerritoryDisplay =
    totalTerritoryKm2 >= 1
      ? totalTerritoryKm2.toFixed(1)
      : totalTerritoryKm2.toFixed(3)

  const liveLabel = dashboardLoading
    ? 'Updating…'
    : 'LIVE'

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]

    if (!file) return

    setError('')
    setSuccess(false)

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      e.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar image must be smaller than 5 MB.')
      e.target.value = ''
      return
    }

    setAvatarBusy(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      await uploadAvatar(formData)

      setSuccess(true)
    } catch (err) {
      setError(err?.message || 'Unable to upload avatar.')
    } finally {
      setAvatarBusy(false)
      e.target.value = ''
    }
  }
  async function handleSave(e) {
    e?.preventDefault?.()

    setError('')
    setSuccess(false)
    setBusy(true)

    try {
      const region =
        state
          ? `${state}, ${country}`
          : country

      await updateProfile({
        name,
        bodyWeightKg:
          bodyWeightKg === ''
            ? undefined
            : Number(bodyWeightKg),
        heightCm:
          heightCm === ''
            ? undefined
            : Number(heightCm),
        region: region || undefined,
        preferredColor,
        weeklyEmailOptOut,
      })

      const refreshed =
        await api.get('/profile/dashboard')

      setDashboard(refreshed)
      setDirty(false)
      setSuccess(true)
    } catch (err) {
      setError(
        err?.message ||
        'Unable to save profile.'
      )
    } finally {
      setBusy(false)
    }
  }

  function markDirty(setter) {
    return (value) => {
      setter(value)
      setDirty(true)
      setSuccess(false)
    }
  }

  if (!user) return null

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#d9ecfb] pb-12 font-sans">
      {/* Exact supplied fantasy world background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('/profile.png')",
          backgroundAttachment: 'fixed',
        }}
      />

      <div className="pointer-events-none fixed inset-0 z-0 bg-[rgba(255,248,232,0.06)]" />

      {/* Three large containers */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col gap-[24px] px-2 pb-10 pt-[128px] sm:px-4 lg:px-0">

        {/* ====================================================== */}
        {/* 1. HERO CONTAINER                                      */}
        {/* ====================================================== */}

        <section className="rounded-[26px] border-[4px] border-[#17212a] bg-[#fff8ea]/90 p-4 shadow-[0_9px_0_rgba(43,34,25,0.32),0_18px_30px_rgba(24,46,63,0.18),inset_0_2px_0_rgba(255,255,255,0.72)] backdrop-blur-[3px] sm:p-5 lg:p-6">
          <div className="grid items-center gap-5 lg:grid-cols-[1.18fr_0.98fr_0.83fr]">

            {/* HERO LEFT */}
            <div className="flex min-w-0 items-center gap-5">
              <div className="relative shrink-0">
                <img
                  src={user?.avatarUrl || '/profile-avatar.png'}
                  alt="Profile avatar"
                  className="h-[155px] w-[155px] rounded-[22px] object-cover sm:h-[170px] sm:w-[170px] lg:h-[190px] lg:w-[190px]"
                />

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarBusy}
                  className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-black bg-white shadow-[0_4px_0_rgba(0,0,0,0.22)] transition-all hover:translate-y-[1px] hover:shadow-[0_3px_0_rgba(0,0,0,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Change profile picture"
                >
                  <Pencil
                    className="h-5 w-5 text-[#ff4b8b]"
                    fill="currentColor"
                  />
                </button>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[34px] font-black leading-none tracking-[-1.2px] text-[#111] sm:text-[38px]">
                    {name || 'Test One'}
                  </h1>

                  <span className="rounded-[10px] bg-[#8be82f] px-3 py-1 text-[13px] font-black text-[#17320b] shadow-[0_2px_0_rgba(37,83,0,0.25)]">
                    Online
                  </span>
                </div>

                {/* Info cards */}
                {/* COUNTRY + STATE / HEIGHT + WEIGHT */}
                <div className="mt-4 flex flex-col gap-2">

                  {/* ROW 1 — Country + State */}
                  <div className="flex gap-2">

                    {/* Country */}
                    <div className="flex h-[66px] w-fit min-w-max flex-col items-center justify-center rounded-[13px] border border-[#e3d9c9] bg-[#f7f0e4]/90 px-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-1 whitespace-nowrap text-[15px] font-black text-[#252525]">
                        <span>{displayCountry}</span>
                      </div>

                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#8a8a8a]">
                        Country
                      </div>
                    </div>

                    {/* State */}
                    <div className="flex h-[66px] w-fit min-w-max flex-col items-center justify-center rounded-[13px] border border-[#e3d9c9] bg-[#f7f0e4]/90 px-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                      <div className="whitespace-nowrap text-[15px] font-black text-[#252525]">
                        {displayState}
                      </div>

                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#8a8a8a]">
                        State
                      </div>
                    </div>

                  </div>

                  {/* ROW 2 — Height + Weight */}
                  <div className="flex gap-2">

                    {/* Height */}
                    <div className="flex h-[66px] w-fit min-w-max flex-col items-center justify-center rounded-[13px] border border-[#e3d9c9] bg-[#f7f0e4]/90 px-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                      <div className="whitespace-nowrap text-[15px] font-black text-[#252525]">
                        {displayHeight} cm
                      </div>

                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#8a8a8a]">
                        Height
                      </div>
                    </div>

                    {/* Weight */}
                    <div className="flex h-[66px] w-fit min-w-max flex-col items-center justify-center rounded-[13px] border border-[#e3d9c9] bg-[#f7f0e4]/90 px-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                      <div className="whitespace-nowrap text-[15px] font-black text-[#252525]">
                        {displayWeight} kg
                      </div>

                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#8a8a8a]">
                        Weight
                      </div>
                    </div>

                  </div>

                </div>

                {/* Territory color */}
                <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] border border-[#e0d4c2] bg-[#f7f0e4]/90 px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
                  <span className="text-[14px] font-black text-[#333]">
                    Territory Color
                  </span>

                  <div className="flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-[9px] border-[2px] border-black/10 shadow-[inset_0_2px_0_rgba(255,255,255,0.35)]"
                      style={{
                        backgroundColor:
                          preferredColor,
                      }}
                    />

                    <span className="text-[15px] font-black text-[#222]">
                      {preferredColor.toLowerCase()}
                    </span>

                    <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] bg-white shadow-[0_3px_0_#d7cfc1]">
                      <Palette
                        className="h-5 w-5 text-[#4d4d4d]"
                        strokeWidth={2.4}
                      />

                      <input
                        type="color"
                        value={preferredColor}
                        onChange={(e) =>
                          markDirty(
                            setPreferredColor
                          )(e.target.value)
                        }
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Choose territory color"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* HERO CENTER - smaller + shifted right */}
            <div className="flex items-center justify-center px-2 py-2 lg:translate-x-5 lg:py-0">
              <img
                src="/profile-castle.png"
                alt="Territory castle"
                className="w-full max-w-[245px] object-contain drop-shadow-[0_16px_14px_rgba(49,42,30,0.16)] sm:max-w-[265px]"
              />
            </div>

            {/* HERO RIGHT */}
            <div className="rounded-[22px] border-[2px] border-[#d3b792] bg-[#fff8e9]/92 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_7px_0_rgba(77,62,42,0.14)]">

              {/* Rank */}
              <div className="flex items-center gap-4">
                <div className="flex w-[44px] shrink-0 items-center justify-center">
                  <Crown
                    className="h-12 w-12 text-[#ffbd00]"
                    fill="currentColor"
                    strokeWidth={1.8}
                  />
                </div>

                <div>
                  <div className="text-[16px] font-black text-[#3b3b3b]">
                    Global Rank
                  </div>

                  <div className="text-[27px] font-black leading-none text-[#111]">
                    #{formatNumber(
                      dashboardStats.globalRank
                    )}
                  </div>
                </div>
              </div>

              <div className="my-3 h-px bg-[#dfd5c7]" />

              {/* Calons */}
              <div className="flex items-center gap-4">
                <div className="flex w-[44px] shrink-0 items-center justify-center">
                  <Flame
                    className="h-12 w-12 text-[#ff7c16]"
                    fill="currentColor"
                    strokeWidth={1.8}
                  />
                </div>

                <div>
                  <div className="text-[16px] font-black text-[#3b3b3b]">
                    Total Calons
                  </div>

                  <div className="text-[27px] font-black leading-none text-[#111]">
                    {formatNumber(totalCalons)}{' '}
                    <span className="text-[18px]">
                      Calons
                    </span>
                  </div>
                </div>
              </div>

              <div className="my-3 h-px bg-[#dfd5c7]" />

              {/* Territory */}
              <div className="flex items-center gap-4">
                <div className="flex w-[44px] shrink-0 items-center justify-center">
                  <Flag
                    className="h-12 w-12 text-[#ff4b8b]"
                    fill="currentColor"
                    strokeWidth={1.8}
                  />
                </div>

                <div>
                  <div className="text-[16px] font-black text-[#3b3b3b]">
                    Total Territory
                  </div>

                  <div className="text-[27px] font-black leading-none text-[#111]">
                    {totalTerritoryDisplay}{' '}
                    <span className="text-[18px]">
                      km²
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================== */}
        {/* 2. STATISTICS CONTAINER                                */}
        {/* ====================================================== */}

        <section className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 xl:grid-cols-4">

          {/* Total Runs */}
          <div className="flex min-h-[116px] items-center gap-4 rounded-[23px] border-[2px] border-[#a8b79c] bg-[#f0fbd7]/95 px-5 shadow-[0_7px_0_rgba(54,70,32,0.2),inset_0_2px_0_rgba(255,255,255,0.7)]">
            <StatIcon className="bg-[#a8f11b]">
              <Footprints
                className="h-10 w-10 text-[#1c781a]"
                fill="currentColor"
              />
            </StatIcon>

            <div>
              <div className="text-[16px] font-black text-[#393939]">
                Total Runs
              </div>

              <div className="text-[31px] font-black leading-none tracking-[-1px] text-[#111]">
                {formatNumber(
                  dashboardStats.totalRuns
                )}
              </div>

              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#777]">
                Runs
              </div>
            </div>
          </div>

          {/* Total Calons */}
          <div className="flex min-h-[116px] items-center gap-4 rounded-[23px] border-[2px] border-[#d5b78d] bg-[#fff0d9]/95 px-5 shadow-[0_7px_0_rgba(93,65,25,0.2),inset_0_2px_0_rgba(255,255,255,0.7)]">
            <StatIcon className="bg-[#ffc95a]">
              <Flame
                className="h-10 w-10 text-[#ff7b17]"
                fill="currentColor"
              />
            </StatIcon>

            <div>
              <div className="text-[16px] font-black text-[#393939]">
                Total Calons
              </div>

              <div className="text-[31px] font-black leading-none tracking-[-1px] text-[#111]">
                {formatNumber(totalCalons)}
              </div>

              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#777]">
                Calons
              </div>
            </div>
          </div>

          {/* Total Territory */}
          <div className="flex min-h-[116px] items-center gap-4 rounded-[23px] border-[2px] border-[#d3a5b8] bg-[#ffe8f0]/95 px-5 shadow-[0_7px_0_rgba(96,44,65,0.18),inset_0_2px_0_rgba(255,255,255,0.7)]">
            <StatIcon className="bg-[#ff9bc2]">
              <Flag
                className="h-10 w-10 text-[#e12273]"
                fill="currentColor"
              />
            </StatIcon>

            <div>
              <div className="text-[16px] font-black text-[#393939]">
                Total Territory
              </div>

              <div className="text-[31px] font-black leading-none tracking-[-1px] text-[#111]">
                {totalTerritoryDisplay}
              </div>

              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#777]">
                KM²
              </div>
            </div>
          </div>

          {/* Global Rank */}
          <div className="flex min-h-[116px] items-center gap-4 rounded-[23px] border-[2px] border-[#9dc4db] bg-[#e7f7ff]/95 px-5 shadow-[0_7px_0_rgba(45,87,112,0.2),inset_0_2px_0_rgba(255,255,255,0.7)]">
            <StatIcon className="bg-[#8ddcff]">
              <Trophy
                className="h-10 w-10 text-[#006ed8]"
                fill="currentColor"
              />
            </StatIcon>

            <div className="min-w-0">
              <div className="text-[16px] font-black text-[#393939]">
                Global Rank
              </div>

              <div className="truncate text-[29px] font-black leading-none tracking-[-1px] text-[#111]">
                #{formatNumber(
                  dashboardStats.globalRank
                )}
              </div>

              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#777]">
                Rank
              </div>
            </div>
          </div>

        </section>

        {/* ====================================================== */}
        {/* 3. LOWER CONTAINER                                     */}
        {/* ====================================================== */}

        <section className="grid grid-cols-1 gap-[24px] lg:grid-cols-2">

          {/* RECENT ACTIVITY */}
          <div className="rounded-[25px] border-[4px] border-[#17212a] bg-[#fff8ea]/92 p-4 shadow-[0_8px_0_rgba(44,34,24,0.3),0_16px_30px_rgba(31,51,63,0.14),inset_0_2px_0_rgba(255,255,255,0.7)] backdrop-blur-[2px] sm:p-5">

            <div className="mb-3 flex items-center justify-between border-b border-[#dfd5c7] pb-3">
              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#c8ff16] shadow-[0_3px_0_#7da800]">
                  <FileText
                    className="h-5 w-5 text-[#111]"
                    strokeWidth={2.7}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <h2 className="text-[23px] font-black tracking-[-0.6px] text-[#151515]">
                    Recent Activity
                  </h2>

                  <span className="rounded-full bg-[#8be82f] px-2 py-0.5 text-[9px] font-black tracking-wider text-[#17320b]">
                    {liveLabel}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="flex items-center gap-1 rounded-[11px] bg-[#f8f1e6] px-4 py-2 text-[11px] font-black text-[#151515] shadow-[0_4px_0_#d8cebf] transition-all hover:translate-y-[1px] hover:shadow-[0_3px_0_#d8cebf]"
              >
                View All
                <ChevronRight
                  className="h-4 w-4"
                  strokeWidth={3}
                />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {recentActivity.map((item) => (
                <ActivityRow
                  key={item.id}
                  {...item}
                />
              ))}
            </div>
          </div>

          {/* ACCOUNT SETTINGS */}
          <form
            onSubmit={handleSave}
            className="rounded-[25px] border-[4px] border-[#17212a] bg-[#fff8ea]/92 p-4 shadow-[0_8px_0_rgba(44,34,24,0.3),0_16px_30px_rgba(31,51,63,0.14),inset_0_2px_0_rgba(255,255,255,0.7)] backdrop-blur-[2px] sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#dfd5c7] pb-3">
              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#c8ff16] shadow-[0_3px_0_#7da800]">
                  <Settings
                    className="h-5 w-5 text-[#111]"
                    strokeWidth={2.7}
                  />
                </div>

                <h2 className="text-[23px] font-black tracking-[-0.6px] text-[#151515]">
                  Account Settings
                </h2>
              </div>

              {dirty && (
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-[11px] bg-[#8be82f] px-3 py-2 text-[11px] font-black text-[#163208] shadow-[0_4px_0_#5d8f14] transition-all hover:translate-y-[1px] hover:shadow-[0_3px_0_#5d8f14] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <Save className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Check
                      className="h-4 w-4"
                      strokeWidth={3}
                    />
                  )}

                  {busy ? 'Saving' : 'Save'}
                </button>
              )}
            </div>

            {error && (
              <div className="mb-3 rounded-[12px] border border-[#ef7c7c] bg-[#ffe4e4] px-3 py-2 text-xs font-bold text-[#a52f2f]">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-3 rounded-[12px] border border-[#9ac77c] bg-[#ebfbdc] px-3 py-2 text-xs font-black text-[#3f7d2d]">
                Profile saved.
              </div>
            )}

            <div className="flex flex-col gap-1.5">

              {/* Display Name */}
              <SettingsRow
                label="Display Name"
                icon={
                  <UserRound
                    className="h-5 w-5 text-[#0055ff]"
                    fill="currentColor"
                  />
                }
                onClick={() =>
                  nameInputRef.current?.focus()
                }
                onArrowClick={() =>
                  nameInputRef.current?.focus()
                }
              >
                <input
                  id="profile-name-input"
                  ref={nameInputRef}
                  value={name}
                  onChange={(e) =>
                    markDirty(setName)(
                      e.target.value
                    )
                  }
                  className="w-[130px] rounded-md bg-transparent text-right text-[13px] font-bold text-[#616161] outline-none"
                  aria-label="Display name"
                  required
                />
              </SettingsRow>

              {/* Email */}
              <SettingsRow
                label="Email"
                icon={
                  <Mail
                    className="h-5 w-5 text-[#0079dd]"
                    fill="currentColor"
                  />
                }
                editable={false}
              >
                <span className="max-w-[170px] truncate text-[13px] font-bold text-[#666]">
                  {displayEmail}
                </span>

                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[#444]"
                  strokeWidth={2.8}
                />
              </SettingsRow>

              {/* Country */}
              <SettingsRow
                label="Country"
                icon={
                  <Flag
                    className="h-5 w-5 text-[#ff9933]"
                    fill="currentColor"
                  />
                }
                onClick={() =>
                  countrySelectRef.current?.focus()
                }
                onArrowClick={() => {
                  countrySelectRef.current?.focus()
                  countrySelectRef.current?.showPicker?.()
                }}
              >
                <select
                  id="profile-country-select"
                  ref={countrySelectRef}
                  value={country}
                  onChange={(e) => {
                    markDirty(setCountry)(
                      e.target.value
                    )
                    setState('')
                  }}
                  className="max-w-[145px] appearance-none bg-transparent text-right text-[13px] font-bold text-[#666] outline-none"
                  aria-label="Country"
                >
                  {COUNTRIES.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </SettingsRow>

              {/* State */}
              <SettingsRow
                label="State"
                icon={
                  <MapPin
                    className="h-5 w-5 text-[#ff4b8b]"
                    fill="currentColor"
                  />
                }
                onClick={() =>
                  stateSelectRef.current?.focus()
                }
                onArrowClick={() => {
                  stateSelectRef.current?.focus()
                  stateSelectRef.current?.showPicker?.()
                }}
              >
                {stateOptions ? (
                  <select
                    id="profile-state-select"
                    ref={stateSelectRef}
                    value={state}
                    onChange={(e) =>
                      markDirty(setState)(
                        e.target.value
                      )
                    }
                    className="max-w-[145px] appearance-none bg-transparent text-right text-[13px] font-bold text-[#666] outline-none"
                    aria-label="State"
                  >
                    <option value="">
                      Select state
                    </option>

                    {stateOptions.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                ) : (
                  <input
                    id="profile-state-select"
                    ref={stateSelectRef}
                    value={state}
                    onChange={(e) =>
                      markDirty(setState)(
                        e.target.value
                      )
                    }
                    className="w-[130px] bg-transparent text-right text-[13px] font-bold text-[#666] outline-none"
                    aria-label="State"
                  />
                )}
              </SettingsRow>

              {/* Territory Color */}
              <SettingsRow
                label="Territory Color"
                icon={
                  <div
                    className="h-7 w-7 rounded-[5px] border border-black/10"
                    style={{
                      backgroundColor:
                        preferredColor,
                    }}
                  />
                }
                onClick={() =>
                  colorInputRef.current?.click()
                }
                onArrowClick={() =>
                  colorInputRef.current?.click()
                }
              >
                <span className="text-[13px] font-black uppercase text-[#666]">
                  {preferredColor}
                </span>

                <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[11px] bg-white shadow-[0_3px_0_#d7cfc1]">
                  <Palette
                    className="h-5 w-5 text-[#454545]"
                    strokeWidth={2.4}
                  />

                  <input
                    id="profile-color-input"
                    ref={colorInputRef}
                    type="color"
                    value={preferredColor}
                    onChange={(e) =>
                      markDirty(
                        setPreferredColor
                      )(e.target.value)
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Territory color"
                  />
                </label>
              </SettingsRow>

              {/* Weekly Email */}
              <div className="mt-1 flex items-center justify-between rounded-[14px] border border-[#dfd6c8] bg-white/70 px-3 py-3">
                <div className="flex min-w-0 items-start gap-3">

                  <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] border border-black/5 bg-[#168fe7] shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
                    <Mail
                      className="h-5 w-5 text-white"
                      fill="currentColor"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[15px] font-black text-[#171717]">
                      Weekly Email Report
                    </div>

                    <div className="mt-0.5 max-w-[360px] text-[11px] font-semibold leading-relaxed text-[#737373]">
                      A Monday-morning summary of your distance, Calons, and territory changes.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    markDirty(
                      setWeeklyEmailOptOut
                    )(!weeklyEmailOptOut)
                  }
                  className={`relative flex h-[34px] w-[64px] shrink-0 items-center rounded-full border-[2px] border-[#5b8d14] p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.16)] transition-colors ${weeklyEmailOptOut
                    ? 'justify-start bg-[#c7c7c7] border-[#8c8c8c]'
                    : 'justify-end bg-[#82e81f]'
                    }`}
                  aria-label="Toggle weekly email report"
                >
                  <span className="h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.22)]" />
                </button>
              </div>
            </div>
          </form>

        </section>
      </main>
    </div>
  )
}