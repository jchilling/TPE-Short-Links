const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// v2 (2nd Gen) does not support functions.config(); use env vars only.
// Load .env from this directory (works for emulator and for deploy if .env is included in the bundle).
require('dotenv').config();

admin.initializeApp();

/**
 * Admin whitelist: comma-separated emails.
 * In v2 (Cloud Run) set env var ADMIN_WHITELIST (e.g. in Firebase Console or .env).
 */
function getAdminWhitelist() {
  const raw = process.env.ADMIN_WHITELIST || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * App URL where users land after clicking the magic link (must match Firebase Auth authorized domains).
 * In v2 set env var APP_URL.
 */
function getAppUrl() {
  return process.env.APP_URL || 'https://url.taipei';
}

/**
 * Create nodemailer transport. In v2 set env vars: SMTP_USER, SMTP_PASS, optional SMTP_HOST, SMTP_PORT, SMTP_FROM.
 */
function getMailTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || '587');
  if (!user || !pass) {
    throw new Error('SMTP not configured: set SMTP_USER and SMTP_PASS env vars');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Send admin magic-link email. Callable from the frontend.
 * 1. Checks email against admin whitelist.
 * 2. Generates sign-in link with Firebase Auth.
 * 3. Sends email with the link.
 */
exports.sendAdminLoginLink = functions.https.onCall(async (data, context) => {
  // Callable can receive payload as data.email (1st gen) or data.data.email (2nd gen / wrapped)
  const rawEmail = data?.email ?? data?.data?.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required');
  }

  const whitelist = getAdminWhitelist();
  if (whitelist.length === 0) {
    throw new functions.https.HttpsError('failed-precondition', 'Admin whitelist not configured');
  }
  if (!whitelist.includes(email)) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }

  const appUrl = getAppUrl();
  const actionCodeSettings = {
    url: appUrl,
    handleCodeInApp: true,
  };
  const link = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transport = getMailTransport();
  await transport.sendMail({
    from: from,
    to: email,
    subject: 'TPE Short Links – Admin login link',
    html: `
      <p>You requested an admin login link for TPE Short Links.</p>
      <p><a href="${link}">Click here to sign in</a></p>
      <p>This link is one-time use. If you did not request this, you can ignore this email.</p>
    `,
  });

  return { success: true };
});
