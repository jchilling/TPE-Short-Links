/**
 * Copy this file to config.secret.js and fill in your values.
 * config.secret.js is gitignored and is deployed with the function when you run firebase deploy.
 * Do not commit config.secret.js (it contains secrets).
 */
module.exports = {
  adminWhitelist: 'admin@example.com,manager@example.com',
  appUrl: 'https://url.taipei',
  smtp: {
    user: 'your@gmail.com',
    pass: 'your-app-password',
    from: 'noreply@yourdomain.com',
    host: 'smtp.gmail.com',
    port: 587,
  },
};
