import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, setAccessToken, setUnauthorizedHandler, refreshSession } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  const handleSession = useCallback((data) => {
    setAccessToken(data.accessToken)
    setUser(data.user)
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    // No access token exists in memory yet on a fresh page load (by design
    // — it's never persisted to localStorage). Ask the backend to mint a
    // new one from the httpOnly refresh cookie, if there is one. This is
    // what makes "refreshing the page keeps me logged in" work.
    refreshSession()
      .then((data) => {
        if (data) setUser(data.user)
      })
      .finally(() => setInitializing(false))
  }, [clearSession])

  const signupEmail = useCallback(
    async (payload) => {
      const data = await api.post('/auth/signup/email', payload, { skipAuth: true })
      handleSession(data)
      return data
    },
    [handleSession]
  )

  const loginEmail = useCallback(
    async (payload) => {
      const data = await api.post('/auth/login/email', payload, { skipAuth: true })
      handleSession(data)
      return data
    },
    [handleSession]
  )

  const phoneAuth = useCallback(
    async (payload) => {
      const data = await api.post('/auth/phone', payload, { skipAuth: true })
      handleSession(data)
      return data
    },
    [handleSession]
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, { skipAuth: true })
    } finally {
      clearSession()
    }
  }, [clearSession])

  const updateProfile = useCallback(async (payload) => {
    const data = await api.patch('/profile/me', payload)
    setUser(data.user)
    return data.user
  }, [])

  const value = {
    user,
    isAuthenticated: Boolean(user),
    initializing,
    signupEmail,
    loginEmail,
    phoneAuth,
    logout,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
