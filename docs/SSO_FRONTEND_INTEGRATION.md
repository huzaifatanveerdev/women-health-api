# women-help-api Mobile App — Authentication Guide for Frontend Developers

This guide explains how to connect the React Native app to the women-help-api backend for:

- Email sign-up and login (with password)
- Google and Apple sign-in (SSO)
- Completing the cycle onboarding profile after SSO
- Forgot password (email accounts only)

**You do not need Firebase.** The app gets a token from Google/Apple, sends it to our API, and receives a JWT (same as email login).

---

## Table of contents

1. [Big picture](#1-big-picture)
2. [Setup in the app](#2-setup-in-the-app)
3. [API base URL and headers](#3-api-base-url-and-headers)
4. [Standard response format](#4-standard-response-format)
5. [Email registration flow](#5-email-registration-flow)
6. [Email login flow](#6-email-login-flow)
7. [Google / Apple SSO — login vs signup](#7-google--apple-sso--login-vs-signup)
8. [Complete profile after SSO (login edge cases)](#8-complete-profile-after-sso-login-edge-cases)
9. [Forgot password flow](#9-forgot-password-flow)
10. [After login: checking profile and settings](#10-after-login-checking-profile-and-settings)
11. [Which screens to change](#11-which-screens-to-change)
12. [RTK Query / API file changes](#12-rtk-query--api-file-changes)
13. [Error messages users may see](#13-error-messages-users-may-see)
14. [Testing checklist](#14-testing-checklist)

---

## 1. Big picture

There are **three ways** a user can authenticate:

| Method | How the user signs in | Password in our DB? |
|--------|------------------------|---------------------|
| Email | Email + password | Yes |
| Google | Google button → `idToken` → our API | No |
| Apple | Apple button → `idToken` → our API | No |

Every successful login or registration returns:

- A **JWT** (`data.token`) — store this and send it on protected requests as `Authorization: Bearer <token>`.
- **`authProvider`** — `"email"`, `"google"`, or `"apple"`.
- **`isProfileComplete`** — `true` or `false`.

For **SSO signup**, send `personalization` with the signup request (user fills the personalization screen first). For **SSO login**, if `isProfileComplete` is still `false` (older accounts), use [section 8](#8-complete-profile-after-sso-login-edge-cases).

```text
User opens app
    → Has valid token?
        → GET /api/users/me
        → isProfileComplete false? → Show onboarding form
        → else → Home
    → No token → Startup / Login
        → Email / Google / Apple
        → Save token + check isProfileComplete
```

---

## 2. Setup in the app

### Libraries to install

```bash
yarn add @react-native-google-signin/google-signin
yarn add @invertase/react-native-apple-authentication
```

Follow each library’s README for iOS/Android native setup (GoogleService-Info.plist, URL schemes, Apple capability “Sign in with Apple”, etc.).

### IDs must match the backend

Ask the backend team for these values (they live in server `.env`):

| Env variable (backend) | Your app config |
|------------------------|-----------------|
| `GOOGLE_CLIENT_ID_IOS` | iOS Google Sign-In web client ID |
| `GOOGLE_CLIENT_ID_ANDROID` | Android client ID |
| `APPLE_BUNDLE_ID` | iOS bundle identifier (e.g. `com.company.women-help-api`) |

If IDs do not match, SSO will fail with “Invalid or expired sign-in token”.

---

## 3. API base URL and headers

Use the same base URL as today (staging/production).

On **every** request:

```http
Content-Type: application/json
Accept-Language: en
```

Use `de` for German when the app language is German.

For protected routes, add:

```http
Authorization: Bearer <jwt_from_login>
```

---

## 4. Standard response format

### Success

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { }
}
```

### Error

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

Show `message` in a toast or alert. Status codes: `400` validation, `401` auth, `500` server.

---

## 5. Email registration flow

**Unchanged overall flow** — still OTP first, then register.

### Step 1 — Request OTP

```http
POST /api/auth/request-otp
```

```json
{ "email": "user@example.com" }
```

### Step 2 — Verify OTP

```http
POST /api/auth/verify-otp
```

```json
{ "email": "user@example.com", "otp": "123456" }
```

Save `data.tempToken` for the next step.

### Step 3 — Register

```http
POST /api/auth/register
```

```json
{
  "name": "Jane Doe",
  "email": "user@example.com",
  "password": "Password1!",
  "confirmPassword": "Password1!",
  "tempToken": "<from step 2>",
  "personalization": {
    "lastPeriodStartDate": "2025-01-15",
    "averageMenstrualCycleLength": "28",
    "averagePeriodDuration": 5
  }
}
```

**All three `personalization` fields are required** for email registration.

### Step 4 — Handle response

```json
{
  "success": true,
  "data": {
    "user": { "authProvider": "email", ... },
    "token": "eyJ...",
    "authProvider": "email",
    "isProfileComplete": true
  }
}
```

- Save `data.token` (Redux + persist, same as today).
- `isProfileComplete` should be `true` → go to main app (or your existing success screen).

---

## 6. Email login flow

```http
POST /api/auth/login
```

```json
{
  "email": "user@example.com",
  "password": "Password1!"
}
```

**Success (200)** — same shape as register: `token`, `authProvider`, `isProfileComplete`.

**If account is Google/Apple only (401):**

Message like: *“Please sign in with Google or Apple”*

→ Do not show password field as the fix; guide user to SSO buttons on Startup.

---

## 7. Google / Apple SSO — login vs signup

SSO is split into **two endpoints**. Use the correct one for each screen:

| Screen / intent | Endpoint | Behavior |
|-----------------|----------|----------|
| **Login** (Startup “Sign in with Google/Apple”) | `POST /api/auth/sso/login` | Active account only. Never creates or reactivates users. |
| **Signup** (after personalization, then Google/Apple) | `POST /api/auth/sso/signup` | Creates new user or reactivates deleted user. Never logs in an existing active user. |

Legacy alias: `POST /api/auth/sso` behaves the same as `/sso/login` (login only).

### Step 1 — Native sign-in (both flows)

**Google (example):**

```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

await GoogleSignin.hasPlayServices();
const response = await GoogleSignin.signIn();
const idToken = response.data?.idToken;
```

**Apple (iOS):** use `@invertase/react-native-apple-authentication` to get `identityToken` (JWT string).

`provider` must be exactly `"google"` or `"apple"`.

---

### 7A. SSO login — `POST /api/auth/sso/login`

**When:** User is on the **login** screen and taps Google/Apple.

#### Request

```http
POST /api/auth/sso/login
Content-Type: application/json
Accept-Language: en
```

```json
{
  "provider": "google",
  "idToken": "<idToken from Google or Apple>"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `provider` | Yes | `"google"` or `"apple"` |
| `idToken` | Yes | JWT from native SDK |

#### Success (200)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "674a...",
      "name": "Jane Doe",
      "email": "user@example.com",
      "phone": null,
      "gender": null,
      "dob": null,
      "profilePicture": null,
      "personalization": {
        "lastPeriodStartDate": "2025-01-15T00:00:00.000Z",
        "averageMenstrualCycleLength": "28",
        "averagePeriodDuration": 5
      },
      "settings": { "periodStartReminder": false, "cycleInsightWeekly": false, "language": "en" },
      "authProvider": "google",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "authProvider": "google",
    "isProfileComplete": true
  }
}
```

Save `data.token`. If `isProfileComplete` is `false`, go to personalization (section 8). Otherwise go to Home.

#### Failure responses

| HTTP | `message` (EN) | When |
|------|----------------|------|
| **400** | Provider and idToken are required | Missing `provider` or `idToken` |
| **400** | Invalid SSO provider. Use google or apple | `provider` not `google` / `apple` |
| **401** | Invalid or expired sign-in token | Token verification failed |
| **401** | No account found. Please sign up first | No active user for this email/sub (includes soft-deleted accounts — same message, no disclosure) |
| **401** | This email is registered with a password. Please sign in with email and password | Active **email** account; user tried Google/Apple login |
| **401** | This email is registered with a different sign-in method | Active account with other SSO provider (e.g. Google account, Apple login) |
| **500** | SSO is not configured on the server | Missing Google/Apple env on server |

**Example — no account or deleted account (401):**

Same response in both cases (deleted users are not distinguished):

```json
{
  "success": false,
  "message": "No account found. Please sign up first"
}
```

**Example — email account conflict (401):**

```json
{
  "success": false,
  "message": "This email is registered with a password. Please sign in with email and password"
}
```

**Example — missing fields (400):**

```json
{
  "success": false,
  "message": "Provider and idToken are required",
  "errors": []
}
```

---

### 7B. SSO signup — `POST /api/auth/sso/signup`

**When:** User completed the **personalization** screen, then chooses Google/Apple on the signup screen.

**All three `personalization` fields are required** (same as email register).

#### Request

```http
POST /api/auth/sso/signup
Content-Type: application/json
Accept-Language: en
```

```json
{
  "provider": "google",
  "idToken": "<idToken from Google or Apple>",
  "personalization": {
    "lastPeriodStartDate": "2025-01-15",
    "averageMenstrualCycleLength": "28",
    "averagePeriodDuration": 5
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `provider` | Yes | `"google"` or `"apple"` |
| `idToken` | Yes | JWT from native SDK |
| `personalization` | Yes | All three fields below |
| `personalization.lastPeriodStartDate` | Yes | ISO date string, e.g. `"2025-01-15"` |
| `personalization.averageMenstrualCycleLength` | Yes | String, e.g. `"28"` |
| `personalization.averagePeriodDuration` | Yes | Number &gt; 0, e.g. `5` |

#### Success (201)

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "674a...",
      "name": "Jane Doe",
      "email": "user@example.com",
      "personalization": {
        "lastPeriodStartDate": "2025-01-15T00:00:00.000Z",
        "averageMenstrualCycleLength": "28",
        "averagePeriodDuration": 5
      },
      "authProvider": "google",
      "settings": { "periodStartReminder": false, "cycleInsightWeekly": false, "language": "en" }
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "authProvider": "google",
    "isProfileComplete": true
  }
}
```

After signup, `isProfileComplete` should be **`true`** → save token and go to Home.

#### Failure responses

| HTTP | `message` (EN) | When |
|------|----------------|------|
| **400** | Provider and idToken are required | Missing `provider` or `idToken` |
| **400** | Invalid SSO provider. Use google or apple | Bad `provider` |
| **400** | Please complete all required profile fields | Missing or invalid `personalization` |
| **400** | Validation error | Mongoose validation on user fields (`errors` array may be present) |
| **401** | Invalid or expired sign-in token | Token verification failed |
| **401** | An account with this email already exists. Please log in | Active user already exists (any provider) — use **login** |
| **401** | Email is required on first sign-in with Apple | New signup but Apple token has no email (first Apple sign-in must share email) |
| **500** | SSO is not configured on the server | Server env missing |
| **500** | Failed to create user | Unexpected DB error on create/reactivate |

**Example — account already exists (401):**

```json
{
  "success": false,
  "message": "An account with this email already exists. Please log in"
}
```

**Example — incomplete personalization (400):**

```json
{
  "success": false,
  "message": "Please complete all required profile fields",
  "errors": [
    "personalization.lastPeriodStartDate is required",
    "personalization.averageMenstrualCycleLength is required",
    "personalization.averagePeriodDuration is required"
  ]
}
```

**Example — missing provider/idToken (400):**

```json
{
  "success": false,
  "message": "Provider and idToken are required",
  "errors": []
}
```

#### Signup-only behaviors

| Scenario | Result |
|----------|--------|
| Email not in DB | **Creates** new user with `personalization` |
| User soft-deleted (`IsDeleted: true`) | **Reactivates** same `_id`, applies new `personalization`, clears password |
| Active user exists (email or `googleSub`/`appleSub`) | **401** — “already exists, please log in” (does **not** issue token) |

---

### 7C. Recommended app flows

```text
SIGNUP
  Personalization screens (collect 3 fields)
    → Native Google/Apple sign-in
    → POST /api/auth/sso/signup { provider, idToken, personalization }
    → 201 + token + isProfileComplete true → Home

LOGIN
  Startup / Login
    → Native Google/Apple sign-in
    → POST /api/auth/sso/login { provider, idToken }
    → 200 + token
    → isProfileComplete false? → PATCH personalization (section 8)
    → else → Home

LOGIN errors → guide user
  "No account found" → Sign up flow (personalization → sso/signup); works for new and previously deleted users
  "already exists" on signup → Login flow (sso/login)
  "registered with password" on login → Email/password form
```

---

## 8. Complete profile after SSO (login edge cases)

Use this when **SSO login** returns `isProfileComplete: false` (e.g. older accounts created before personalization-on-signup). **SSO signup** should already return `isProfileComplete: true` if personalization was sent.

Collect:

- `lastPeriodStartDate` — ISO date string, e.g. `"2025-01-15"`
- `averageMenstrualCycleLength` — string, e.g. `"28"`
- `averagePeriodDuration` — number, e.g. `5` (must be &gt; 0)

```http
PATCH /api/users/me/personalization
Authorization: Bearer <token>
```

```json
{
  "lastPeriodStartDate": "2025-01-15",
  "averageMenstrualCycleLength": "28",
  "averagePeriodDuration": 5
}
```

**Success:**

```json
{
  "success": true,
  "message": "Profile completed successfully",
  "data": {
    "user": { ... },
    "authProvider": "google",
    "isProfileComplete": true
  }
}
```

Then navigate to Home. Token does not change; keep using the same JWT.

---

## 9. Forgot password flow

**Only for email accounts.** Google/Apple users have no password to reset.

### Request reset code

```http
POST /api/auth/forgot-password
```

```json
{ "email": "user@example.com" }
```

**Response (always HTTP 200 for security):**

#### Case A — Email account (OTP sent)

```json
{
  "success": true,
  "message": "If the email exists, an OTP has been sent",
  "data": {
    "email": "user@example.com",
    "expiresIn": "5m",
    "passwordResetSent": true,
    "authProvider": "email"
  }
}
```

→ Navigate to “enter OTP” screen (same as today).

#### Case B — Google account

```json
{
  "success": true,
  "message": "This account uses Google sign-in. Password reset is not available. Please go back and sign in with Google instead.",
  "data": {
    "email": "user@example.com",
    "expiresIn": null,
    "passwordResetSent": false,
    "authProvider": "google"
  }
}
```

#### Case C — Apple account

Same as B, but `authProvider: "apple"` and Apple-specific message.

#### Case D — Email not in system

Looks like Case A (`passwordResetSent: false`, `authProvider: null`, generic message). **Do not** reveal whether the email exists. Still show a neutral “check your email” UI if product wants—or show the generic message only.

### Frontend logic (recommended)

```javascript
const res = await forgotPassword({ email }).unwrap();

if (res.data?.passwordResetSent === true) {
  navigation.navigate('OTPVerification', { email, flow: 'reset' });
} else if (res.data?.authProvider === 'google' || res.data?.authProvider === 'apple') {
  Alert.alert('Sign in required', res.message);
  navigation.navigate('Startup'); // or Login
} else {
  // Unknown email or generic case — show res.message, optional neutral UX
  showToast(res.message);
}
```

### Continue reset (email only)

1. `POST /api/auth/verify-reset-otp` — `{ email, otp }` → `tempToken`
2. `POST /api/auth/reset-password` — `{ email, newPassword, tempToken }`

If user is SSO, `reset-password` returns 401 (backend guard). Forgot-password should have stopped them earlier.

---

## 10. After login: checking profile and settings

### Profile status only (lightweight)

```http
GET /api/users/me/profile-status
Authorization: Bearer <token>
```

**Success (200):**

```json
{
  "success": true,
  "data": {
    "isProfileComplete": false,
    "authProvider": "google",
    "missingFields": [
      "lastPeriodStartDate",
      "averageMenstrualCycleLength",
      "averagePeriodDuration"
    ]
  }
}
```

When `isProfileComplete` is `true`, `missingFields` is an empty array `[]`.

### On app launch (cold start)

If you have a stored JWT:

```http
GET /api/users/me
Authorization: Bearer <token>
```

Response includes:

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "email": "...",
    "authProvider": "email",
    "isProfileComplete": true,
    "personalization": { ... }
  }
}
```

| Condition | Action |
|-----------|--------|
| 401 | Clear token → Login |
| `isProfileComplete === false` | Onboarding / personalization |
| else | Home |

### Settings screen — hide password actions for SSO

If `authProvider` is `"google"` or `"apple"`:

- Hide **Change password**
- Hide **Forgot password** links where relevant

Email users keep full password flows.

---

## 11. Which screens to change

| Screen / area | Changes |
|---------------|---------|
| `Startup.tsx` / Login | Google/Apple → `POST /api/auth/sso/login` → branch on `isProfileComplete` |
| Signup / personalization | Collect personalization first → Google/Apple → `POST /api/auth/sso/signup` with `personalization` |
| `Signup` (email) | Unchanged OTP flow |
| Legacy incomplete SSO users | `PATCH /me/personalization` after login if needed |
| `SignupCode` | Email only |
| `ForgotPassword` | Check `passwordResetSent` and `authProvider` from forgot-password response |
| `Settings` | Hide change password when `authProvider !== 'email'` |
| App navigator / splash | On launch: `GET /me` → gate on `isProfileComplete` |
| Redux `auth` slice | Store `token`; optionally store `authProvider` and `isProfileComplete` |

---

## 12. RTK Query / API file changes

File: `src/Api/auth/authApi.ts`

**Add new endpoints:**

```typescript
ssoLogin: builder.mutation({
  query: (body: { provider: 'google' | 'apple'; idToken: string }) => ({
    url: '/api/auth/sso/login',
    method: 'POST',
    body,
  }),
}),

ssoSignup: builder.mutation({
  query: (body: {
    provider: 'google' | 'apple';
    idToken: string;
    personalization: {
      lastPeriodStartDate: string;
      averageMenstrualCycleLength: string;
      averagePeriodDuration: number;
    };
  }) => ({
    url: '/api/auth/sso/signup',
    method: 'POST',
    body,
  }),
}),
```

File: `src/Api/users` or user API — **add:**

```typescript
completePersonalization: builder.mutation({
  query: (body) => ({
    url: '/api/users/me/personalization',
    method: 'PATCH',
    body,
  }),
}),
```

**Update types** for login/register/sso response:

```typescript
type AuthResponseData = {
  user: User;
  token: string;
  authProvider: 'email' | 'google' | 'apple';
  isProfileComplete: boolean;
};
```

**Forgot password response:**

```typescript
type ForgotPasswordData = {
  email: string;
  expiresIn: string | null;
  passwordResetSent: boolean;
  authProvider: 'email' | 'google' | 'apple' | null;
};
```

Export hooks: `useSsoLoginMutation`, `useSsoSignupMutation`, `useCompletePersonalizationMutation`.

---

## 13. Error messages users may see

Backend sends localized `message` (EN/DE via `Accept-Language`). Examples:

| Message idea | When |
|--------------|------|
| Please sign in with Google or Apple | Email password login on SSO account |
| This email is registered with a password… | SSO **login** on email account |
| No account found. Please sign up first | SSO **login**, no active user (includes soft-deleted; same message) |
| An account with this email already exists. Please log in | SSO **signup**, active user exists |
| This email is registered with a different sign-in method | SSO **login**, wrong SSO provider |
| Password reset is not available… (Google/Apple) | Forgot password on SSO account |
| Please complete all required profile fields | Signup missing personalization or PATCH incomplete |
| Invalid or expired sign-in token | Bad/expired Google/Apple token |
| Email is required on first sign-in with Apple | SSO **signup**, new user, Apple hid email |

Always display `response.message` from the API when `success: false`.

---

## 14. Testing checklist

- [ ] Email register → `isProfileComplete: true` → Home
- [ ] Email login → token works on `GET /me`
- [ ] Google SSO **login** (existing user) → token → Home
- [ ] Google SSO **login** (no account) → 401 “sign up first”
- [ ] Google SSO **signup** (new user + personalization) → 201, `isProfileComplete: true`
- [ ] Google SSO **signup** (existing active user) → 401 “already exists, log in”
- [ ] Deleted user: login → 401 “No account found” (same as unknown email); signup → reactivated with new personalization
- [ ] Apple SSO signup + login (iOS device)
- [ ] SSO then close app → reopen → still prompted if profile incomplete
- [ ] Forgot password (email) → OTP email received, `passwordResetSent: true`
- [ ] Forgot password (Google test user) → no email, message says use Google, `passwordResetSent: false`
- [ ] Login with password on Google account → 401 + SSO message
- [ ] Settings: no “change password” for Google/Apple user

---

## Questions?

Contact the backend team with:

- Request URL + body (redact tokens)
- Response status + JSON
- Platform (iOS/Android) and app language

---

*Last updated: Split SSO into `/sso/login` and `/sso/signup` (personalization on signup).*
