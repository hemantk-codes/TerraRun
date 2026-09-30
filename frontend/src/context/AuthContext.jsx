import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, setAccessToken, setUnauthorizedHandler, refreshSession } from '../lib/api.js'
import { signInWithGoogle } from '../lib/firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Phase 9 addition: lib/api.js already keeps its own private copy of the
  // access token (via setAccessToken) and uses it internally for every
  // REST call — components never needed to see it before now. Socket.io's
  // handshake auth has no equivalent of "the api client," though; it needs
  // the raw token string handed to it directly. Mirroring it into React
  // state here is the only reason this exists — REST calls should keep
  // going through `api`, not read this.
  const [accessToken, setAccessTokenState] = useState(null)
  const [initializing, setInitializing] = useState(true)

  const handleSession = useCallback((data) => {
    setAccessToken(data.accessToken)
    setAccessTokenState(data.accessToken)
    setUser(data.user)
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setAccessTokenState(null)
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
        if (data) {
          setUser(data.user)
          setAccessTokenState(data.accessToken)
        }
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

  const googleAuth = useCallback(async () => {
    const { idToken } = await signInWithGoogle()

    const data = await api.post(
      '/auth/google',
      { idToken },
      { skipAuth: true }
    )

    handleSession(data)
    return data
  }, [handleSession])

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

  const uploadAvatar = useCallback(async (formData) => {
    const data = await api.post('/profile/avatar', formData)
    setUser(data.user)
    return data.user
  }, [])

  const value = {
    user,
    accessToken, // Phase 9 — see note above; only the Socket.io connection should need this
    isAuthenticated: Boolean(user),
    initializing,
    signupEmail,
    loginEmail,
    phoneAuth,
    googleAuth,
    logout,
    updateProfile,
    uploadAvatar,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
