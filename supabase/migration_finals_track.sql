-- ============================================================================
-- RizLife QuestCard: Migration for Finals Track & OpenLearning Module
-- Run this query inside Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

-- 1. Create FinalsTrack enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE "FinalsTrack" AS ENUM ('UNDECIDED', 'SYSTEM', 'OPENLEARNING_MODULE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add columns to Enrollment table
ALTER TABLE "Enrollment" 
  ADD COLUMN IF NOT EXISTS "finalsTrack" "FinalsTrack" NOT NULL DEFAULT 'UNDECIDED',
  ADD COLUMN IF NOT EXISTS "assignedModuleTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedModuleUrl" TEXT;

-- 3. Permissions: the app's server key (service_role) only. The public API roles
--    (anon / authenticated) get no table access; see migration_security_hardening.sql.
GRANT ALL ON TABLE "Enrollment" TO postgres, service_role;
REVOKE ALL ON TABLE "Enrollment" FROM anon, authenticated;
