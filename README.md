# RizLife QuestCard Management System (APC)

Unified QuestCard, OpenLearning Submission Tracker, Batched Outlook Digest, and Speed Leaderboard platform for **Asia Pacific College (APC)** — *Life and Works of Rizal (R.A. 1425)*.

This repository is structured as an **npm workspaces monorepo** with **three separately deployable Next.js portals** (`apps/student`, `apps/teacher`, `apps/admin`) sharing a unified Prisma + PostgreSQL database, auth, email digest, Excel export/import, and archival parchment UI core (`packages/shared`).

---

## Project Structure

```text
questcard-rizlife/
├── apps/
│   ├── student/        # Vercel Project 1 — Student QuestCard Portal (port 3001)
│   ├── teacher/        # Vercel Project 2 — Teacher Command Center & Cron (port 3002)
│   └── admin/          # Vercel Project 3 — Admin Console & Override (port 3003)
├── packages/
│   └── shared/         # @rizlife/shared — Prisma schema, seed, auth, digest, ExcelJS, UI kit
├── supabase/           # SQL setup + migrations for Supabase (rosters: see Data Privacy)
├── e2e/                # Playwright smoke tests
├── .github/workflows/  # CI: lint, typecheck, verify, build, e2e
├── docker-compose.yml  # Optional local PostgreSQL 16 container
├── .env.example        # Environment variable template
└── package.json        # Root workspace scripts
```

---

## Quick Start (Local Development)

### 1. Install Dependencies & Generate Prisma Client
```bash
npm install
npm run prisma:generate
```

### 2. Choose a Database Backend
Copy `.env.example` to `.env` at the repository root. All three apps read this one file. The backend is picked at startup:

| Configured | Backend | Use for |
| --- | --- | --- |
| `DATABASE_URL` | Prisma → PostgreSQL (Supabase, Neon, or local Docker via `docker compose up -d`) | **Production**, and any real class |
| `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (no `DATABASE_URL`) | Built-in adapter over Supabase PostgREST | Small deployments, development |
| Neither | Local JSON file `.rizlife-db.json`, auto-seeded with demo accounts | Local development only |

> **Supabase on Vercel:** use the **Transaction Pooler** URL for `DATABASE_URL` (port `6543`, `?pgbouncer=true&connection_limit=1`). Use your direct or session connection string for `db:push`.

### 3. Create the Schema & Seed Data

**Supabase (SQL Editor):** run these in order in **Supabase Dashboard → SQL Editor**:
1. `supabase/setup.sql`: tables, global settings, the demo admin, teacher and student, section `BSIT241`, and API grants.
2. **Existing databases only** (fresh `setup.sql` runs already include these):
   - `supabase/migration_finals_track.sql`: adds `Enrollment.finalsTrack`/`assignedModule*`, for databases created before the Finals Track feature.
   - `supabase/migration_security_hardening.sql`: adds `User.sessionVersion`, enables Row Level Security and removes public API access. **Run this before deploying any version from 2026-11-28 on**; the app can't read users without the new column. Its last query should show `rls_enabled = true` and every `anon_*`/`authenticated_*` column `false`.
3. `supabase/bsit_24_tasks.sql` (optional): the 24 Rizal QuestCard tasks for `BSIT241`.
4. In the Supabase Dashboard, turn off **Authentication → Sign In / Providers → Allow new users to sign up** (RizLife doesn't use Supabase Auth). Then open **Advisors → Security Advisor** and refresh it.
5. Students: import the class roster through **Teacher Portal → Students → Import (.xlsx / .csv)**. For SQL seeding, copy `supabase/students.example.sql` (see [Data Privacy](#data-privacy--student-records)).

**Prisma (`DATABASE_URL` set):**
```bash
npm run db:push
npm run db:seed   # demo data (fictional people)
```

### 4. Run Any or All 3 Portals Simultaneously
Each portal uses a separate cookie name (`rizlife_student_session`, `rizlife_teacher_session`, `rizlife_admin_session`) and separate port, so you can test all 3 roles side-by-side in one browser:
```bash
npm run dev:student   # http://localhost:3001
npm run dev:teacher   # http://localhost:3002
npm run dev:admin     # http://localhost:3003
```

---

## Seeded Test Credentials

All seeded people are **fictional**. These passwords are public (they're in this README), so **rotate them, or delete the demo accounts, before real students use a deployment.**

- **Supabase SQL / local JSON** (`setup.sql`, `.rizlife-db.json`): `admin@apc.edu.ph` / `Admin@RizLife2026`, `teacher@apc.edu.ph` / `Teacher@RizLife2026`, `jdelacruz@student.apc.edu.ph` / `Student@2026`
- **Prisma demo seed** (`npm run db:seed`):

| Portal | Role | Email | Password | Notes |
| --- | --- | --- | --- | --- |
| **Student** (`:3001`) | `STUDENT` | `jdelacruz@student.apc.edu.ph` | `Student@2026` | 7 Stamped, 2 Pending, 1 Revision |
| **Student** (`:3001`) | `STUDENT` | `msantos@student.apc.edu.ph` | `Student@2026` | Demonstrates forced password change |
| **Teacher** (`:3002`) | `TEACHER` | `prof.mendoza@apc.edu.ph` | `Teacher@RizLife2026` | Owns section `IT241` (10 students, 12 quests) |
| **Teacher** (`:3002`) | `TEACHER` | `prof.reyes@apc.edu.ph` | `Teacher@RizLife2026` | Owns section `IT242` |
| **Admin** (`:3003`) | `ADMIN` | `admin@apc.edu.ph` | `Admin@RizLife2026` | Full system + teacher override access |

---

## Checks, Tests & CI

```bash
npm run lint             # ESLint (next/core-web-vitals + next/typescript) for the whole monorepo
npm run typecheck        # tsc for shared, student, teacher, admin
npm run prisma:validate  # works without DATABASE_URL (uses a placeholder)
npm run verify           # core suite: auth, leaderboard, digest, Excel, lifecycle, SSO,
                         # workspace route authorization (401/403), middleware, adapter
