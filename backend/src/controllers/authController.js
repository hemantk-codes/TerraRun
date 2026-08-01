import { User } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { sanitizeUser } from '../utils/sanitizeUser.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../utils/cookies.js';
import { isValidEmail, isStrongPassword } from '../utils/validators.js';
import { verifyFirebaseIdToken } from '../config/firebase.js';

/*
 * ───────────────────────────────────────────────────────────────────────
 * FIREBASE CONSOLE SETUP — do this manually, once, before phone signup
 * will work. None of this is code; it's clicking around console.firebase.google.com.
 * ───────────────────────────────────────────────────────────────────────
 * 1. Go to https://console.firebase.google.com → create a project (or
 *    reuse one you already have).
 * 2. Build > Authentication > Get started > Sign-in method tab >
 *    enable the "Phone" provider.
 * 3. Authentication > Settings > Authorized domains — add your deployed
 *    frontend domain when you get to Phase 13 (localhost is allowed by
 *    default, so local dev needs nothing extra here).
 * 4. Project settings (gear icon, top-left) > General tab > "Your apps" >
 *    click the web icon (</>) to register a web app. Copy the resulting
 *    config object's apiKey / authDomain / projectId / appId — these are
 *    NOT secret, they go in frontend/.env.local as VITE_FIREBASE_* (see
 *    frontend/.env.example).
 * 5. Project settings > Service accounts tab > "Generate new private key".
 *    This downloads a JSON file — its contents ARE secret. From it, copy
 *    into backend/.env:
 *      FIREBASE_PROJECT_ID   = the JSON's "project_id"
 *      FIREBASE_CLIENT_EMAIL = the JSON's "client_email"
 *      FIREBASE_PRIVATE_KEY  = the JSON's "private_key" (keep the literal
 *                               "\n" characters — backend/src/config/
 *                               firebase.js un-escapes them at runtime)
 * 6. Phone auth requires an invisible reCAPTCHA challenge on the frontend
 *    before it'll send an SMS — the Phase 1 frontend code sets this up
 *    automatically via Firebase's RecaptchaVerifier, no extra console step.
 * 7. Firebase's phone-auth free tier has a monthly SMS quota that varies by
 *    country and changes over time — check the current numbers on the
 *    Firebase pricing page before a public demo, and note that Google also
 *    provides a small set of test phone numbers (Authentication > Sign-in
 *    method > Phone > "Phone numbers for testing") that skip real SMS
 *    entirely — very useful for your own testing and for the viva.
 * ───────────────────────────────────────────────────────────────────────
 */

// Signs both tokens for a user and sets the refresh token as an httpOnly
// cookie on the response. Returns the access token to send in the JSON body.
function issueSession(user, res) {
  const accessToken = signAccessToken({ sub: user._id.toString() });
  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    tokenVersion: user.refreshTokenVersion,
  });
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

export async function signupEmail(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) throw new ApiError(400, 'Name is required.');
    if (!isValidEmail(email)) throw new ApiError(400, 'A valid email is required.');
    if (!isStrongPassword(password)) {
      throw new ApiError(400, 'Password must be at least 8 characters.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) throw new ApiError(409, 'An account with that email already exists.');

    console.log("SIGNUP password received:", JSON.stringify(password));

    const passwordHash = await hashPassword(password);

    console.log("Generated hash:", passwordHash);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    const accessToken = issueSession(user, res);
    res.status(201).json({ user: sanitizeUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

export async function loginEmail(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!isValidEmail(email) || !password) {
      throw new ApiError(400, 'Email and password are required.');
    }

    // passwordHash has `select: false` on the schema — opt back in here only.
    const user = await User.findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash +refreshTokenVersion');

    console.log("===== LOGIN DEBUG =====");
    console.log("Email:", email);
    console.log("User found:", !!user);
    console.log("Stored hash:", user?.passwordHash);

    // Same generic message whether the email doesn't exist or the account
    // is phone-only (no passwordHash) — don't leak which case it was.
    if (!user || !user.passwordHash) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const matches = await comparePassword(password, user.passwordHash);

    console.log("Password entered:", password);
    console.log("Password matches:", matches);

    if (!matches) throw new ApiError(401, 'Invalid email or password.');

    const accessToken = issueSession(user, res);
    res.status(200).json({ user: sanitizeUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

// Handles BOTH signup and login for phone users — Firebase Phone Auth is
// passwordless, so there's nothing to distinguish them by except "does a
// User with this phone number already exist".
export async function phoneAuth(req, res, next) {
  try {
    const { idToken, name } = req.body;
    if (!idToken) throw new ApiError(400, 'idToken is required.');

    let decoded;
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch {
      throw new ApiError(401, 'Invalid or expired phone verification token.');
    }

    const phone = decoded.phone_number;
    if (!phone) throw new ApiError(400, 'That verification token has no phone number attached.');

    let user = await User.findOne({ phone }).select('+refreshTokenVersion');
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        name: (name && name.trim()) || `Runner ${phone.slice(-4)}`,
        phone,
      });
    }

    const accessToken = issueSession(user, res);
    res.status(isNewUser ? 201 : 200).json({ user: sanitizeUser(user), accessToken, isNewUser });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) throw new ApiError(401, 'No refresh token — please log in again.');

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      clearRefreshCookie(res);
      throw new ApiError(401, 'Refresh token expired or invalid — please log in again.');
    }

    // refreshTokenVersion has `select: false` on the schema — opt back in.
    const user = await User.findById(payload.sub).select('+refreshTokenVersion');
    // tokenVersion mismatch means this refresh token was issued before a
    // logout (or other invalidation) — reject it even though its signature
    // and expiry are still valid.
    if (!user || user.refreshTokenVersion !== payload.tokenVersion) {
      clearRefreshCookie(res);
      throw new ApiError(401, 'Session no longer valid — please log in again.');
    }

    const accessToken = signAccessToken({ sub: user._id.toString() });
    res.status(200).json({ user: sanitizeUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        // Bumping refreshTokenVersion invalidates every refresh token ever
        // issued to this user, not just this one — fine for a v1 "log out"
        // (logs out all devices), simpler than tracking tokens individually.
        await User.findByIdAndUpdate(payload.sub, { $inc: { refreshTokenVersion: 1 } });
      } catch {
        // Already invalid/expired — nothing to invalidate, just clear the cookie.
      }
    }
    clearRefreshCookie(res);
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}
