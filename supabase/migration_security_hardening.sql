-- ============================================================================
-- RizLife QuestCard: security hardening migration (2026-11)
-- Run in Supabase Dashboard -> SQL Editor -> New Query, BEFORE deploying the app
-- version that reads "User"."sessionVersion" (the app fails to read users without it).
-- Safe to re-run (idempotent). Fresh installs get all of this from setup.sql.
--
-- What it does
--   1. Adds "User"."sessionVersion" (bumped to revoke a user's sessions).
--   2. Enables Row Level Security on all 7 app tables, with NO policies. The app
--      connects as service_role (SUPABASE_SECRET_KEY) or as the table owner
--      (DATABASE_URL); both bypass RLS, so the app is unaffected.
--   3. Revokes every table/sequence privilege from the public API roles
--      (anon = anyone holding the publishable key, authenticated = any Supabase Auth
--      user), now and for tables created later.
--
-- Also do these in the Supabase Dashboard (not possible from SQL):
--   * Authentication -> Sign In / Providers: turn OFF "Allow new users to sign up".
--     RizLife has its own accounts and never uses Supabase Auth.
--   * Advisors -> Security Advisor -> Refresh: "RLS Disabled in Public" should be gone.
--     "RLS Enabled No Policy" (INFO) on these tables is expected and intended.
-- ============================================================================

-- 1. Session revocation counter
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- 2. Row Level Security on every app table (no policies = no access for anon/authenticated)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Section" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailDigestLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemSetting" ENABLE ROW LEVEL SECURITY;

-- 3. No direct table access for the public API roles (RLS is the second layer)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
-- Tables created later by the SQL Editor (owner: postgres) don't get the grants back.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- The app's server-side key keeps full access.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Verification: expect rls_enabled = true and every anon_* / authenticated_* = false.
SELECT
  c.relname AS "table",
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE') AS anon_write,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE') AS authenticated_write,
  has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS service_role_full
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('User', 'Section', 'Enrollment', 'Quest', 'Submission', 'EmailDigestLog', 'SystemSetting')
ORDER BY c.relname;
