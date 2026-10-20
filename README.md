# OfficeSeat — Smart Office Seating & Booking System

**Your Workspace. Your Seat. Your Choice.**

OfficeSeat is an advanced office seat booking and management system. Employees
view a real office floor plan, pick an available seat, and reserve it for a
date. The Admin uploads the floor plan, places seat markers exactly where the
chairs are, manages bookings, and monitors utilization.

Built with **React + TypeScript + Vite**, **Tailwind CSS**, **Firebase
Authentication**, and **Cloud Firestore**. Firebase Storage is intentionally
not used — floor-plan images are optimized in the browser and stored as Base64
data URLs inside Firestore layout documents.

> This project uses **Firebase only**. No Supabase.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Firebase Setup (Manual Console Steps)](#firebase-setup-manual-console-steps)
5. [Local Development Setup](#local-development-setup)
6. [Provisioning the Admin Account](#provisioning-the-admin-account)
7. [Deploying Firestore Security Rules](#deploying-firestore-security-rules)
8. [Environment Variables](#environment-variables)
9. [Running the App](#running-the-app)
10. [Firebase Emulator Testing](#firebase-emulator-testing)
11. [Deployment](#deployment)
   - [Netlify](#netlify)
   - [Vercel](#vercel)
12. [Project Structure](#project-structure)
13. [Acceptance Checklist](#acceptance-checklist)

---

## Features

- **Authentication**: Email/password sign-in, sign-up, password reset, session
  persistence, session restoration after refresh, secure logout.
- **Role model**: Exactly one predefined Admin (`admin@officeseat.demo`),
  verified via a Firebase custom claim. Every other authenticated account is
  automatically an Employee. No manual role assignment.
- **Admin Dashboard**: Live stats (total/available/booked/disabled seats,
  employees, today's bookings), 7-day utilization chart, recent bookings, quick
  actions.
- **Office Layouts**: Create, edit, duplicate, publish, unpublish, archive,
  delete layouts.
- **Dynamic Floor-Plan Editor**: Upload a real PNG/JPEG floor plan (optimized
  to Base64, stored in Firestore), click to place seat markers, drag to move,
  resize, edit codes/labels/zones/departments/notes, enable/disable, delete,
  undo/redo, zoom/pan, employee-view preview, Save Draft, Publish.
- **Save Draft & Publish**: Validates seat codes/positions, batches writes to
  Firestore, preserves unsaved changes on failure, publishes only after a
  successful save.
- **Employee Booking**: Pick a date, open a published floor plan, see
  available/booked/disabled/your-booking seats, click to book, confirmation
  dialog, duplicate-booking prevention via deterministic document IDs.
- **My Bookings**: Upcoming and past bookings, cancel within the configured
  deadline.
- **Admin Booking Management**: Search, filter, sort, pagination, CSV export,
  cancel any booking.
- **Admin Employees Directory**: Search, filter by status, enable/disable
  accounts.
- **Reports**: 30-day booking trend, per-layout utilization, CSV export.
- **Settings**: Advance booking days, max bookings per day, cancellation
  deadline, working days.
- **Security**: Firestore Security Rules enforce role-based access, booking
  ownership, reservation uniqueness, and admin-only layout/seat mutations.
- **UI**: Navy/indigo/white design system, responsive sidebar, toasts,
  confirmation dialogs, empty states, loading spinners, animations.

---

## Tech Stack

- React 18 + TypeScript
- Vite 7
- Tailwind CSS 3
- Firebase Authentication + Cloud Firestore (client SDK)
- Firebase Admin SDK (seed script only, never in frontend)
- React Router 7
- React Hook Form + Zod
- Lucide React icons

---

## Prerequisites

- Node.js 18+ (Node 24+ recommended for the latest Firebase SDK)
- A Firebase project (free Spark plan is sufficient — Firestore is used, not
  Storage)
- The Firebase CLI (optional, for deploying rules): `npm install -g firebase-tools`

---

## Firebase Setup (Manual Console Steps)

These steps must be completed in the [Firebase Console](https://console.firebase.google.com):

1. **Create or select a Firebase project.**
2. **Register a web application**:
   - Project Settings → Your apps → Add app → Web.
   - Copy the config values (apiKey, authDomain, projectId, storageBucket,
     messagingSenderId, appId).
3. **Enable Email/Password Authentication**:
   - Authentication → Sign-in method → Email/Password → Enable.
4. **Create the Cloud Firestore database**:
   - Firestore Database → Create database → Start in production mode (rules
     are deployed below).
   - Choose a location close to your users.
5. **Do NOT enable Firebase Storage.** This project stores floor-plan images as
   Base64 data URLs inside Firestore layout documents (capped at 700,000
   characters) to avoid requiring a paid Storage plan.
6. **Generate a service account key** (for the Admin provisioning script):
   - Project Settings → Service Accounts → "Generate new private key".
   - Save the JSON file as `serviceAccountKey.json` in the project root (it is
     gitignored). **Never commit this file.**

---

## Local Development Setup

```bash
# 1. Clone and install dependencies
npm install

# 2. Copy the environment template
cp .env.example .env

# 3. Fill in your Firebase web app config in .env
#    (the VITE_FIREBASE_* values from step 2 above)

# 4. Provision the Admin account (see next section)
npm run seed-admin

# 5. Deploy Firestore Security Rules (see below section)

# 6. Start the dev server
npm run dev
```

---

## Provisioning the Admin Account

The predefined Admin account is **not** created automatically. Run the
provisioning script in a trusted local environment:

```bash
# Set the service account key as an environment variable
export FIREBASE_ADMIN_SERVICE_ACCOUNT="$(cat serviceAccountKey.json)"

# Run the seed script
npm run seed-admin
```

The script will:
1. Create the Admin auth user (`admin@officeseat.demo` / `AdminDemo!2026`) if
   it does not exist.
2. Set a trusted `admin: true` custom claim.
3. Create the Admin Firestore profile with `role: 'admin'`.
4. Create default settings (`settings/general`).
5. Be safe to re-run (idempotent — no duplicates).

> The "Fill Admin Credentials" button on the login page only populates the
> form fields. It does **not** bypass Firebase Authentication. The account must
> be provisioned first.

If you see an error that the admin claim is not recognized after provisioning,
sign out and sign back in — the client SDK refreshes the ID token on re-auth.

---

## Deploying Firestore Security Rules

```bash
# Using the Firebase CLI
npm run deploy:rules
# or: firebase deploy --only firestore:rules
```

The rules file is `firestore.rules`. It enforces:
- Only authenticated users can read/write.
- Only the verified Admin (custom claim or reserved email + verified profile
  role) can create/update/delete layouts, seats, and settings.
- Employees can read only published layouts and their own bookings.
- Employees can create bookings only for themselves with `status: 'active'`.
- Employees can cancel only their own bookings (status → 'cancelled').
- Users cannot modify their own `role` or `active` fields.
- Layout documents must stay under 1 MiB.

---

## Environment Variables

All frontend variables are prefixed with `VITE_` (required by Vite). The
service account key is **not** prefixed and is never imported by frontend code.

| Variable | Where | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `.env` | Firebase web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | `.env` | Firebase web app config |
| `VITE_FIREBASE_PROJECT_ID` | `.env` | Firebase web app config |
| `VITE_FIREBASE_STORAGE_BUCKET` | `.env` | Firebase web app config (unused for storage, but part of config) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `.env` | Firebase web app config |
| `VITE_FIREBASE_APP_ID` | `.env` | Firebase web app config |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT` | shell env | Service account JSON (seed script only) |

Missing `VITE_` values are detected at startup and a setup screen is shown with
instructions.

---

## Running the App

```bash
npm run dev      # Start the dev server
npm run build    # Production build
npm run preview  # Preview the production build
npm run typecheck # Type-check
```

---

## Firebase Emulator Testing

You can test Firestore Security Rules locally with the Firebase Emulator Suite:

```bash
# 1. Install the Firebase CLI if you haven't
npm install -g firebase-tools

# 2. Start the emulators (Auth + Firestore)
firebase emulators:start

# 3. In another terminal, point the app at the emulators by adding to .env:
#    VITE_FIREBASE_API_KEY=demo-key
#    (and set the auth/firestore host ports in src/lib/firebase.ts if needed)
```

To run the seed script against the emulator, set the `FIRESTORE_EMULATOR_HOST`
environment variable:

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8080
npm run seed-admin
```

Test the rules:
- Sign in as the Admin → can read all layouts, create/edit/delete layouts and
  seats, read all bookings.
- Sign in as an Employee → can read only published layouts, can create bookings
  only for themselves, cannot read other employees' bookings, cannot access
  admin endpoints (Firestore blocks the queries).

---

## Deployment

### Netlify

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Add all `VITE_FIREBASE_*` environment variables in Netlify → Site settings →
   Environment variables.
4. Add a redirect rule for SPA routing. Create `public/_redirects` with:
   ```
   /*    /index.html   200
   ```
   (Vite copies `public/` into `dist/`.)
5. Deploy. Run `npm run seed-admin` once against your production Firebase project
   (or use a Cloud Function) to provision the Admin.

### Vercel

1. Framework preset: Vite
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add all `VITE_FIREBASE_*` environment variables in Vercel → Project →
   Settings → Environment Variables.
5. Vercel handles SPA routing automatically for Vite.
6. Deploy. Provision the Admin account as above.

> **Important**: Never include `FIREBASE_ADMIN_SERVICE_ACCOUNT` or
> `serviceAccountKey.json` in your deployed environment or build output. The
> seed script runs locally only.

---

## Project Structure

```
src/
  components/        # Shared UI (Logo, Spinner, Toast, ConfirmDialog, shells)
  context/          # AuthContext (session, roles, loading)
  lib/              # firebase.ts, admin.ts, date.ts, image.ts
  pages/
    admin/          # Admin dashboard, layouts, editor, seats, bookings, employees, reports, settings
    employee/       # Employee dashboard, book-seat, my-bookings
    LoginPage.tsx, SignupPage.tsx, ForgotPasswordPage.tsx
  services/         # auth, user, layout, seat, booking, settings services
  types/            # TypeScript types and constants
scripts/
  seed-admin.ts     # Admin provisioning script (Admin SDK, dev only)
firestore.rules     # Firestore Security Rules
firebase.json       # Firebase CLI config
.env.example        # Environment variable template
```

---

## Acceptance Checklist

- [x] Entire app uses Firebase only — no Supabase.
- [x] Admin authenticates through Firebase (custom claim verified).
- [x] Verified Admin reaches `/admin/dashboard`.
- [x] Any other active user reaches `/employee/dashboard`.
- [x] Public sign-up cannot create an Admin (blocked in code + rules).
- [x] Employees require no manual role assignment.
- [x] Employees cannot access Admin operations (route guards + Firestore rules).
- [x] Admin can upload a real floor-plan image (Base64 in Firestore).
- [x] Clicking the image creates a seat marker at the correct position.
- [x] Markers can be moved, resized, renamed, deleted, enabled/disabled.
- [x] Saving persists all seat changes in Firestore (batched writes).
- [x] Refreshing preserves saved marker positions.
- [x] Failed saves preserve unsaved changes and display errors.
- [x] Publishing is blocked when saving fails.
- [x] Employees can view published layouts.
- [x] Employees can book available seats for selected dates.
- [x] Duplicate bookings prevented (deterministic document IDs).
- [x] Employees manage only their own eligible bookings.
- [x] Firestore Security Rules enforce all of the above server-side.
- [x] Authentication persists after page refresh.
- [x] Setup and deployment instructions are complete.
