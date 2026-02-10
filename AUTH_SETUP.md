# Firebase Admin Authentication Setup

This app uses **Option 1: Magic Link** from `firebase_authentication.md`. Only whitelisted admin emails can request a login link; clicking the link signs them in with Firebase Auth. All `/api/*` routes require a valid Firebase ID token when `FIREBASE_APP_ID` is set.

---

## 1. Firebase Console

1. **Create or use a Firebase project** and note the **Project ID** and **Web app** (if you don’t have one, add a Web app in Project settings).

2. **Enable Email/Password sign-in method**
   - Authentication → Sign-in method → Email/Password → Enable, then **Save**.
   - Under “Email link (passwordless sign-in)”, enable **Email link** so magic links work.

3. **Authorized domains**
   - Authentication → Settings → Authorized domains.
   - Add your frontend origin (e.g. `url.taipei`, `url-taipei.web.app`, `localhost` for dev).

4. **Get Web app config**
   - Project settings → Your apps → Web app → copy:
     - `apiKey`, `authDomain`, `projectId`, `appId`.
   - Use these in the frontend `.env` (see below). The **appId** is also used in the backend as `FIREBASE_APP_ID` for token verification.

---

## 2. Frontend environment

In `frontend/.env` (and `frontend/.env.production` for production build):

```env
VITE_API_BASE_URL=https://your-backend-url
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

---

## 3. Backend environment

- **Local dev (no auth):** Leave `FIREBASE_APP_ID` unset. API calls are not checked.
- **Production (auth required):** Set the same Web app **App ID** as in the frontend:

```env
FIREBASE_APP_ID=1:123456789:web:abcdef
# Optional, for reference:
# FIREBASE_PROJECT_ID=your-project-id
```

---

## 4. Cloud Function: admin whitelist and email

The callable function `sendAdminLoginLink`:

1. Checks the given email against an **admin whitelist**.
2. Generates a Firebase Auth sign-in link.
3. Sends the link by email via **SMTP**.

### 4.1 Admin whitelist

Set a comma-separated list of allowed admin emails:

```bash
firebase functions:config:set admin.whitelist="admin@example.com,manager@example.com"
```

Or with Firebase Functions env (Node 18+):

```bash
# In functions/.env (do not commit)
ADMIN_WHITELIST=admin@example.com,manager@example.com
```

### 4.2 App URL (where the magic link opens)

```bash
firebase functions:config:set app.url="https://url.taipei"
```

Or in `functions/.env`: `APP_URL=https://url.taipei`

### 4.3 SMTP (sending the email)

Configure your SMTP provider (e.g. Gmail with an app password):

```bash
firebase functions:config:set smtp.user="your@gmail.com" smtp.pass="your-app-password" smtp.from="noreply@yourdomain.com"
```

Optional: `smtp.host` (default `smtp.gmail.com`), `smtp.port` (default `587`).

Or in `functions/.env`:

```env
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

---

## 5. Deploy

1. **Install and deploy Cloud Functions**
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

2. **Backend:** Set `FIREBASE_APP_ID` in production env and redeploy (e.g. Cloud Run).

3. **Frontend:** Set the Firebase env vars, build, then:
   ```bash
   firebase deploy --only hosting
   ```

---

## 6. Flow summary

- User opens the app → if not signed in, they are sent to **/login**.
- On **/login**, they enter their email and click “Send login link”.
- Frontend calls the callable **sendAdminLoginLink**; the function checks the whitelist, generates the link, and sends the email.
- User clicks the link in the email → they land on your app → Firebase completes sign-in (`signInWithEmailLink`).
- After sign-in, the frontend sends the Firebase ID token in `Authorization: Bearer <token>` on every API request.
- Backend (when `FIREBASE_APP_ID` is set) verifies the token with `google.oauth2.id_token.verify_firebase_token` and rejects unauthenticated requests with 401.
