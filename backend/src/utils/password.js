import bcrypt from 'bcryptjs';

// Tunable: bcrypt cost factor. 12 is a reasonable default in 2026 (slower =
// more brute-force resistant, but slower logins/signups too).
const SALT_ROUNDS = 12;

export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
