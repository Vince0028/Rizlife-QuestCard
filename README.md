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

### 2. Configure PostgreSQL (`DATABASE_URL`)
Copy `.env.example` to `.env` at the repository root and set `DATABASE_URL` (using **Supabase**, **Neon**, or local Docker Postgres via `docker compose up -d`).

> **Note for Supabase on Vercel:** Use the **Transaction Pooler** URL for `DATABASE_URL` (`?pgbouncer=true&connection_limit=1` on port `6543`), or run `db:push` using your direct/session connection string.

### 3. Push Schema & Seed Demo Data (or Run Supabase SQL)
If using Supabase, you can either run `supabase/setup.sql` directly inside **Supabase Dashboard → SQL Editor** (which creates all tables plus `admin@apc.edu.ph`, `teacher@apc.edu.ph`, `vpalobin@student.apc.edu.ph`, and section `BSIT`), or use Prisma:
```bash
npm run db:push
npm run db:seed
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

| Portal | Role | Email | Password | Notes |
| --- | --- | --- | --- | --- |
| **Student** (`:3001`) | `STUDENT` | `jdelacruz@student.apc.edu.ph` | `Student@2026` | 7 Stamped, 2 Pending, 1 Revision |
| **Student** (`:3001`) | `STUDENT` | `msantos@student.apc.edu.ph` | `Student@2026` | Demonstrates forced password change |
| **Teacher** (`:3002`) | `TEACHER` | `prof.mendoza@apc.edu.ph` | `Teacher@RizLife2026` | Owns section `IT241` (10 students, 12 quests) |
| **Teacher** (`:3002`) | `TEACHER` | `prof.reyes@apc.edu.ph` | `Teacher@RizLife2026` | Owns section `IT242` |
| **Admin** (`:3003`) | `ADMIN` | `admin@apc.edu.ph` | `Admin@RizLife2026` | Full system + teacher override access |

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
   - `CRON_SECRET` — secret bearer token for `apps/teacher`'s scheduled cron (`/api/cron/digest`)
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
