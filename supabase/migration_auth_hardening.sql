-- ============================================================================
-- RizLife QuestCard: sign-in hardening migration (2026-11)
-- Run in Supabase Dashboard -> SQL Editor -> New Query, BEFORE deploying the app
-- version that reads these columns (sign-in fails without them).
-- Requires migration_security_hardening.sql (User."sessionVersion") first.
-- Safe to re-run (idempotent). Fresh installs get these from setup.sql.
-- ============================================================================

-- Temporary passwords expire (7 days after they're issued).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tempPasswordExpiresAt" TIMESTAMP(3);

-- Per-account lockout after repeated failed password sign-ins.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Verification: expect 3 rows.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'User'
  AND column_name IN ('tempPasswordExpiresAt', 'failedLoginCount', 'lockedUntil')
ORDER BY column_name;
