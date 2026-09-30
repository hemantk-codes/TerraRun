import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import NotificationBell from './notifications/NotificationBell.jsx'

const navItems = [
  { label: 'MAP', to: '/map' },
  { label: 'RUN', to: '/run' },
  { label: 'RANKINGS', to: '/leaderboard' },
  { label: 'SQUAD', to: '/friends' },
  { label: 'PROFILE', to: '/profile' },
]

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.name || 'Test One'
  const avatarColor = user?.preferredColor || '#0055ff'

  async function handleLogout() {
    try {
      await logout()
      navigate('/')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-[3000] flex w-full flex-col items-center bg-transparent px-2 pt-6 font-sans pointer-events-none sm:px-4 md:pt-6">
      <div className="w-full max-w-[1200px] overflow-visible pb-6">
        <nav className="pointer-events-auto relative z-[3001] mx-auto flex h-[72px] min-w-[800px] items-center justify-between rounded-[24px] bg-[#FEF3E7]/50 px-4 backdrop-blur-[10px] shadow-[0_10px_25px_rgba(0,0,0,0.22),0_0_24px_rgba(216,195,165,0.65),inset_0_2px_0_rgba(255,255,255,0.85),inset_0_-4px_8px_rgba(120,90,55,0.22)] md:px-6">
          <div className="mr-4 flex flex-shrink-0 items-center gap-3">
            <NavLink to="/" aria-label="TerraRun home">
              <div className="ml-2 flex h-9 w-9 items-center justify-center rounded-lg border-[2.5px] border-black bg-[#ccff00] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <span className="select-none font-sans text-xl font-black leading-none text-black">T</span>
              </div>
            </NavLink>

            <NavLink to="/" className="flex items-center gap-[2px] select-none">
              <span className="text-[22px] font-black tracking-[-0.5px] text-black">TERRARUN</span>
              <div className="ml-1 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[#ff4b8b]">
                <div className="h-[6px] w-[6px] rotate-45 rounded-[1.5px] border-[1.5px] border-white" />
              </div>
            </NavLink>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 md:gap-3">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) => {
                  const activeClass = item.to === '/friends'
                    ? 'bg-[#c6f135] text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] translate-y-[2px]'
                    : 'bg-[#ff9933] text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] translate-y-[2px]'

                  return `flex h-[34px] items-center justify-center rounded-[10px] px-4 text-[11px] font-black tracking-wide transition-all select-none md:px-5 ${
                    isActive
                      ? activeClass
                      : 'bg-[#f0ece1] text-black shadow-[0px_3px_0px_0px_#dfdacf] hover:bg-[#e8e3d5] hover:translate-y-[1px] hover:shadow-[0px_2px_0px_0px_#dfdacf] active:translate-y-[3px] active:shadow-[0px_0px_0px_0px_#dfdacf]'
                  }`
                }}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="ml-4 flex flex-shrink-0 items-center gap-4 md:gap-5">
            <NotificationBell />

            {isAuthenticated ? (
              <NavLink to="/profile" className="group flex cursor-pointer select-none items-center gap-2" aria-label="Open profile">
                <div
                  className="flex h-[36px] w-[36px] items-center justify-center overflow-hidden rounded-full border-[2.5px] border-black shadow-sm transition-transform group-hover:scale-105"
                  style={{ backgroundColor: avatarColor }}
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="mt-[4px] h-[18px] w-[18px] fill-white text-white" />
                  )}
                </div>
                <span className="text-[13px] font-black tracking-tight text-black transition-colors group-hover:text-gray-700">{displayName}</span>
              </NavLink>
            ) : (
              <NavLink to="/login" className="group flex cursor-pointer select-none items-center" aria-label="Log in">
                <div className="flex h-[36px] w-[36px] items-center justify-center overflow-hidden rounded-full border-[2.5px] border-black bg-[#0055ff] shadow-sm transition-transform group-hover:scale-105">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="mt-[4px] h-[18px] w-[18px] fill-white text-white" />
                  )}
                </div>
              </NavLink>
            )}

            {isAuthenticated ? (
              <button type="button" onClick={handleLogout} className="group relative cursor-pointer select-none" aria-label="Log out">
                <div className="h-[38px] w-[72px] rounded-[12px] bg-[#cc7a29]" />
                <div className="absolute left-0 top-0 flex h-[34px] w-full items-center justify-center rounded-[11px] bg-[#ff9933] transition-all group-hover:bg-[#ff8c1a] group-active:h-[38px] group-active:translate-y-[4px]">
                  <span className="text-[12px] font-black uppercase tracking-wider text-black">EXIT</span>
                </div>
              </button>
            ) : (
              <NavLink to="/login" className="group relative cursor-pointer select-none" aria-label="Log in">
                <div className="h-[38px] w-[72px] rounded-[12px] bg-[#cc7a29]" />
                <div className="absolute left-0 top-0 flex h-[34px] w-full items-center justify-center rounded-[11px] bg-[#ff9933] transition-all group-hover:bg-[#ff8c1a] group-active:h-[38px] group-active:translate-y-[4px]">
                  <span className="text-[12px] font-black uppercase tracking-wider text-black">LOG IN</span>
                </div>
              </NavLink>
            )}
          </div>
        </nav>
      </div>
    </div>
  )
}
