# Session handoff — 21 May 2026

Summary of SSO (Google/Apple) work across **women-help-api** and **women-help-api**.

---

## Backend (completed earlier in session)

### SSO split
| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/sso/login` | Active users only; no create/reactivate |
| `POST /api/auth/sso/signup` | Create or reactivate deleted; requires `personalization` |
| `POST /api/auth/sso` | Legacy alias → login |

### Login behavior
- No account / soft-deleted → same 401: *"No account found. Please sign up first"* (no deletion disclosure)
- Email account + Google/Apple → provider conflict messages

### Key files
- `services/ssoService.js`
- `controllers/authController.js`
- `routes/authRoutes.js`
- `utils/localization.js`
- `docs/SSO_FRONTEND_INTEGRATION.md`

### Env (SSO)
- `GOOGLE_CLIENT_ID` — web client
- `GOOGLE_CLIENT_ID_IOS` / `GOOGLE_CLIENT_ID_ANDROID`
- `APPLE_BUNDLE_ID=com.women-help-api.app` — used as JWT `audience` for Apple token verification (not App Store Connect API keys)

---

## Frontend — Google SSO fixes

### Bug #1 — Dialog showed `"undefined"`
RTK Query errors use `error.data.message`, not `error.message`.

**Fix:** `extractApiErrorMessage()` in `src/Api/auth/socialAuthService.ts`; used in Login/Signup catch blocks with localized titles.

### Bug #2 — Second tap skipped Google sheet / duplicate signups
Google SDK kept cached session after failure.

**Fix:** `signOut()` before and after `signIn()` in `signInWithGoogle()`; `signOutFromGoogle()` on failure in screens.

### Bug #3 — Signup success redirected to Login
`ssoSignup` succeeded but `loginSuccess({ token })` was never dispatched → 401 on protected APIs → global interceptor logged out.

**Fix:** `completeSignupFlow()` in `Signup.tsx` (mirrors Login `completeLoginFlow`).

### Bug #4 — Double tap during processing
**Fix:** `isSocialAuthProcessing` + `isScreenBusy` on Login/Signup; existing `Loader` overlay (Signup previously only watched OTP loading).

### Intentionally untouched
- `src/components/Loader.tsx` — reverted `pointerEvents` change; production shared component left as-is.

---

## Frontend — Apple Sign In + iOS build

### `pod install` "Format error!"
**Cause:** `ios/women-help-api/Info.plist` — orphan `<array>` without `<key>CFBundleURLTypes</key>`.

**Fix:** Added `CFBundleURLTypes` key; URL schemes unchanged (`com.women-help-api.app`, Google reversed iOS client ID).

### Apple Sign In capability
**Added:**
- `ios/women-help-api/women-help-api.entitlements` — `com.apple.developer.applesignin`
- `ios/women-help-api.xcodeproj/project.pbxproj` — `CODE_SIGN_ENTITLEMENTS = women-help-api/women-help-api.entitlements` (Debug + Release)

### Apple JS fixes
| Screen | Fix |
|--------|-----|
| `Login.tsx` | Removed debug `Alert` showing raw ID token; `authProvider` fallback `'apple'` |
| `Signup.tsx` | Apple uses `completeSignupFlow()` (token in Redux before navigation) |

### Backend Apple path
No backend changes required — `verifyAppleToken` in `ssoService.js` already verifies against `APPLE_BUNDLE_ID`.

---

## Developer checklist (local Mac — not in repo)

1. [developer.apple.com](https://developer.apple.com) → App ID `com.women-help-api.app` → enable **Sign In with Apple** → refresh provisioning profiles.
2. Xcode → women-help-api target → **Signing & Capabilities** → confirm "Sign in with Apple" (add capability if missing).
3. `cd ios && pod install` (should pass after Info.plist fix).
4. Test on **real device** with Apple ID signed in.
5. Confirm backend `APPLE_BUNDLE_ID=com.women-help-api.app` on deployed server.

---

## Suggested commit messages

**Full stack (both repos):**
```
Fix SSO login/signup flows, Google UX, and Apple Sign In iOS configuration
```

**Frontend only (Apple + plist slice):**
```
Fix malformed Info.plist, add Apple Sign In entitlements, and align Apple SSO with Google signup flow
```

**Backend only:**
```
Split SSO into login and signup endpoints with personalization on signup
```

---

## Test matrix

| Flow | Expected |
|------|----------|
| Google login — email account exists | API message in dialog; picker on retry |
| Google login — no account | "No account found. Please sign up first" |
| Google signup | 201 → main (no Login redirect) |
| Google signup — double tap while loading | Blocked by loader + guard |
| Apple login/signup (iOS device) | Native sheet → token → same API paths as Google |
| `pod install` | No Format error on Info.plist |

---

## Agent transcript

Full chat: `agent-transcripts/1db68467-f6ed-4754-a169-5a686e565c0a/1db68467-f6ed-4754-a169-5a686e565c0a.jsonl`

---

*Saved at end of session — 21 May 2026.*
