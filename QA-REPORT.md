# RizLife QuestCard: Quality Assurance Report

**Date:** 2026-11-27
**Branch:** `branch/maru` (commit `8de6bc6` plus uncommitted deadline-state work)
**Scope:** the whole monorepo: `apps/student`, `apps/teacher`, `apps/admin`, `packages/shared`, `supabase/*.sql`, and the build and deploy configuration.

---

## 0. Status update (2026-11-27): maintenance pass for T1–T7 and M10

| Item | Status | Notes |
|---|---|---|
| **T1** Duplicated routes and middleware | ✅ Done | `packages/shared/src/workspace-routes.ts` (`createWorkspaceRoutes(getSession)`) and `portal-middleware.ts`. The 30 app route files are now 4–7 line re-exports. |
| **T2** Large files | 🟡 Partly done | The adapter is split into `packages/shared/src/db-adapter/` (10 modules). Types and helpers moved out of `TeacherWorkspace`, `AdminDashboardClient` and `StudentDashboardClient`. Splitting the UI tabs is a follow-up, now that e2e tests exist. |
| **T3** Adapter scalability | ✅ Done (mitigated) | `EmailDigestLog.htmlPreview` is lazy: excluded from snapshots and fetched for just the rows a read returns. The workspace and admin payloads no longer carry it; the teacher UI loads it via `GET …/digest-logs/[logId]`. Transactions are documented as compensating, not atomic. The README now recommends `DATABASE_URL` for production. |
| **T4** Lint and CI | ✅ Done | ESLint 9 flat config, `npm run lint` with 0 errors, and `.github/workflows/ci.yml` (lint → typecheck → prisma:validate → verify → build, then e2e). |
| **T5** HTTP and UI tests | ✅ Done | `__tests__/route-auth.ts` (401/403/2xx for every workspace handler, plus middleware). Mutation-checked: removing the section-ownership check fails the suite. Also `__tests__/adapter-lazy-columns.ts` and `e2e/smoke.spec.ts` (6 Playwright tests). |
| **T6** Docs drift | ✅ Done | `.env.example` explains the three DB modes with `DATABASE_URL` examples. `prisma:validate` works without `DATABASE_URL`. The README lists `migration_finals_track.sql`. |
| **T7** Student PII | ✅ Done at the tip, ⚠️ still in history | The roster is untracked and git-ignored (`supabase/*_students.sql`). Every real person is replaced with fictional demo data. **The GitHub repository is public** (API returned 200 on 2026-11-27), so the roster in earlier commits is publicly readable. Follow `docs/maintenance/purge-roster-history.md`. |
| **M10** Dependencies | 🟡 Partly done | `nodemailer` → 10.6.1 and `zod` → 4.6.7 fix the two runtime-relevant highs, and the arrays are capped. `npm audit --omit=dev` went from **10 to 8** findings. Remaining items are below. |

**Remaining `npm audit --omit=dev` findings (8: 5 high, 3 moderate). None is reachable from this app's runtime code paths:**
- **`postcss` ≤8.5.22 (high), via `next@15.5.29`, the newest 15.x.** Next pins `postcss@8.4.31`. It's used at build time on the project's own CSS, not on user input. The fix is Next 16 (a major upgrade). An npm `overrides` entry was tried, but npm 11 didn't apply it to this workspace tree; forcing it through the lockfile left `npm ls` reporting an invalid tree, so it was reverted.
- **`deepmerge-ts` <8 and `effect` ≤3.22 (high), via `prisma@6.19.3` → `@prisma/config`.** These are CLI and config tooling. The `prisma` CLI stays in the production tree as a peer of `@prisma/client`. The fix is Prisma 7 (a major upgrade with driver adapters).
- **`uuid` <11.1.1 (moderate), via `exceljs@4.4.0`.** The advisory concerns `v3`/`v5`/`v6` with a caller-supplied buffer; exceljs only calls `v4()`. npm didn't apply an override here either.

