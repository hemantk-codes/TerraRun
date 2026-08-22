import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginSignup from './pages/LoginSignup.jsx'
import Map from './pages/Map.jsx'
import Profile from './pages/Profile.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import FriendsChat from './pages/FriendsChat.jsx'
import StartRun from './pages/StartRun.jsx'
import TerritorySplitModal from './components/TerritorySplitModal.jsx' // Phase 7
import { usePendingTerritorySplits } from './hooks/usePendingTerritorySplits.js' // Phase 7

function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-display text-2xl font-semibold text-ground-100">Page not found</h1>
      <p className="text-sm text-ground-300">That route doesn't exist yet.</p>
    </div>
  )
}

export default function App() {
  // Phase 7 — checked once per app session, independent of route, so the
  // modal can surface "on next login/page-load" per the phase prompt
  // regardless of which page the user happens to land on first.
  const { pendingSplits, dismiss } = usePendingTerritorySplits()

  return (
    <div className="min-h-screen bg-ground-950">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Map />} />
          <Route path="/login" element={<LoginSignup />} />
          <Route
            path="/run"
            element={
              <ProtectedRoute>
                <StartRun />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/friends" element={<FriendsChat />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {pendingSplits.length > 0 && (
        <TerritorySplitModal pendingSplits={pendingSplits} onResolved={dismiss} />
      )}
    </div>
  )
}
