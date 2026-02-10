const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

/**
 * Admin whitelist: comma-separated emails. Set via:
 * firebase functions:config:set admin.whitelist="admin@example.com,manager@example.com"
 */
function getAdminWhitelist() {
  const raw = process.env.ADMIN_WHITELIST || functions.config().admin?.whitelist || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * App URL where users land after clicking the magic link (must match Firebase Auth authorized domains).
 * Set via: firebase functions:config:set app.url="https://url.taipei"
 */
function getAppUrl() {
  return process.env.APP_URL || functions.config().app?.url || 'https://url.taipei';
}

/**
 * Create nodemailer transport from config.
 * Set via: firebase functions:config:set smtp.user="..." smtp.pass="..." smtp.from="..."
 * Or use SMTP_URL env (e.g. smtp://user:pass@smtp.gmail.com:587) if supported.
 */
function getMailTransport() {
  const user = process.env.SMTP_USER || functions.config().smtp?.user;
  const pass = process.env.SMTP_PASS || functions.config().smtp?.pass;
  const host = process.env.SMTP_HOST || functions.config().smtp?.host || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || functions.config().smtp?.port || '587');
  if (!user || !pass) {
    throw new Error('SMTP not configured: set smtp.user and smtp.pass (or SMTP_USER, SMTP_PASS)');
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
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
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

  const from = process.env.SMTP_FROM || functions.config().smtp?.from || process.env.SMTP_USER || functions.config().smtp?.user;
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
