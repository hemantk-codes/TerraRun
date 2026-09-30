import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginSignup() {
  const { isAuthenticated, signupEmail, loginEmail, googleAuth } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = location.state?.from?.pathname || '/'

  const [isSignup, setIsSignup] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  function handleSuccess() {
    navigate(redirectTo, { replace: true })
  }

  return (
    <main
      className="flex min-h-screen w-full flex-col items-center overflow-y-auto px-3 pb-8 pt-[125px] sm:px-4"
      style={{
        backgroundImage: "url('/loginsignup.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Very light contrast layer */}
      <div className="pointer-events-none absolute inset-0 bg-white/5" />

      {/* Main auth card */}
      <section className="relative z-10 w-full max-w-[460px] overflow-hidden rounded-[30px] border-[3px] border-white/85 bg-[#FAF8F4] shadow-[0_22px_55px_rgba(0,0,0,0.28)]">

        {/* Heading */}
        <div className="px-7 pb-5 pt-7 text-center sm:px-8">
          <h1 className="text-center text-[40px] font-[1000] leading-[0.96] tracking-[-1.8px] sm:text-[43px]">
            {isSignup ? (
              <>
                <span className="text-[#191919]"
                  style={{ WebkitTextStroke: '0.8px currentColor' }}>JOIN </span>
                <span className="text-[#ff4b8b]"
                  style={{ WebkitTextStroke: '0.8px currentColor' }}>
                  TERRARUN
                </span>
              </>
            ) : (
              <>
                <span className="text-[#191919]"
                  style={{ WebkitTextStroke: '0.8px currentColor' }}>
                  WELCOME{' '}
                </span>
                <span className="text-[#ff4b8b]"
                  style={{ WebkitTextStroke: '0.8px currentColor' }}>
                  BACK
                </span>
              </>
            )}
          </h1>

          <p className="mt-2 text-[14px] font-bold text-[#606060]">
            {isSignup
              ? 'Start your journey. Claim your territory.'
              : 'Continue your run. Your territory awaits.'}
          </p>
        </div>

        <AuthForm
          isSignup={isSignup}
          signupEmail={signupEmail}
          loginEmail={loginEmail}
          googleAuth={googleAuth}
          onSuccess={handleSuccess}
        />

        {/* Bottom switch */}
        <div className="flex min-h-[67px] items-center justify-center border-t-2 border-[#ffe4ec] bg-[#FFF0F5] px-5">
          {isSignup ? (
            <p className="flex flex-wrap items-center justify-center gap-1.5 text-center text-[14px] font-bold text-[#444]">
              Already have an account?

              <button
                type="button"
                onClick={() => setIsSignup(false)}
                className="flex items-center gap-1 font-black text-[#0055ff] transition hover:underline"
              >
                Log in
                <ArrowRight
                  className="h-4 w-4"
                  strokeWidth={3}
                />
              </button>
            </p>
          ) : (
            <p className="flex flex-wrap items-center justify-center gap-1.5 text-center text-[14px] font-bold text-[#444]">
              New to TerraRun?

              <button
                type="button"
                onClick={() => setIsSignup(true)}
                className="flex items-center gap-1 font-black text-[#ff4b8b] transition hover:underline"
              >
                Create account
                <ArrowRight
                  className="h-4 w-4"
                  strokeWidth={3}
                />
              </button>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

function AuthForm({
  isSignup,
  signupEmail,
  loginEmail,
  googleAuth,
  onSuccess,
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false)

  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (isSignup && !cleanName) {
      setError('Please enter your full name.')
      return
    }

    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    if (isSignup && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)

    try {
      if (isSignup) {
        await signupEmail({
          name: cleanName,
          email: cleanEmail,
          password,
        })
      } else {
        await loginEmail({
          email: cleanEmail,
          password,
        })
      }

      onSuccess()
    } catch (err) {
      setError(
        err?.message ||
        'Something went wrong. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mx-7 mb-4 rounded-[12px] border border-[#f2b5bc] bg-[#fff0f2] px-4 py-2.5 text-[12px] font-bold text-[#b4232f] sm:mx-8">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 px-7 pb-4 sm:px-8">
        {/* Full name — signup only */}
        {isSignup && (
          <div className="relative group">
            <UserRound
              className="absolute left-4 top-1/2 z-10 h-[20px] w-[20px] -translate-y-1/2 text-[#666]"
              strokeWidth={2.4}
            />

            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              required
              className="h-[52px] w-full rounded-[15px] border-2 border-transparent bg-[#f0ece1] pl-12 pr-4 text-[14px] font-bold text-gray-900 shadow-[0_3px_0_#dfdacf] outline-none transition-all placeholder:text-[#909090] focus:border-black/5 focus:bg-[#e8e3d5]"
            />
          </div>
        )}

        {/* Email */}
        <div className="relative group">
          <Mail
            className="absolute left-4 top-1/2 z-10 h-[20px] w-[20px] -translate-y-1/2 text-[#666]"
            strokeWidth={2.4}
          />

          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            required
            className="h-[52px] w-full rounded-[15px] border-2 border-transparent bg-[#f0ece1] pl-12 pr-4 text-[14px] font-bold text-gray-900 shadow-[0_3px_0_#dfdacf] outline-none transition-all placeholder:text-[#909090] focus:border-black/5 focus:bg-[#e8e3d5]"
          />
        </div>

        {/* Password */}
        <div className="relative group">
          <Lock
            className="absolute left-4 top-1/2 z-10 h-[20px] w-[20px] -translate-y-1/2 text-[#666]"
            strokeWidth={2.4}
          />

          <input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={
              isSignup ? 'new-password' : 'current-password'
            }
            required
            className="h-[52px] w-full rounded-[15px] border-2 border-transparent bg-[#f0ece1] pl-12 pr-12 text-[14px] font-bold text-gray-900 shadow-[0_3px_0_#dfdacf] outline-none transition-all placeholder:text-[#909090] focus:border-black/5 focus:bg-[#e8e3d5]"
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword((value) => !value)
            }
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#666] hover:bg-black/5 hover:text-black"
            aria-label="Toggle password visibility"
          >
            {showPassword ? (
              <EyeOff
                className="h-[19px] w-[19px]"
                strokeWidth={2.5}
              />
            ) : (
              <Eye
                className="h-[19px] w-[19px]"
                strokeWidth={2.5}
              />
            )}
          </button>
        </div>

        {/* Confirm password — signup only */}
        {isSignup && (
          <div className="relative group">
            <Lock
              className="absolute left-4 top-1/2 z-10 h-[20px] w-[20px] -translate-y-1/2 text-[#666]"
              strokeWidth={2.4}
            />

            <input
              id="confirm-password"
              type={
                showConfirmPassword ? 'text' : 'password'
              }
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              placeholder="Confirm password"
              autoComplete="new-password"
              required
              className="h-[52px] w-full rounded-[15px] border-2 border-transparent bg-[#f0ece1] pl-12 pr-12 text-[14px] font-bold text-gray-900 shadow-[0_3px_0_#dfdacf] outline-none transition-all placeholder:text-[#909090] focus:border-black/5 focus:bg-[#e8e3d5]"
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword((value) => !value)
              }
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#666] hover:bg-black/5 hover:text-black"
              aria-label="Toggle confirm password visibility"
            >
              {showConfirmPassword ? (
                <EyeOff
                  className="h-[19px] w-[19px]"
                  strokeWidth={2.5}
                />
              ) : (
                <Eye
                  className="h-[19px] w-[19px]"
                  strokeWidth={2.5}
                />
              )}
            </button>
          </div>
        )}

        {/* Login options */}
        {!isSignup && (
          <div className="flex items-center justify-between pt-0.5 pb-1">
            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <button
                type="button"
                onClick={() =>
                  setRememberMe((value) => !value)
                }
                className={`flex h-[21px] w-[21px] items-center justify-center rounded-[6px] shadow-[0_2px_0_rgba(0,0,0,0.1)] ${rememberMe
                    ? 'bg-[#0055ff]'
                    : 'bg-[#dfdacf]'
                  }`}
                aria-label="Toggle remember me"
                aria-pressed={rememberMe}
              >
                {rememberMe && (
                  <Check
                    className="h-[15px] w-[15px] text-white"
                    strokeWidth={4}
                  />
                )}
              </button>

              <span className="text-[14px] font-bold text-[#333]">
                Remember me
              </span>
            </label>

            <button
              type="button"
              onClick={() =>
                setError(
                  'Password recovery is not connected yet.',
                )
              }
              className="text-[13px] font-bold text-[#0055ff] hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Main button */}
        <button
          type="submit"
          disabled={busy}
          className="mt-0.5 flex h-[60px] w-full items-center justify-center gap-3 rounded-[16px] bg-[#ccff00] text-[18px] font-black text-black shadow-[0_5px_0_#99cc00] transition-all hover:translate-y-[2px] hover:shadow-[0_3px_0_#99cc00] active:translate-y-[5px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RunningIcon />

          {busy
            ? 'PLEASE WAIT...'
            : isSignup
              ? 'CREATE ACCOUNT'
              : 'LOG IN'}
        </button>

        {/* OR */}
        <div className="flex items-center gap-4 py-1">
          <div className="h-[2px] flex-1 rounded-full bg-[#dfdacf]" />

          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            OR
          </span>

          <div className="h-[2px] flex-1 rounded-full bg-[#dfdacf]" />
        </div>

        {/* Google only */}
        <div className="flex justify-center pb-0.5">
          <button
            type="button"
            onClick={async () => {
              setError('')

              try {
                await googleAuth()
                handleSuccess()
              } catch (err) {
                setError(
                  err?.message ||
                  'Google sign-in failed. Please try again.',
                )
              }
            }}
            className="group flex h-[62px] w-[62px] items-center justify-center rounded-[17px] border-[1.5px] border-gray-100 bg-white shadow-[0_4px_0_#dfdacf] transition-all hover:translate-y-[2px] hover:shadow-[0_2px_0_#dfdacf] active:translate-y-[4px] active:shadow-none"
            aria-label="Continue with Google"
          >
            <GoogleIcon />
          </button>
        </div>
      </div>
    </form>
  )
}

function RunningIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle
        cx="13"
        cy="4"
        r="2"
      />
      <path d="M13 6.5v5l3.5 3.5" />
      <path d="M10.5 16.5 8 11.5l3.5-3" />
      <path d="M13 11.5l-3 6 2.5 4" />
      <path d="M12.5 17.5l-4.5 4" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l2.85-2.22.83-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}