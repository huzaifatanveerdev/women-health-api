# women-help-api

Production-oriented **Node.js / Express** backend for a menstrual-health mobile platform — combining cycle intelligence, entitlement-gated insights, multi-provider identity, and impact-linked subscription billing in a single API surface.

---

## Architecture

```
routes → controllers → services → models
              ↓
         middleware (auth · i18n · errors · uploads)
              ↓
     jobs / webhooks / external providers
```

Layered domain services keep HTTP thin and business rules testable. MongoDB (Mongoose) is the source of truth; third-party systems are integrated behind dedicated adapters.

## What it does

| Domain | Capabilities |
|--------|----------------|
| **Identity** | Email + OTP flows, JWT sessions, Google / Apple SSO token verification (multi-client audiences) |
| **Cycle intelligence** | Menstrual cycle persistence, daily symptom logging, flow & pattern insights derived across cycles |
| **Monetization** | Subscription plans, RevenueCat webhook ingestion & normalization, Stripe payment wiring, cron-based expiry |
| **Impact** | Collective progress aggregates, per-user impact records, support waitlist, invite-link distribution |
| **Platform** | Force-update / soft-update version gates (iOS + Android), Cloudinary media, SendGrid transactional mail, EN/DE localization |

## Stack

- **Runtime:** Node.js, Express  
- **Data:** MongoDB · Mongoose  
- **Auth:** JWT · bcrypt · Google Auth Library · Apple JWKS  
- **Billing:** RevenueCat webhooks · Stripe  
- **Ops:** `node-cron`, centralized error middleware, env-driven config  
- **Comms / media:** SendGrid · Cloudinary · Multer  

## API surface (high level)

```
/api/auth            identity, OTP, SSO
/api/users           profiles & account
/api/symptoms        symptom logging
/api/menstrual-flow  flow / cycle insights
/api/subscription    plans & entitlements
/api/impact          collective + personal impact
/api/webhooks        RevenueCat / Stripe events
/api/app             version / update policy
```

## Design notes recruiters care about

- **Webhook-first billing** — store purchases are reconciled asynchronously; subscription state is normalized across product ID variants (including grandfathered SKUs).
- **Entitlement-aware insights** — premium insight endpoints check active subscription state before returning computed analytics.
- **i18n at the edge** — language middleware localizes API messages and email templates (English / German).
- **Hardened defaults** — `x-powered-by` disabled, JWT + admin guards, structured error responses, secrets via environment only.

## Quick start

```bash
cp env.example .env   # fill MongoDB, JWT, SSO, SendGrid, etc.
npm install
npm run dev           # or: npm start
```

Server defaults to `http://localhost:3000`.

---

Built as a portfolio piece demonstrating real-world backend concerns: auth federation, webhook reliability, domain modeling, and paid-feature gating — not a CRUD toy.