**Follow-ups found during this pass:**
- **Teacher UI: the Edit/Delete Section modal is unreachable.** `openEditSectionModal` exists, but no button calls it. Also unwired: `selectStampCardQuest` and `requestStampCardAction` in `TeacherWorkspace.tsx`, and `handleReassignTeacher` in `AdminDashboardClient.tsx`. Each is marked with a `TODO` lint-disable so it stays visible.
- ESLint 9.39 is out of support. `eslint-config-next@15.5` doesn't support ESLint 10, so this upgrade comes with the Next 16 move.
- The H1, H2 and H4 security items are unchanged by this pass, and the public repository makes them more urgent.

---

## 0b. Status update (2026-11-27): hardening pass for M2, M6–M9, L2–L9, L11

| Item | Status | Notes |
|---|---|---|
| **M2** Teacher enrollment scoping | ✅ Done | Existing accounts are linked only when the email **and** the Student ID both match. Teachers can't reset the password, email or Student ID of a student who is also in another teacher's section (admins can). |
| **L4** Bulk import | ✅ Done | Errors cite the real file line or sheet row (including blank lines and quoted newlines). Parse errors count as skipped. `allowedStudentDomain` is enforced on create, import and edit. |
| **M6** Unused settings | ✅ Done | `microsoftSsoEnabled` now gates the login button, the login start and the callback on all 3 portals. The digest schedule is shown read-only and pinned to `apps/teacher/vercel.json`; verify fails if the two drift apart. |
| **M7** Digest provider fallback | ✅ Done | A missing Resend/SMTP key is now `FAILED` with a clear message. Only `SENT` takes submissions out of the queue. The teacher digest tab shows a warning banner and per-log errors; the admin settings show a warning for the missing key. |
| **L7** Threshold digest | ✅ Done | Runs after the response via `after()`. An atomic per-section claim (`Section.lastDigestSentAt`) plus an in-process guard prevent double sends; a 15-minute threshold cooldown stops a retry storm against a failing provider. Tested with 5 concurrent triggers → 1 digest. |
| **M8 / L9** Admin routes | ✅ Done | User updates validated with Zod. Self-demotion and removing the last active admin (by demotion, deactivation or deletion) are blocked. A missing section or user returns 404. |
| **M9 / L5** Finals track | ✅ Done | A student's track choice no longer clears the teacher-assigned module. Module URLs must be http(s). |
| **L2** Error leaks | ✅ Done | Unexpected errors return a generic 500 (details logged server-side). Prisma constraint codes map to 404/409. |
| **L3** Invalid dates / duplicate task numbers | ✅ Done | Now 400/409 with readable messages. A deadline before the start date is rejected. |
| **L6** Headers / CSRF | ✅ Done | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` on all portals. Cross-origin POST/PATCH/DELETE to `/api/*` (including login) returns 403. A full script CSP is still to do (it needs nonces). |
| **L8** Client fetch handling | ✅ Done | One `apiFetch` helper (never throws, safe JSON, always an `error` message) replaces 38 raw `fetch` calls in the teacher, admin and student UIs. |
| **L11** Dead code / counts | ✅ Done | The unused URL normalisation was removed; `updateEnrollmentTrack` returns the real updated count. |

**M3** (student leaderboard payload) and **M4** (Asia/Manila timestamps on UTC hosts) were fixed on 2026-11-28 and are covered by `__tests__/timezone-privacy.ts`.

Still open from §3: **H1–H4**, **M1** (cron endpoint is open when `CRON_SECRET` is unset), **M5**, **L1**, **L10**.

---

## 1. Summary

The project builds cleanly, type-checks in all four workspaces, and passes its verification suite. Access to teacher workspaces is checked the same way on every route, and the Microsoft SSO flow is carefully hardened.

The main risks are **account security** and the **Supabase setup**, not the application logic:

1. The seeded admin, teacher and student accounts use passwords written in the repository, and they are **not forced to change them**.
2. Every student starts with the same known password, emails are predictable, and login has no rate limiting. A classmate can sign in first and take over an account.
3. Sessions cannot be revoked. A user who is deactivated, deleted or demoted keeps their access, including admin rights, for up to 7 days.
4. The Supabase SQL scripts never enable Row Level Security, and one migration grants the `authenticated` role full access to `Enrollment`.

Also confirmed: a **timezone bug**. Leaderboard times and Excel export dates are formatted in the server's timezone, which is UTC on Vercel, so they are 8 hours behind Manila time.

| Severity | Count |
|---|---|
| High | 4 |
| Medium | 10 |
| Low | 11 |
| Maintainability / tooling | 7 |

---

## 2. Automated checks

| Check | Command | Result |
|---|---|---|
| Typecheck (shared, student, teacher, admin) | `npm run typecheck` | ✅ Pass, 0 errors |
| Core verification suite | `npm run verify` | ✅ Pass (auth, hashing, URL check, leaderboard, digest, Excel, submission lifecycle, SSO callback, deadline states) |
| Student build | `npm run build:student` | ✅ Pass |
| Teacher build | `npm run build:teacher` | ✅ Pass |
| Admin build | `npm run build:admin` | ✅ Pass |
| Prisma schema | `npm run prisma:validate` | ⚠️ **Fails** when `DATABASE_URL` is unset (the default Supabase setup). The schema is valid when a placeholder URL is supplied. |
| Dependency audit | `npm audit --omit=dev` | ❌ **10 vulnerabilities (7 high, 3 moderate)**. See [M10](#m10-known-vulnerable-dependencies). |
| Lint | n/a | ⚠️ No ESLint configuration exists |
| CI | n/a | ⚠️ No CI pipeline (`.github/` is absent) |

---

## 3. Findings

Each finding lists where it is, what can go wrong, and the recommended fix.

### High

#### H1. Seeded accounts use passwords from the repository and are not forced to change them
- **Where:** `supabase/setup.sql:229-277`. The admin (`admin@apc.edu.ph` / `Admin@RizLife2026`), the teacher, and the demo student are all inserted with `mustChangePassword = false` (lines 247, 262, 277). The same passwords appear in `README.md:60-64` and in the `setup.sql` comments.
- **Impact:** if production was seeded with `setup.sql`, which is the documented Supabase path, anyone who has read the repo can sign in to the **admin portal** and has full control: users, password resets, settings, and deleting sections.
- **Fix:**
  - Rotate the admin and teacher passwords in the live database now.
  - Change `setup.sql` to insert these accounts with `mustChangePassword = true`.
  - Better still, generate a random admin password at setup time and keep it out of the repo.

#### H2. Student accounts can be taken over before the student first signs in
- **Where:**
  - `supabase/bsit241_students.sql` gives all 34 students the same password, `Student@2026`.
  - `packages/shared/src/password.ts:17-23`: `generateDefaultPassword` produces `RizLife@` plus the last 6 digits of the student ID, which classmates can easily know.
  - `packages/shared/src/portal-auth.ts:26-111` has no rate limiting or lockout.
  - Student emails follow a predictable initials-plus-surname pattern.
- **Impact:** anyone in the class can sign in as a classmate with the shared password and change it on the forced change-password screen. The real student is locked out and their submissions can be altered. A student who only ever uses Microsoft SSO still has the default password active, because SSO never clears it.
- **Fix:**
  - Issue random per-student temporary passwords, or require SSO once Entra ID is enabled.
  - Add login rate limiting per IP and per account, for example with Upstash or a DB counter.
  - Let temporary passwords expire.

#### H3. Sessions can't be revoked, and the token's role is trusted for 7 days
- **Where:**
  - `packages/shared/src/auth.ts:55`: the session lasts 7 days.
  - `auth.ts:59-97` verifies the signature only.
  - `apps/*/src/lib/session.ts` never re-reads the user from the database.
  - `workspace-service.ts:56` trusts `user.role` from the token.
- **Impact:**
  - **Deactivating** a user (`isActive = false`) doesn't sign them out.
  - **Deleting** a user doesn't sign them out.
  - An admin who is **demoted** keeps admin access, including teacher-override of every section, until the token expires.
  - Resetting a password doesn't end existing sessions.
- **Fix:** in `get*Session()`, load the user, then reject the session if the user is inactive or missing, or if the role or `mustChangePassword` no longer match. Also add a `sessionVersion` (or `passwordChangedAt`) column and compare it with a token claim, so a password change or reset revokes old tokens. One indexed lookup per request is cheap.

#### H4. Supabase tables have no Row Level Security, and the `authenticated` role can write to `Enrollment`
- **Where:**
  - `supabase/setup.sql:341-345` and `supabase/bsit_24_tasks.sql:180-184` never run `ENABLE ROW LEVEL SECURITY`.
  - `supabase/migration_finals_track.sql:21` runs `GRANT SELECT, INSERT, UPDATE, DELETE ON "Enrollment" TO authenticated`.
- **Impact:** the app reaches Supabase with the secret (service-role) key. RLS doesn't change that path, because the service role bypasses it. Through the public PostgREST API, though, these tables are protected only by role grants:
  - Supabase gives `anon` and `authenticated` access to new `public` tables by default.
  - The migration explicitly grants `authenticated` full access to `Enrollment`.
  - If Supabase Auth sign-ups are enabled (the default), anyone with the project URL and the publishable key can register, get an `authenticated` token, and read or modify enrollments.
  - Depending on project defaults, that may also extend to `User.passwordHash`.
- **Fix:**
  - Add `ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;` for all 7 tables, with no policies. The service role keeps working.
  - Run `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`.
  - Drop line 21 of the migration.
  - Disable Supabase Auth sign-ups, since the app doesn't use them.
  - Confirm in the Supabase dashboard's Security Advisor.

### Medium

#### M1. The digest cron endpoint is open when `CRON_SECRET` is unset
- **Where:** `apps/teacher/src/app/api/cron/digest/route.ts:7-13`. The auth check only runs `if (cronSecret)`, and the middleware exempts `/api/cron/`.
- **Impact:** if a deployment forgets the variable, anyone can call `GET /api/cron/digest` repeatedly. That sends digest emails to every teacher and marks submissions as digested.
- **Fix:** fail closed. Return 401 (or 500) when `CRON_SECRET` is missing in production.

#### M2. A teacher can pull any student into their section, then reset that student's password or edit their account
- **Where:**
  - `workspace-service.ts:712-766`: `createOrEnrollStudent` matches an existing account by email **or** student ID and enrolls it.
  - `workspace-service.ts:856-875` (`resetManagedUserPassword`) and `:930-949` (`updateManagedStudent`) only check for "enrolled in *any* of my sections".
- **Impact:** teacher scoping can be bypassed. A teacher adds another section's student by email or ID, becomes allowed to reset that student's password and change their email, and can then sign in as them. Separately, a mistyped student ID silently enrolls a different person and ignores the name and email that were typed.
- **Fix:**
  - When an existing account is found, require both email and student ID to match.
  - Restrict password resets and email edits on shared accounts to admins.
  - Report when the typed details differ from the stored account.

#### M3. The student leaderboard API exposes classmates' student numbers
- **Where:** `apps/student/src/app/api/questcard/route.ts:73-109` returns `computeLeaderboard` output in full. `leaderboard.ts:85-100` includes `studentNumber`, `middleName`, `pendingCount` and `cumulativeTimeMs` for every classmate.
- **Impact:** the UI only shows name, course and stamp count, but any student can read every classmate's school ID number in the network tab. This is a privacy issue under the PH Data Privacy Act.
- **Fix:** map the entries to `{ rank, studentId (user id), fullName, courseCode, stampedCount, totalQuests, completionPct, speedLabel }` before responding.

#### M4. Leaderboard times and Excel export dates use the server's timezone (confirmed)
- **Where:**
  - `leaderboard.ts:28-38`: `toLocaleString("en-PH")` with no `timeZone`, run on the server in `/api/questcard` and the workspace route.
  - `excel.ts:32-33` and `excel.ts:64-67`: deadlines and the Timestamps Log.
- **Evidence:** `formatSpeedTimestamp("2026-11-10T08:00:00Z")` returns `Nov 10, 08:00 AM` with `TZ=UTC` and `Nov 10, 04:00 PM` with `TZ=Asia/Manila`.
- **Impact:** on Vercel, which runs in UTC:
  - The "Milestone Reached" times shown to students and teachers are 8 hours behind.
  - Exported deadlines between 00:00 and 07:59 Manila time land on the previous day.
  - Exported submission timestamps are 8 hours off.
- **Fix:** pass `timeZone: "Asia/Manila"`. `packages/shared/src/deadline.ts` already exports `QUEST_DEADLINE_TIME_ZONE` and Manila formatters for this.

#### M5. Login reveals whether an account exists and what its role is
- **Where:** `portal-auth.ts:54-79`. The role check runs **before** the password check and returns 403 *"This portal is restricted to TEACHER / ADMIN accounts"*. Unknown emails return 401 immediately, without bcrypt work.
- **Impact:** without a password, an attacker can find out which emails exist and which ones belong to staff or admins. Combined with H1 and H2, this points them at the most valuable accounts.
- **Fix:** verify the password first, using a dummy hash when the user is missing. Return the same generic 401 for every failure, and show the "wrong portal" message only after a correct password.

#### M6. Two admin settings do nothing
- **Where:**
  - `SystemSetting.microsoftSsoEnabled` and `digestCronSchedule` are saved by the admin UI, but nothing reads them. Searching outside the schema, adapter and admin form finds no uses.
  - SSO turns on from environment variables alone (`microsoft-sso.ts:21-45`).
  - The cron schedule is fixed in `apps/teacher/vercel.json`: `0 0,9 * * *` UTC, which is 08:00 and 17:00 Manila.
- **Impact:** an admin who switches SSO "off" or changes the digest schedule sees the change saved, but behaviour doesn't change.
- **Fix:** either enforce `microsoftSsoEnabled` in `isMicrosoftSsoConfigured()` and the SSO login routes, or remove the toggles. Show the cron schedule as read-only.

#### M7. An email-provider misconfiguration silently marks submissions as notified
- **Where:** `digest.ts:318-326`: with `resend` or `smtp` selected but no credentials, the status falls back to `PREVIEW_ONLY`. `digest.ts:416-427` then sets `includedInDigest = true` for anything that isn't `FAILED`.
- **Impact:** the teacher never gets an email, those submissions never appear in a later digest, and nothing flags the problem. Only the admin's environment status panel would hint at it.
- **Fix:** when the configured provider has no credentials, return `FAILED` with a clear error, or leave `includedInDigest = false`. Show a warning in the teacher workspace when the last digest wasn't `SENT`.

#### M8. `PATCH /api/admin/users/:id` doesn't validate its input
- **Where:** `apps/admin/src/app/api/admin/users/[userId]/route.ts:15-81`. The body is cast, not parsed with Zod.
- **Impact:**
  - `email: ""` saves an empty email, because the conflict check is skipped for falsy values but the update still runs.
  - An unknown `role` or non-string names cause a 500.
  - An admin can demote their own account, which can leave the system with **no admins**.
- **Fix:** add an `updateUserAdminSchema`. Block self-demotion and changes that would remove the last active admin.

#### M9. A student's track choice wipes the module the teacher assigned
- **Where:** `apps/student/src/app/api/finals-track/route.ts:243-252`.
- **Impact:** if a student picks *System* and then switches back to *Module*, the module title and URL the teacher assigned are permanently erased. There's also no lock or deadline on switching tracks.
- **Fix:** keep the assigned module fields when a student picks SYSTEM; only teachers should clear them. Consider locking the choice after a date.

#### M10. Known-vulnerable dependencies
`npm audit --omit=dev` reports 10 vulnerabilities (7 high, 3 moderate):

| Package | Why it matters here | Fix path |
|---|---|---|
| `nodemailer` 6.10.1 (≤10.1.3) | Used for SMTP digests. Advisories include header and SMTP injection, address-parser DoS, and TLS validation issues. | Upgrade to 7.x or later. The major version change needs a quick API check. |
| `zod` 3.25.76 (<4.6.6) | Validates every request body. Includes memory exhaustion on oversized collections. `studentIds` (`validation.ts:146`) has no `.max()`. | Add `.max()` to arrays now; plan the Zod 4 migration. |
| `next` 15.5.29 → bundled `postcss` | Mostly a build-time path. | Move to a patched Next release. |
| `prisma` tooling (`deepmerge-ts`, `effect`) | CLI and dev tooling | Prisma 7, a major version change |
| `exceljs` → `uuid` | Low runtime exposure | Track upstream |

### Low

| # | Finding | Where | Fix |
|---|---|---|---|
| L1 | `mustChangePassword` is only enforced for pages. API routes still work, so an account still on its temporary password can submit or call any API directly. | `apps/*/src/middleware.ts:48` | Return 403 for `/api/*` except `/api/auth/*` while the flag is set. |
| L2 | `toWorkspaceError` sends raw `err.message` to the client on 500s, including Prisma and PostgREST internals. | `workspace-service.ts:26-37` | Return a generic message for non-`status` errors and log the details. |
| L3 | Invalid `startDate`/`deadline` strings and duplicate explicit `taskNumber` values produce 500s instead of 400 or 409. | `workspace-service.ts:331-342` | Validate with `z.string().datetime()` and catch unique-constraint errors. |
| L4 | Bulk import reports the wrong row numbers once any earlier row failed to parse (`i + 2` indexes the filtered list). `skippedCount` leaves out parse errors. Imported emails aren't checked against the allowed APC domain. | `workspace-service.ts:797-823`, `excel.ts:500-541` | Carry the source row number through `StudentImportRow` and enforce `allowedStudentDomain`. |
| L5 | `assignedModuleUrl` is stored without the http/https check that quest URLs get. React 19 blocks `javascript:` links, but nothing on the server checks it. | `workspace-service.ts:1029-1032` | Run it through `validateSubmissionUrl`. |
| L6 | No security headers are set (`X-Frame-Options`/`frame-ancestors`, CSP, `Referrer-Policy`), so the admin portal can be framed for clickjacking. Write requests rely only on `SameSite=Lax`, with no Origin check. | `apps/*/next.config.ts` | Add `headers()` with `frame-ancestors 'none'` and an Origin check in middleware for non-GET `/api/*`. |
| L7 | The threshold digest runs inside the student's submit request, so the 20th submitter waits on SMTP or Resend. Two near-simultaneous submissions can send the digest twice, and a failing provider is retried on every later submission. | `workspace-service.ts:682`, `digest.ts:453-475` | Defer the send (fire-and-forget with `after()` from `next/server`) and add a short "digest in progress" guard. |
| L8 | Client handlers call `await res.json()` without a guard, and network errors are largely uncaught (`TeacherWorkspace.tsx` has 20 `fetch` calls and 1 `catch`). A non-JSON error page or a dropped connection fails silently with no toast. | `TeacherWorkspace.tsx`, `AdminDashboardClient.tsx` | Use one `apiFetch` helper that parses safely and shows a toast. |
| L9 | Admin `DELETE /api/admin/sections/:id` has no error handling, so a missing ID returns a 500 HTML page. | `apps/admin/src/app/api/admin/sections/[sectionId]/route.ts:14` | Wrap it and return 404. |
| L10 | Password rules are inconsistent: 6 characters minimum for temporary, reset and admin-created passwords, but 8 for a user changing their own. | `validation.ts:132,178`, `workspace-service.ts:842` | Use one minimum (8 or more) everywhere. |
| L11 | Dead code. `reviewOrStampSubmission` validates `submissionUrl` and then never uses it. `updateEnrollmentTrack` returns the requested count, not the updated count. | `workspace-service.ts:493-507`, `:1046-1048` | Remove it or wire it in, and return `updateMany().count`. |

---

## 4. Maintainability, scalability and tooling

| # | Observation | Recommendation |
|---|---|---|
| T1 | All 15 teacher and admin `api/workspace/**` routes are byte-for-byte copies, apart from the session helper name. The three middlewares are also near-identical. A fix applied to one portal is easily missed in the other. | Export route factories from `@rizlife/shared`, e.g. `createWorkspaceRoutes(getSession)`, and keep thin re-exports in each app. |
| T2 | Some files are very large: `TeacherWorkspace.tsx` (3,665 lines), `AdminDashboardClient.tsx` (1,536), `supabase-adapter.ts` (1,610), `StudentDashboardClient.tsx` (~1,165). | Split by tab or feature (queue, roster, quests, digest, tracker). |
| T3 | **Scalability of the Supabase adapter.** Each cache miss (1.2 s TTL, per serverless instance) downloads **every table in full**, including the full HTML of each digest log. Transactions are applied step by step with undo-on-failure, so they are not atomic, and other readers can see intermediate states such as `taskNumber = -9999` during a reorder. That's fine for one section of 35 students, but cost and latency grow with total data, not per-request data. | For production, prefer `DATABASE_URL` through the Supabase transaction pooler so Prisma talks to Postgres directly. At minimum, stop pulling `EmailDigestLog.htmlPreview` in bulk. |
| T4 | There's no linter and no CI, so typecheck, verify and build only run when someone remembers. | Add ESLint (`next/core-web-vitals`) and a GitHub Actions workflow that runs `typecheck`, `verify` and `build` on every PR. |
| T5 | Test coverage reaches the service layer but not the HTTP layer. Nothing tests route authorization (teacher A vs. section B, student vs. teacher API, deactivated users), and nothing tests the UI. | Add route-level tests that call each handler with sessions for the wrong portal or section. Add a few Playwright smoke tests for log in → submit → stamp. |
| T6 | Docs and config have drifted: <ul><li>`.env.example` section 1 is titled "PostgreSQL Connection String" but has no `DATABASE_URL` line.</li><li>`npm run prisma:validate` fails in the default (no-`DATABASE_URL`) setup.</li><li>`supabase/migration_finals_track.sql` is mentioned in neither the README nor the project guidelines.</li></ul> | Add a commented `# DATABASE_URL=` line. Set the `directUrl`/`env` fallback or document the placeholder for validation. List the migration in the setup steps. |
| T7 | **Real student PII in the repository.** `supabase/bsit241_students.sql` contains 34 real names, student numbers and APC emails. | If the GitHub repo is (or becomes) public, this is a data-privacy disclosure. Move roster data out of git (import it through the teacher UI) and check the repo's visibility. |

---

## 5. What's working well

- **Portal isolation:** separate cookies per portal, role allow-lists checked both at login and on token verification, and middleware on all three apps.
- **Section scoping:** `assertSectionAccess` is called by every quest, section, review, roster and export operation.
- **Microsoft SSO:** single-use state cookie with PKCE, single-tenant enforcement, ID-token and Graph `oid` cross-check, exact domain match (no suffix tricks), and refusal to re-link an account bound to another Microsoft identity. All of this is covered by tests.
- **Production safety rails:** `JWT_SECRET` is required in production, and the adapter refuses the local JSON fallback in production.
- **Input validation:** Zod schemas cover most request bodies, and submission URLs must be http(s).
- **Output safety:** the digest email HTML is escaped, the digest preview renders in a `sandbox=""` iframe, external links use `rel="noopener noreferrer"`, and there's no `dangerouslySetInnerHTML`.
- **Data rules:** `firstSubmittedAt` is preserved across resubmissions, stamped submissions are locked, and last, first and middle names are kept separate throughout.
- **Type safety:** `strict` TypeScript is on everywhere, with zero type errors.

---

## 6. Recommended order of work

1. **Today:** rotate the admin and teacher passwords in the live DB (H1). Confirm `CRON_SECRET` is set on the teacher Vercel project (M1). Enable RLS and revoke `anon`/`authenticated` in Supabase (H4).
2. **This week:**
   - Session revalidation against the DB (H3).
   - Login rate limiting and the generic login error (H2, M5).
   - Per-student random temporary passwords (H2).
   - Trim the leaderboard payload (M3).
   - The Manila timezone fix (M4).
3. **Next:**
   - Tighten the teacher enrollment rules (M2).
   - Digest provider handling (M7).
   - Admin user validation and last-admin guard (M8).
   - Track-switch fix (M9).
   - Dependency upgrades (M10).
   - The unused settings (M6).
4. **Ongoing:** CI and lint (T4), route-level tests (T5), merging the duplicated routes (T1), and the Low items.

---

## 7. Scope and limits of this review

- **Covered:** static review of all server code (auth, middleware, every API route, the service layer, digest, Excel, the DB adapter, the SSO flow), the schema, the SQL scripts, the deploy config, and a sample of the UI clients. Also typecheck, the verify suite, all three production builds, Prisma validation and `npm audit`.
- **Not covered:**
  - Manual browser testing.
  - Load testing.
  - Checking the live Supabase project's actual grants and RLS state; H4 should be confirmed in its dashboard.
  - Checking whether the GitHub repository is public; this affects how urgent H1 and T7 are.
  - A line-by-line review of all 3,665 lines of `TeacherWorkspace.tsx`.
- **Uncommitted work in the tree:** the deadline-state changes on this branch are uncommitted. They type-check, pass their new tests in `deadline-states.ts`, and build.
