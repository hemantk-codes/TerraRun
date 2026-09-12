// PHASE 10 — tiny singleton so any module (controllers, cron jobs, utils
// deep in invasionEngine/splitEngine/decayEngine) can emit a Socket.io
// event without importing sockets/index.js directly (which would also
// re-run initSocket()'s setup). sockets/index.js calls setIO() exactly
// once, right after constructing the real Server instance; everyone else
// calls getIO() and gets that same instance back.
//
// getIO() returns null before initSocket() has run, or inside a
// standalone script that never calls it at all (scripts/triggerCalonsReset.js,
// scripts/verifyPhase7.js, etc.). notificationService.js treats a null IO
// as "nobody's listening right now", not an error — the Notification
// document still gets written either way, only the live push is skipped.
let io = null;

export function setIO(instance) {
  io = instance;
}

export function getIO() {
  return io;
}
