# Onmeeting — SaaS Video Conferencing Platform

Full-stack Next.js 14 implementation of the Onmeeting platform with complete billing logic.

## Stack

- **Framework**: Next.js 14 App Router (frontend + backend API routes)
- **Database (relational)**: PostgreSQL via Prisma ORM
- **Database (documents)**: MongoDB via Mongoose (entitlements)
- **Queue**: BullMQ + Redis (subscription renewals, grace period dunning)
- **Auth**: JWT via `jose` + httpOnly cookies
- **Styling**: Tailwind CSS

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── billing/page.tsx            # Plans & pricing page
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx               # Main dashboard
│   │   ├── addons/page.tsx        # Addon management
│   │   ├── members/page.tsx       # Member permissions
│   │   └── invoices/page.tsx      # Invoice history
│   ├── admin/page.tsx             # Admin panel (plans, addons, coupons)
│   └── api/
│       ├── auth/                  # register, login, me
│       ├── plans/                 # GET all plans
│       ├── subscriptions/
│       │   ├── subscribe/         # POST — subscribe to plan
│       │   ├── upgrade/           # POST — immediate upgrade with proration
│       │   ├── downgrade/         # POST — schedule downgrade
│       │   └── cancel/            # POST — cancel_pending
│       ├── addons/
│       │   ├── route.ts           # GET — available addons for plan
│       │   └── purchase/          # POST — purchase addon (pro-rated)
│       ├── wallet/
│       │   ├── topup/             # POST — top up wallet (triggers retry if past_due)
│       │   └── transactions/      # GET — transaction history
│       ├── members/features/      # GET/POST — member-level feature permissions
│       ├── invoices/              # GET — invoice history
│       └── admin/
│           ├── plans/             # CRUD plans
│           ├── addons/            # Register addons + link to plans
│           └── coupons/           # Create coupons
├── lib/
│   ├── db/
│   │   ├── prisma.ts             # Prisma singleton
│   │   ├── mongoose.ts           # MongoDB connection
│   │   └── models/
│   │       └── entitlement.model.ts  # MongoDB entitlements schema
│   ├── auth/
│   │   ├── jwt.ts                # JWT sign/verify
│   │   └── middleware.ts         # Auth helpers
│   └── queue/
│       ├── index.ts              # BullMQ queue instances
│       └── workers/
│           └── renewal.worker.ts # Renewal + grace period workers
└── prisma/
    ├── schema.prisma             # Full PostgreSQL schema
    └── seed.ts                   # Seed: plans, addons, admin user, coupon
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your DB credentials
```

### 3. Push database schema
```bash
npx prisma generate
npx prisma db push
```

### 4. Seed the database
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

### 5. Start development server
```bash
npm run dev
```

## Business Logic Implemented

### Subscription Lifecycle
- Subscribe to plan (deducts wallet, creates subscription, schedules BullMQ renewal job)
- Immediate upgrade with pro-rata charge
- Scheduled downgrade (delete-on-apply pattern, applied at next renewal)
- cancel_pending → cancelled at renewal

### Billing & Wallet
- Wallet as ledger — never direct balance update, always via `WalletTransaction`
- `SELECT FOR UPDATE` on wallet row (Prisma `$transaction` handles serializable locking)
- Idempotency keys on all invoices and transactions
- Top-up triggers immediate retry if subscription is `past_due`

### BullMQ Workers
- `renewalWorker`: Handles Scenario 1 (normal), 3 (downgrade), 4 (cancel_pending), 5 (payment failure → past_due)
- `gracePeriodWorker`: Day 1/3 retry, Day 7 → suspended, Day 30 → cancelled

### Add-on System
- Manifest-driven (VSCode-style): type, config_schema, constraints, entitlement_keys
- 3-layer config: manifest → plan_addons.config → subscription_addon_items.runtime_config
- Pro-rated at purchase (bound to subscription cycle end date)
- Entitlements synced to MongoDB after purchase

### Entitlements (MongoDB)
- `limits` and `usage` nested objects per account
- Updated via atomic `findOneAndUpdate`/`updateOne` on addon purchase/cancellation

### Coupons
- Per-plan and per-plan-addon coupons
- Global max uses + per-user max uses enforcement
- Applied at subscribe and addon purchase time

### Member Features
- Key-value table replaces hardcoded boolean columns
- `large_meeting: "true"`, `capacity_of_large_meeting: "1000"` per member
- Checked in Guard 4 when starting a meeting

## Default Credentials (after seed)
- **Admin**: admin@onmeeting.com / admin123456
- **Coupon**: WELCOME20 (20% off subscription)

## API Reference

### Auth
```
POST /api/auth/register    — Create account
POST /api/auth/login       — Sign in, returns JWT
GET  /api/auth/me          — Current user + accounts
```

### Plans & Subscriptions
```
GET  /api/plans                         — List plans (optional ?accountType=)
POST /api/subscriptions/subscribe       — Subscribe { accountId, planId, billingCycle, couponCode? }
POST /api/subscriptions/upgrade         — Upgrade { accountId, newPlanId }
POST /api/subscriptions/downgrade       — Schedule downgrade { accountId, newPlanId, addonItemsToCancel? }
POST /api/subscriptions/cancel          — Cancel { accountId }
```

### Addons
```
GET  /api/addons?planId=xxx             — Available addons for plan
POST /api/addons/purchase               — Purchase { accountId, planAddonId, runtimeConfig, couponCode? }
```

### Wallet
```
POST /api/wallet/topup                  — Top up { accountId, amount }
GET  /api/wallet/transactions?accountId — Transaction history
```

### Members & Invoices
```
POST /api/members/features              — Set member features { managementId, features[] }
GET  /api/members/features?managementId — Get member features
GET  /api/invoices?accountId            — Invoice history
```

### Admin (isAdmin required)
```
POST /api/admin/plans                   — Create plan
GET  /api/admin/plans                   — List all plans
POST /api/admin/addons                  — Register addon
POST /api/admin/addons?action=link-plan — Link addon to plan
POST /api/admin/coupons                 — Create coupon
GET  /api/admin/coupons                 — List coupons
```
