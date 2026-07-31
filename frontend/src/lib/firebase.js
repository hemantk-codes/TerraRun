import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
)

// Only initialized on first use, and only if configured — this lets
// email/password auth work out of the box even before you've done the
// Firebase console setup (see the comment block in
// backend/src/controllers/authController.js), since phone auth is the only
// thing that needs it.
let authInstance = null

export function getFirebaseAuth() {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase is not configured yet — set VITE_FIREBASE_* in frontend/.env.local (see frontend/.env.example).'
    )
  }
  if (!authInstance) {
    const app = getApps()[0] ?? initializeApp(firebaseConfig)
    authInstance = getAuth(app)
  }
  return authInstance
}
