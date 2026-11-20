-- ============================================================================
-- RizLife QuestCard Management System — Complete Supabase SQL Setup & Seed
-- Paste this entire script into: Supabase Dashboard -> SQL Editor -> New Query
-- Safe to re-run multiple times (idempotent).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS "public";

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "QuestCategory" AS ENUM ('SELF_PACED', 'ON_SITE_LIBRARY', 'CREATIVE_OUTPUT', 'REFLECTION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubmissionStatus" AS ENUM ('NOT_STARTED', 'PENDING_REVIEW', 'STAMPED', 'NEEDS_REVISION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "courseCode" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "microsoftOid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Section" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "teacherId" TEXT,
    "leaderboardVisible" BOOLEAN NOT NULL DEFAULT false,
    "digestThreshold" INTEGER NOT NULL DEFAULT 20,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDigestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Quest" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "taskNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "QuestCategory" NOT NULL DEFAULT 'SELF_PACED',
    "openlearningUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Submission" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submissionUrl" TEXT,
    "studentNote" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "teacherFeedback" TEXT,
    "firstSubmittedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "stampedAt" TIMESTAMP(3),
    "stampedById" TEXT,
    "includedInDigest" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailDigestLog" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "submissionCount" INTEGER NOT NULL,
    "triggerType" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "htmlPreview" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDigestLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "activeTerm" TEXT NOT NULL DEFAULT 'Term 2 AY 2026-2027',
    "defaultDigestThreshold" INTEGER NOT NULL DEFAULT 20,
    "digestCronSchedule" TEXT NOT NULL DEFAULT '0 8,17 * * *',
    "emailProvider" TEXT NOT NULL DEFAULT 'preview',
    "emailFromAddress" TEXT NOT NULL DEFAULT 'RizLife QuestCard <noreply@rizlife.apc.edu.ph>',
    "allowedStudentDomain" TEXT NOT NULL DEFAULT 'student.apc.edu.ph',
    "allowedStaffDomain" TEXT NOT NULL DEFAULT 'apc.edu.ph',
    "microsoftSsoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_studentId_key" ON "User"("studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_microsoftOid_key" ON "User"("microsoftOid");
CREATE INDEX IF NOT EXISTS "Section_teacherId_idx" ON "Section"("teacherId");
CREATE UNIQUE INDEX IF NOT EXISTS "Section_code_term_key" ON "Section"("code", "term");
CREATE INDEX IF NOT EXISTS "Enrollment_sectionId_idx" ON "Enrollment"("sectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Enrollment_studentId_sectionId_key" ON "Enrollment"("studentId", "sectionId");
CREATE INDEX IF NOT EXISTS "Quest_sectionId_idx" ON "Quest"("sectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Quest_sectionId_taskNumber_key" ON "Quest"("sectionId", "taskNumber");
CREATE INDEX IF NOT EXISTS "Submission_status_includedInDigest_idx" ON "Submission"("status", "includedInDigest");
CREATE INDEX IF NOT EXISTS "Submission_studentId_idx" ON "Submission"("studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Submission_questId_studentId_key" ON "Submission"("questId", "studentId");
CREATE INDEX IF NOT EXISTS "EmailDigestLog_sectionId_sentAt_idx" ON "EmailDigestLog"("sectionId", "sentAt");

-- 4. Foreign Keys
DO $$ BEGIN
  ALTER TABLE "Section" ADD CONSTRAINT "Section_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Quest" ADD CONSTRAINT "Quest_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Submission" ADD CONSTRAINT "Submission_questId_fkey"
    FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Submission" ADD CONSTRAINT "Submission_stampedById_fkey"
    FOREIGN KEY ("stampedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmailDigestLog" ADD CONSTRAINT "EmailDigestLog_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmailDigestLog" ADD CONSTRAINT "EmailDigestLog_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Global Settings Row
INSERT INTO "SystemSetting" (
  "id",
  "activeTerm",
  "defaultDigestThreshold",
  "digestCronSchedule",
  "emailProvider",
  "emailFromAddress",
  "allowedStudentDomain",
  "allowedStaffDomain",
  "microsoftSsoEnabled",
  "updatedAt"
) VALUES (
  'global',
  'Term 2 AY 2026-2027',
  20,
  '0 8,17 * * *',
  'preview',
  'RizLife QuestCard <noreply@rizlife.apc.edu.ph>',
  'student.apc.edu.ph',
  'apc.edu.ph',
  false,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- 6. First Admin, First Teacher, and Student (vpalobin@student.apc.edu.ph)
-- Passwords:
--   Admin   (admin@apc.edu.ph)              -> Admin@RizLife2026
--   Teacher (teacher@apc.edu.ph)            -> Teacher@RizLife2026
--   Student (vpalobin@student.apc.edu.ph)   -> Student@2026
INSERT INTO "User" (
  "id", "studentId", "firstName", "middleName", "lastName",
  "email", "passwordHash", "role", "courseCode",
  "mustChangePassword", "isActive", "createdAt", "updatedAt"
) VALUES
(
  'usr_admin_01',
  NULL,
  'Clarisse',
  NULL,
  'Valdez',
  'admin@apc.edu.ph',
  '$2b$10$Cy7lPoCH/5hxqLN241wX7.0nAiIFq5aU0FqyIDxgMjmARFaNEOkQe',
  'ADMIN',
  NULL,
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'usr_teacher_01',
  NULL,
  'Elena',
  NULL,
  'Mendoza',
  'teacher@apc.edu.ph',
  '$2b$10$k2ee53CavLcz6KlRu2kug.9Tvcq7lXcHjJNr0L05IZGBvNabEj9Lu',
  'TEACHER',
  NULL,
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'usr_student_vince',
  '2024-140001',
  'Vince',
  NULL,
  'Alobin',
  'vpalobin@student.apc.edu.ph',
  '$2b$10$N2qYNY8Prf2CFM4ZVkIK8OjpaDFbA.E6xLCCWystzp0L32dFcWp6i',
  'STUDENT',
  'BSIT',
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;

-- 7. Section BSIT assigned to the First Teacher (tasks left empty for testing)
INSERT INTO "Section" (
  "id",
  "code",
  "name",
  "term",
  "teacherId",
  "leaderboardVisible",
  "digestThreshold",
  "digestEnabled",
  "createdAt",
  "updatedAt"
) VALUES (
  'sec_bsit_t2',
  'BSIT',
  'Life and Works of Rizal (BSIT)',
  'Term 2 AY 2026-2027',
  'usr_teacher_01',
  false,
  20,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code", "term") DO NOTHING;

-- 8. Enroll Vince Alobin (vpalobin@student.apc.edu.ph) into Section BSIT
INSERT INTO "Enrollment" (
  "id",
  "studentId",
  "sectionId",
  "enrolledAt"
)
SELECT
  'enr_vince_bsit',
  u."id",
  s."id",
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Section" s ON s."code" = 'BSIT' AND s."term" = 'Term 2 AY 2026-2027'
WHERE u."email" = 'vpalobin@student.apc.edu.ph'
ON CONFLICT ("studentId", "sectionId") DO NOTHING;

-- 9. Grant Supabase API Role Permissions (for SUPABASE_URL + SUPABASE_SECRET_KEY)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;

-- 10. Quick Verification Output
SELECT
  u."role",
  u."email",
  u."firstName",
  u."lastName",
  u."studentId",
  s."code" AS "sectionCode"
FROM "User" u
LEFT JOIN "Section" s ON s."teacherId" = u."id"
  OR EXISTS (
    SELECT 1 FROM "Enrollment" e WHERE e."studentId" = u."id" AND e."sectionId" = s."id"
  )
ORDER BY u."role", u."email";
