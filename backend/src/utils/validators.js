export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Tunable: password strength policy. Kept simple (length only) for a
// student project — swap in a real strength check (e.g. zxcvbn) later.
export function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

export function isValidHexColor(color) {
  return typeof color === 'string' && /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(color);
}
