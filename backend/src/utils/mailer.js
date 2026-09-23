import nodemailer from 'nodemailer';

// PHASE 11 — thin wrapper around Nodemailer so job files (and any future
// phase that wants to send mail — a real email-verification flow, say)
// don't each reinvent transporter setup. Lazily created on first send, same
// singleton pattern as config/firebase.js's getFirebaseApp().

let transporter = null;
let warnedMissingConfig = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  // Deliberately does NOT throw here (unlike config/firebase.js's Firebase
  // Admin setup) — a missing SMTP config shouldn't crash the whole cron job
  // for every user. sendMail() below just no-ops and reports it; the job
  // logs how many were skipped so it's obvious in the console why no mail
  // went out.
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (!warnedMissingConfig) {
      console.warn(
        '[mailer] SMTP_HOST / SMTP_USER / SMTP_PASS are not set in backend/.env — ' +
          'weekly report emails will be skipped. See backend/.env.example for the ' +
          'Phase 11 SMTP_* vars (any provider works: Gmail app password, Resend, ' +
          'Brevo, or Ethereal for local testing without sending real mail).'
      );
      warnedMissingConfig = true;
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    // true only for the implicit-TLS port (465) — 587/25 use STARTTLS,
    // which nodemailer negotiates automatically when secure: false.
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

/**
 * @returns {{ sent: boolean, reason?: string }} — never throws for the
 * missing-config case (that's a deliberate no-op, not an error); DOES
 * propagate a real send failure (bad credentials, provider rejected the
 * message, etc.) so the caller's try/catch can log it per-recipient
 * instead of one bad address silently eating the whole job.
 */
export async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) return { sent: false, reason: 'SMTP not configured' };

  const from = process.env.EMAIL_FROM || 'TerraRun <no-reply@terrarun.app>';
  await t.sendMail({ from, to, subject, html });
  return { sent: true };
}