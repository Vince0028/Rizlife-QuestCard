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

-- 3. Verify permissions for service_role and authenticated roles
GRANT ALL ON TABLE "Enrollment" TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Enrollment" TO authenticated;
