// passwordHash is already excluded by default (schema has `select: false`),
// but strip it defensively in case a future query opts back in with
// .select('+passwordHash') and forgets to sanitize before responding.
export function sanitizeUser(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.passwordHash;
  delete user.refreshTokenVersion;
  delete user.__v;
  return user;
}
