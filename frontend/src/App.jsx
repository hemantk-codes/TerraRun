import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginSignup from './pages/LoginSignup.jsx'
import Map from './pages/Map.jsx'
import Profile from './pages/Profile.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import FriendsChat from './pages/FriendsChat.jsx'

function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-display text-2xl font-semibold text-ground-100">Page not found</h1>
      <p className="text-sm text-ground-300">That route doesn't exist yet.</p>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-ground-950">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Map />} />
          <Route path="/login" element={<LoginSignup />} />
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
    </div>
  )
}
