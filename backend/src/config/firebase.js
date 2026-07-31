import admin from 'firebase-admin';

// Lazy singleton — only initialized the first time a phone-auth request
// actually comes in, so the rest of the app (email/password auth, etc.)
// works fine even before Firebase env vars are configured.
let firebaseApp = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // .env files can't hold real newlines — the downloaded service-account
  // JSON's private_key has literal "\n" sequences; un-escape them here.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and ' +
        'FIREBASE_PRIVATE_KEY in backend/.env — see the setup comment block at the top of ' +
        'backend/src/controllers/authController.js.'
    );
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return firebaseApp;
}

// Verifies a Firebase Phone Auth ID token (obtained on the frontend after
// OTP verification) and returns its decoded claims, including phone_number.
export async function verifyFirebaseIdToken(idToken) {
  const app = getFirebaseApp();
  return admin.auth(app).verifyIdToken(idToken);
}
