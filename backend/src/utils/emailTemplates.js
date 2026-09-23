// PHASE 11 — HTML email templates.
//
// One reusable "shell" (renderEmailShell) owns the header/footer/branding
// every email would share, so a future email (a real verification email, an
// invasion-alert digest, whatever) doesn't have to re-copy the same
// boilerplate — only buildWeeklyReportEmail() below is phase-specific.
//
// Inline styles throughout (not a <style> block) because most email
// clients strip or ignore <style> tags — this is the one place in the app
// where that's the right call, unlike the rest of the Tailwind-based UI.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function formatDistanceKm(km) {
  return `${(km || 0).toFixed(2)} km`;
}

function formatCalories(cal) {
  return `${Math.round(cal || 0).toLocaleString()} kcal`;
}

function formatCalons(c) {
  return Math.round(c || 0).toLocaleString();
}

// Mirrors frontend/src/pages/Map.jsx's formatArea (hectares above 1 ha) —
// duplicated rather than shared, since the frontend and backend are
// separate packages with no shared utils module (same call this codebase
// already makes elsewhere, e.g. TerritorySplitModal.jsx's own formatArea copy).
function formatArea(sqm) {
  const v = Math.abs(sqm || 0);
  if (v >= 10000) return `${(v / 10000).toFixed(2)} ha`;
  return `${Math.round(v).toLocaleString()} m²`;
}

function formatSignedArea(sqm) {
  if (!sqm) return '±0 m²';
  const sign = sqm > 0 ? '+' : '−';
  return `${sign}${formatArea(sqm)}`;
}

function formatRank(rank, total) {
  if (rank == null || total == null) return '—';
  return `#${rank} of ${total}`;
}

function statRow(label, value, valueColor = '#101614') {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e7efec;color:#58756c;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e7efec;color:${valueColor};font-size:14px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;
}

/**
 * Shared page shell — header badge/title, a content slot, and a footer.
 * `bodyHtml`/`footerHtml` are trusted, pre-built HTML — callers are
 * responsible for escaping any raw user input before handing it in (see
 * escapeHtml above).
 */
function renderEmailShell({ preheader = '', headerEyebrow, headerTitle, bodyHtml, footerHtml }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(headerTitle)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f5f4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <!-- Preheader: hidden preview text shown in inbox lists, not the email body -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="text-align:center;padding-bottom:18px;">
        <span style="font-size:18px;font-weight:700;color:#101614;letter-spacing:-0.01em;">🟢 TerraRun</span>
      </div>

      <div style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(16,22,20,0.08);">
        <div style="background:#101614;padding:22px 26px;">
          <p style="margin:0;color:#5eead4;font-size:11px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;">
            ${escapeHtml(headerEyebrow)}
          </p>
          <h1 style="margin:6px 0 0;color:#ffffff;font-size:21px;line-height:1.3;">${escapeHtml(headerTitle)}</h1>
        </div>
        <div style="padding:26px;">
          ${bodyHtml}
        </div>
      </div>

      <div style="text-align:center;color:#9aa8a3;font-size:12px;line-height:1.6;margin-top:18px;padding:0 12px;">
        ${footerHtml || ''}
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Builds the Phase 11 weekly report email. `data` is the shape returned by
 * utils/weeklyReportEngine.js's compileWeeklyReportForUser(), plus `name`,
 * `weekLabel` (a human-readable date range), and `appUrl`, mixed in by the
 * job.
 */
export function buildWeeklyReportEmail(data) {
  const {
    name,
    weekLabel,
    distanceKm,
    calories,
    runCount,
    calonsEarned,
    areaGainedSqm,
    areaLostSqm,
    netAreaChangeSqm,
    friendsRank,
    friendsTotal,
    regionalRank,
    regionalTotal,
    region,
    appUrl,
  } = data;

  const hadAnyRuns = (runCount || 0) > 0;

  const introLine = hadAnyRuns
    ? `Here's how your week of ${escapeHtml(weekLabel)} went.`
    : `No runs logged for ${escapeHtml(weekLabel)} — your territory doesn't defend itself! Lace up and reclaim some ground this week.`;

  const statsTable = `
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      ${statRow('Distance covered', formatDistanceKm(distanceKm))}
      ${statRow('Calories burnt', formatCalories(calories))}
      ${statRow('Runs logged', String(runCount || 0))}
      ${statRow('Calons earned', formatCalons(calonsEarned), '#0d9488')}
    </table>`;

  const netColor = netAreaChangeSqm > 0 ? '#0d9488' : netAreaChangeSqm < 0 ? '#d97706' : '#101614';
  const territoryTable = `
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      ${statRow('Territory gained', formatArea(areaGainedSqm), '#0d9488')}
      ${statRow('Territory lost', formatArea(areaLostSqm), areaLostSqm > 0 ? '#d97706' : '#101614')}
      ${statRow('Net change', formatSignedArea(netAreaChangeSqm), netColor)}
    </table>
    <p style="margin:8px 0 0;color:#9aa8a3;font-size:11px;line-height:1.5;">
      Territory lost from invasions and splits is tracked here; gradual decay
      from inactivity isn't broken out separately yet — check the map for
      your territories' current health.
    </p>`;

  const friendsLine =
    friendsRank != null
      ? statRow('Friends leaderboard', formatRank(friendsRank, friendsTotal))
      : statRow('Friends leaderboard', 'Follow a runner to compare!', '#58756c');

  const regionalLine =
    regionalRank != null
      ? statRow('Regional leaderboard', formatRank(regionalRank, regionalTotal))
      : statRow('Regional leaderboard', region ? '—' : 'Set your region in Settings', '#58756c');

  const rankTable = `
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      ${friendsLine}
      ${regionalLine}
    </table>`;

  const ctaButton = `
    <div style="text-align:center;margin-top:22px;">
      <a href="${appUrl}" style="display:inline-block;background:#34d399;color:#0b0f0e;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px;">
        Open TerraRun
      </a>
    </div>`;

  const bodyHtml = `
    <p style="margin:0 0 4px;color:#101614;font-size:16px;">Hey ${escapeHtml(name)},</p>
    <p style="margin:0 0 20px;color:#58756c;font-size:14px;line-height:1.5;">${introLine}</p>

    <h2 style="margin:0 0 6px;color:#101614;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">This week</h2>
    ${statsTable}

    <h2 style="margin:22px 0 6px;color:#101614;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Territory</h2>
    ${territoryTable}

    <h2 style="margin:22px 0 6px;color:#101614;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">Rankings</h2>
    ${rankTable}

    ${ctaButton}
  `;

  const footerHtml = `
    You're receiving this because weekly email reports are on for your TerraRun account.
    <a href="${appUrl}/profile" style="color:#58756c;">Manage email preferences</a> anytime from your profile.
  `;

  return renderEmailShell({
    preheader: `Your TerraRun week: ${formatDistanceKm(distanceKm)}, ${formatCalons(calonsEarned)} Calons earned.`,
    headerEyebrow: 'Weekly Report',
    headerTitle: weekLabel,
    bodyHtml,
    footerHtml,
  });
}