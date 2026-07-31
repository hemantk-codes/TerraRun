import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { useAuth } from '../context/AuthContext.jsx'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase.js'

const TABS = { EMAIL: 'email', PHONE: 'phone' }

export default function LoginSignup() {
  const { isAuthenticated, signupEmail, loginEmail, phoneAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/'

  const [tab, setTab] = useState(TABS.EMAIL)

  if (isAuthenticated) return <Navigate to={redirectTo} replace />

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-ground-100">Log in or sign up</h1>
        <p className="mt-2 text-sm text-ground-300">Claim ground. Defend it. Run.</p>
      </div>

      <div className="flex rounded-lg border border-ground-800 bg-ground-900 p-1 text-sm">
        <TabButton active={tab === TABS.EMAIL} onClick={() => setTab(TABS.EMAIL)}>
          Email
        </TabButton>
        <TabButton active={tab === TABS.PHONE} onClick={() => setTab(TABS.PHONE)}>
          Phone
        </TabButton>
      </div>

      {tab === TABS.EMAIL ? (
        <EmailForm
          onSuccess={() => navigate(redirectTo, { replace: true })}
          signupEmail={signupEmail}
          loginEmail={loginEmail}
        />
      ) : (
        <PhoneForm onSuccess={() => navigate(redirectTo, { replace: true })} phoneAuth={phoneAuth} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 font-medium transition-colors ${
        active ? 'bg-ground-800 text-territory-400' : 'text-ground-300 hover:text-ground-100'
      }`}
    >
      {children}
    </button>
  )
}

function EmailForm({ onSuccess, signupEmail, loginEmail }) {
  const [isSignup, setIsSignup] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isSignup) {
        if (!name.trim()) throw new Error('Enter your name.')
        await signupEmail({ name, email, password })
      } else {
        await loginEmail({ email, password })
      }
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-card flex flex-col gap-4">
      {error && <p className="form-error">{error}</p>}

      {isSignup && (
        <div>
          <label className="field-label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Runner"
            autoComplete="name"
            required
          />
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="field-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="field-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
        />
      </div>

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
      </button>

      <button
        type="button"
        className="text-center text-sm text-ground-300 hover:text-territory-400"
        onClick={() => {
          setIsSignup((v) => !v)
          setError('')
        }}
      >
        {isSignup ? 'Already have an account? Log in' : 'New here? Create an account'}
      </button>
    </form>
  )
}

function PhoneForm({ onSuccess, phoneAuth }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmationResult, setConfirmationResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const recaptchaHostRef = useRef(null)
  const recaptchaVerifierRef = useRef(null)

  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear?.()
      recaptchaVerifierRef.current = null
    }
  }, [])

  if (!isFirebaseConfigured) {
    return (
      <div className="form-card">
        <p className="form-error">
          Phone sign-in isn&apos;t configured yet. Set the <code>VITE_FIREBASE_*</code> variables in{' '}
          <code>frontend/.env.local</code> — see the Firebase console setup steps in{' '}
          <code>backend/src/controllers/authController.js</code>.
        </p>
      </div>
    )
  }

  async function handleSendCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const auth = getFirebaseAuth()
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaHostRef.current, {
          size: 'invisible',
        })
      }
      const result = await signInWithPhoneNumber(auth, phone, recaptchaVerifierRef.current)
      setConfirmationResult(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const credential = await confirmationResult.confirm(otp)
      const idToken = await credential.user.getIdToken()
      await phoneAuth({ idToken, name })
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form-card flex flex-col gap-4">
      {error && <p className="form-error">{error}</p>}

      {!confirmationResult ? (
        <form onSubmit={handleSendCode} className="flex flex-col gap-4">
          <div>
            <label className="field-label" htmlFor="phone-name">
              Name <span className="text-ground-500">(used if this is a new account)</span>
            </label>
            <input
              id="phone-name"
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Runner"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="phone">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              className="field-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              autoComplete="tel"
              required
            />
            <p className="mt-1 text-xs text-ground-500">
              Include the country code (E.164 format), e.g. +91 for India, +1 for the US.
            </p>
          </div>

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
          <div>
            <label className="field-label" htmlFor="otp">
              Enter the code sent to {phone}
            </label>
            <input
              id="otp"
              inputMode="numeric"
              className="field-input"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify & continue'}
          </button>
        </form>
      )}

      {/* Invisible reCAPTCHA mounts here — required by Firebase Phone Auth,
          renders nothing visible in the normal case. */}
      <div ref={recaptchaHostRef} />
    </div>
  )
}
