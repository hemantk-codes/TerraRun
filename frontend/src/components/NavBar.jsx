import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const links = [
  { to: '/', label: 'Map', end: true },
  { to: '/run', label: 'Start Run' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/friends', label: 'Friends & Chat' },
  { to: '/profile', label: 'Profile' },
]

export default function NavBar() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header className="border-b border-ground-800 bg-ground-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ground-100">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 4 L27 11 L23 25 L9 25 L5 11 Z" fill="currentColor" className="text-territory-500" />
          </svg>
          TerraRun
        </NavLink>

        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ground-800 text-territory-400'
                    : 'text-ground-300 hover:bg-ground-900 hover:text-ground-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <span
              className="hidden h-6 w-6 flex-none rounded-full border border-ground-700 sm:block"
              style={{ backgroundColor: user?.preferredColor || '#3B82F6' }}
              title="Your territory color"
            />
            <span className="text-sm text-ground-300">{user?.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-ground-700 px-3 py-2 text-sm font-medium text-ground-300 transition-colors hover:bg-ground-900 hover:text-ground-100"
            >
              Log out
            </button>
          </div>
        ) : (
          <NavLink
            to="/login"
            className="rounded-md bg-territory-500 px-4 py-2 text-sm font-semibold text-ground-950 transition-opacity hover:opacity-90"
          >
            Log in
          </NavLink>
        )}
      </div>
    </header>
  )
}