npm run build            # all 3 portals
npm run test:e2e         # Playwright smoke tests (run `npm run build` first; first time:
                         # `npx playwright install chromium`)
```

`.github/workflows/ci.yml` runs lint → typecheck → prisma:validate → verify → build, then the Playwright job, on every pull request and on pushes to `main`.

---

## Sessions

Sessions last up to 7 days, but every protected page and API call re-checks the account in the database. Deactivating or deleting a user, changing their role, or resetting their password ends their sessions right away. Changing your own password signs out your other devices.

---

## Production Database Notes

- **Prefer `DATABASE_URL`** (Supabase transaction pooler). The PostgREST adapter (`packages/shared/src/db-adapter/`) keeps a short-lived in-memory snapshot of every table and re-downloads it on cache misses. Large digest email bodies (`EmailDigestLog.htmlPreview`) are left out and loaded on demand. Cost still grows with total data, not per-request data.
- The adapter's `$transaction` is **compensating, not atomic**. PostgREST can't hold a transaction open, so on failure the completed steps are undone in reverse order, and other readers can briefly see intermediate states.

---

## Data Privacy & Student Records

- **Never commit real student data** (names, student numbers, APC emails) to this repository. `supabase/*_students.sql` is git-ignored. Use the Teacher Portal roster import, or a local copy of `supabase/students.example.sql`.
- Seed data, templates, tests and UI placeholders use fictional people and `2099-…` student numbers.
- A real roster was committed in earlier history. Purging it is a coordinated history rewrite: [`docs/maintenance/purge-roster-history.md`](docs/maintenance/purge-roster-history.md).

---

## Deploying to Vercel as 3 Separate Projects

Because `apps/student`, `apps/teacher`, and `apps/admin` live in dedicated folders inside one repository, create **3 separate Vercel Projects** pointing to the same Git repository:

| Vercel Project | Root Directory | Build Command | Output Directory |
| --- | --- | --- | --- |
| **rizlife-student** | `apps/student` | `npm run build` | `.next` |
| **rizlife-teacher** | `apps/teacher` | `npm run build` | `.next` |
| **rizlife-admin** | `apps/admin` | `npm run build` | `.next` |

### Vercel Settings Checklist for Each Project
1. **Include source files outside Root Directory:** Ensure **"Include files outside the Root Directory in the Build Step"** is enabled under **Settings → Build & Development Settings** so `@rizlife/shared` resolves properly.
2. **Environment Variables (identical `DATABASE_URL` & `JWT_SECRET` across all 3):**
   - `DATABASE_URL` — your shared Supabase / Neon PostgreSQL connection string
   - `JWT_SECRET` — strong random 32+ character string
   - `NEXT_PUBLIC_STUDENT_PORTAL_URL` — e.g. `https://rizlife-student.vercel.app`
   - `NEXT_PUBLIC_TEACHER_PORTAL_URL` — e.g. `https://rizlife-teacher.vercel.app`
   - `NEXT_PUBLIC_ADMIN_PORTAL_URL` — e.g. `https://rizlife-admin.vercel.app`
   - `CRON_SECRET` — **required** on the teacher project: a random string of 16+ characters. Without it the scheduled digest endpoint (`/api/cron/digest`) refuses every call. Vercel sends it to the cron automatically.
   - Email transport (`RESEND_API_KEY` or `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM`)
   - Phase 2 SSO (optional until APC IT provides keys): `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`

---

## How OpenLearning Direct Links Work
Students **can** copy a direct link to their specific OpenLearning submission output:
1. **Activity / Gallery Posts (*Post Text, Post Image, Post File, Share Anything*):** Navigate to the post in OpenLearning, **right-click the post timestamp** (e.g. *"2 hours ago"*), and choose **Copy Link Address**.
2. **OpenLearning Portfolio:** Open **Profile → Portfolio → Share / Copy link**.
3. **External Outputs (Canva / Google Drive / YouTube):** Paste the shareable view link directly; teachers open it in one click from the Review Queue or Master Class Tracker.

An interactive collapsible guide and live URL detector are embedded inside every student's Quest Submission drawer.

---

## Enabling APC Microsoft Entra ID SSO (Phase 2)
Once APC IT provides an Entra ID App Registration for `@student.apc.edu.ph` and `@apc.edu.ph`:
1. Register all 3 callback URLs in Azure Portal:
   - `https://<student-domain>/api/auth/microsoft/callback`
   - `https://<teacher-domain>/api/auth/microsoft/callback`
   - `https://<admin-domain>/api/auth/microsoft/callback`
2. Add `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, and `AZURE_AD_TENANT_ID` to Vercel env vars.
3. The **"Sign in with APC Microsoft Account"** button activates automatically on all 3 login screens and matches users by `microsoftOid` or lowercase APC email.
