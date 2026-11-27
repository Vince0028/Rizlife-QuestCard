-- ============================================================================
-- RizLife QuestCard - Example class roster (FICTIONAL students)
--
-- Real rosters must NOT be committed: they contain students' names, student
-- numbers and APC emails (personal data under the PH Data Privacy Act).
-- Prefer the Teacher Portal's roster import (.xlsx / .csv). If you need SQL:
--   1. Copy this file to supabase/<section>_students.sql (git-ignored by the
--      `supabase/*_students.sql` pattern) and replace the rows.
--   2. Run it in Supabase Dashboard -> SQL Editor after setup.sql.
--
-- Starter password for every row: Student@2026 (students must change it on
-- first sign-in: mustChangePassword = true). Safe to re-run (idempotent).
-- ============================================================================

WITH roster (id, student_id, last_name, first_name, middle_name, course_code, email) AS (
  VALUES
    ('usr_stu_2099_000101', '2099-000101', 'Bautista',  'Andres',       'Cruz',    'BSIT', 'abautista@student.apc.edu.ph'),
    ('usr_stu_2099_000102', '2099-000102', 'Garcia',    'Liza Marie',   NULL,      'BSIT', 'lmgarcia@student.apc.edu.ph'),
    ('usr_stu_2099_000103', '2099-000103', 'Villanueva','Paolo',        'Ramos',   'BSCS', 'pvillanueva@student.apc.edu.ph')
)
INSERT INTO "User" (
  "id", "studentId", "lastName", "firstName", "middleName",
  "courseCode", "email", "passwordHash", "role",
  "mustChangePassword", "isActive", "createdAt", "updatedAt"
)
SELECT
  r.id,
  r.student_id,
  r.last_name,
  r.first_name,
  r.middle_name,
  r.course_code,
  r.email,
  '$2b$10$N2qYNY8Prf2CFM4ZVkIK8OjpaDFbA.E6xLCCWystzp0L32dFcWp6i', -- Student@2026
  'STUDENT'::"Role",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM roster r
ON CONFLICT ("email") DO NOTHING;

-- Enroll the roster into Section BSIT241 (created by setup.sql).
INSERT INTO "Enrollment" ("id", "studentId", "sectionId", "enrolledAt")
SELECT
  'enr_' || u."id",
  u."id",
  'sec_bsit_t2',
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."id" IN ('usr_stu_2099_000101', 'usr_stu_2099_000102', 'usr_stu_2099_000103')
ON CONFLICT ("studentId", "sectionId") DO NOTHING;
