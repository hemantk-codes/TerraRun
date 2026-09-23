// PHASE 11 fix — single source of truth for "which Monday-to-Monday week
// did this fall in", shared by the Phase 5 Calons reset job and the Phase
// 11 weekly report job. Anchored to the most recent Monday regardless of
// what day `now` actually is, so a manual/off-schedule trigger always
// agrees with the real Monday-00:00 cron on week boundaries. No change in
// behavior when `now` genuinely is a Monday (the real cron's case) — both
// old and new formulas agree exactly there.

export function getMostRecentMonday(now = new Date()) {
  const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

/** [weekStart, weekEnd) for the most recently CLOSED Monday-to-Monday week. */
export function getJustEndedWeekRange(now = new Date()) {
  const weekEnd = getMostRecentMonday(now);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 7);
  return { weekStart, weekEnd };
}

export function getPreviousWeekStart(justEndedWeekStart) {
  return new Date(justEndedWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
}