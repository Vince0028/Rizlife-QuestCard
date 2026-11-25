-- ============================================================================
-- RizLife QuestCard — Add 24 Tasks to Section BSIT (First Teacher & Vince Alobin)
-- Paste into: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Safe to re-run multiple times (idempotent upsert by sectionId + taskNumber).
-- ============================================================================

-- 1. Ensure Section BSIT (assigned to usr_teacher_01) and Vince's profile & enrollment exist
UPDATE "User"
SET
  "studentId" = '2024-140101',
  "lastName" = 'Alobin',
  "firstName" = 'Vince Nelmar',
  "middleName" = 'Pega',
  "courseCode" = 'BSIT',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" = 'vpalobin@student.apc.edu.ph';

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
  'BSIT241',
  'Life and Works of Rizal (BSIT241)',
  'Term 2 AY 2026-2027',
  'usr_teacher_01',
  false,
  20,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE
SET "code" = EXCLUDED."code",
    "name" = EXCLUDED."name",
    "teacherId" = EXCLUDED."teacherId",
    "updatedAt" = CURRENT_TIMESTAMP;

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
JOIN "Section" s ON s."id" = 'sec_bsit_t2'
WHERE u."email" = 'vpalobin@student.apc.edu.ph'
ON CONFLICT ("studentId", "sectionId") DO NOTHING;

-- 2. Insert / Update the 24 Quest Card Tasks for Section BSIT241
WITH bsit_section AS (
  SELECT "id" AS section_id
  FROM "Section"
  WHERE "id" = 'sec_bsit_t2'
  LIMIT 1
),
task_data (task_number, quest_id, title, category, description, openlearning_url) AS (
  VALUES
    (1,  'q_bsit_01', 'Revisiting the Law', 'SELF_PACED'::"QuestCategory",
         'Analyze Republic Act No. 1425 (The Rizal Law), its historical context, and why studying the life and works of Jose Rizal remains mandated in Philippine higher education.',
         'https://www.openlearning.com/apc/courses/rizlife/task-1-revisiting-the-law'),
    (2,  'q_bsit_02', 'TikTok Video: Rizal Law Reel', 'CREATIVE_OUTPUT'::"QuestCategory",
         'Create a short-form educational TikTok or Reel explaining the key arguments and significance of the Rizal Law (R.A. 1425) for today''s generation.',
         'https://www.openlearning.com/apc/courses/rizlife/task-2-tiktok-rizal-law-reel'),
    (3,  'q_bsit_03', 'My Modern Hero', 'REFLECTION'::"QuestCategory",
         'Reflect on the qualities of a hero in modern Philippine society and compare your chosen modern hero with the ideals of Dr. Jose Rizal.',
         'https://www.openlearning.com/apc/courses/rizlife/task-3-my-modern-hero'),
    (4,  'q_bsit_04', 'Social Media of Rizal', 'CREATIVE_OUTPUT'::"QuestCategory",
         'Design a creative social media profile and feed illustrating how Jose Rizal would communicate his travels, writings, and reforms online today.',
         'https://www.openlearning.com/apc/courses/rizlife/task-4-social-media-of-rizal'),
    (5,  'q_bsit_05', 'Secret Code Games', 'ON_SITE_LIBRARY'::"QuestCategory",
         'Decode hidden cipher messages and historical clues inspired by Rizal''s pseudonyms and correspondence.',
         'https://www.openlearning.com/apc/courses/rizlife/task-5-secret-code-games'),
    (6,  'q_bsit_06', 'Snakes and Ladders (Rizal Edition)', 'ON_SITE_LIBRARY'::"QuestCategory",
         'Complete the Rizal Edition Snakes and Ladders board activity tracing the milestones, triumphs, and trials in Rizal''s journey.',
         'https://www.openlearning.com/apc/courses/rizlife/task-6-snakes-and-ladders'),
    (7,  'q_bsit_07', 'A Birthday Poem for Rizal', 'CREATIVE_OUTPUT'::"QuestCategory",
         'Compose an original tribute poem celebrating the birth, patriotism, and enduring legacy of Dr. Jose Rizal.',
         'https://www.openlearning.com/apc/courses/rizlife/task-7-birthday-poem-for-rizal'),
    (8,  'q_bsit_08', 'Rizal''s Resume and Cover Letter', 'CREATIVE_OUTPUT'::"QuestCategory",
         'Draft a professional curriculum vitae and cover letter showcasing Rizal''s polymath skills, degrees, languages, and civic achievements.',
         'https://www.openlearning.com/apc/courses/rizlife/task-8-rizal-resume-cover-letter'),
    (9,  'q_bsit_09', 'UNO of Rizal', 'ON_SITE_LIBRARY'::"QuestCategory",
         'Participate in the UNO of Rizal card game activity and submit your activity proof and reflection on OpenLearning.',
         'https://www.openlearning.com/apc/courses/rizlife/task-9-uno-of-rizal'),
    (10, 'q_bsit_10', 'JOSE Gamified App', 'SELF_PACED'::"QuestCategory",
         'Complete the interactive learning modules and mastery quizzes inside the JOSE Gamified App and upload your completion link.',
         'https://www.openlearning.com/apc/courses/rizlife/task-10-jose-gamified-app'),
    (11, 'q_bsit_11', 'Google Earth - Midterm', 'SELF_PACED'::"QuestCategory",
         'Trace Jose Rizal''s global voyages across Europe, Asia, and the Americas using Google Earth pins and historical annotations.',
         'https://www.openlearning.com/apc/courses/rizlife/task-11-google-earth-midterm'),
    (12, 'q_bsit_12', 'Dominos of Rizal', 'ON_SITE_LIBRARY'::"QuestCategory",
         'Connect key historical events, characters, and writings in the Dominos of Rizal activity and post your completion output.',
         'https://www.openlearning.com/apc/courses/rizlife/task-12-dominos-of-rizal'),
    (13, 'q_bsit_13', 'Museum Visit', 'ON_SITE_LIBRARY'::"QuestCategory",
         'Visit a Rizal shrine, historical museum, or archival exhibit and document your insights and photo evidence on OpenLearning.',
         'https://www.openlearning.com/apc/courses/rizlife/task-13-museum-visit'),
    (14, 'q_bsit_14', 'Memory Game Cards', 'ON_SITE_LIBRARY'::"QuestCategory",
         'Complete the Rizal Memory Game Cards challenge matching significant historical figures, dates, and artifacts.',
         'https://www.openlearning.com/apc/courses/rizlife/task-14-memory-game-cards'),
    (15, 'q_bsit_15', 'Crossword Puzzle', 'SELF_PACED'::"QuestCategory",
         'Solve the Life and Works of Rizal crossword puzzle covering key terms from Rizal''s biography and nineteenth-century Philippines.',
         'https://www.openlearning.com/apc/courses/rizlife/task-15-crossword-puzzle'),
    (16, 'q_bsit_16', 'Judge a Book by Its Cover', 'CREATIVE_OUTPUT'::"QuestCategory",
         'Analyze or redesign the iconic cover symbolism of Rizal''s literary works and submit your visual commentary.',
         'https://www.openlearning.com/apc/courses/rizlife/task-16-judge-a-book-by-its-cover'),
    (17, 'q_bsit_17', 'Binge-Watch Rizal', 'REFLECTION'::"QuestCategory",
         'Watch the assigned historical film portrayal of Dr. Jose Rizal and write a critical reflection on its depiction of his life and martyrdom.',
         'https://www.openlearning.com/apc/courses/rizlife/task-17-binge-watch-rizal'),
    (18, 'q_bsit_18', 'Binge-Watch Noli Me Tangere', 'REFLECTION'::"QuestCategory",
         'Watch the adaptation of Noli Me Tangere and analyze how its characters expose the social cancer of colonial Philippines.',
         'https://www.openlearning.com/apc/courses/rizlife/task-18-binge-watch-noli-me-tangere'),
    (19, 'q_bsit_19', 'Binge-Watch El Filibusterismo', 'REFLECTION'::"QuestCategory",
         'Watch the adaptation of El Filibusterismo and examine Simoun''s revolution, reform vs. uprising, and Father Florentino''s closing message.',
         'https://www.openlearning.com/apc/courses/rizlife/task-19-binge-watch-el-filibusterismo'),
    (20, 'q_bsit_20', 'Dear Youth of Today', 'REFLECTION'::"QuestCategory",
         'Write an open letter addressed to today''s Filipino youth inspired by A La Juventud Filipina ("The Youth is the Hope of Our Fatherland").',
         'https://www.openlearning.com/apc/courses/rizlife/task-20-dear-youth-of-today'),
    (21, 'q_bsit_21', 'Rizal Arcade Gamified App', 'SELF_PACED'::"QuestCategory",
         'Play through the Rizal Arcade Gamified App challenges and submit your final score and completion permalink on OpenLearning.',
         'https://www.openlearning.com/apc/courses/rizlife/task-21-rizal-arcade-gamified-app'),
    (22, 'q_bsit_22', 'Final Output: Create Storybook / Video Animation and Donate', 'CREATIVE_OUTPUT'::"QuestCategory",
         'Produce an original Rizal storybook or video animation as your capstone project and document its donation to the community or library.',
         'https://www.openlearning.com/apc/courses/rizlife/task-22-final-output-storybook-animation'),
    (23, 'q_bsit_23', 'Course Evaluation', 'SELF_PACED'::"QuestCategory",
         'Complete the official GE-Rizal course evaluation and upload your completion confirmation on OpenLearning.',
         'https://www.openlearning.com/apc/courses/rizlife/task-23-course-evaluation'),
    (24, 'q_bsit_24', 'RizLife Completion Certificate', 'SELF_PACED'::"QuestCategory",
         'Claim and submit your final OpenLearning RizLife Course Completion Certificate to earn your 24th Quest Card stamp.',
         'https://www.openlearning.com/apc/courses/rizlife/task-24-rizlife-completion-certificate')
)
INSERT INTO "Quest" (
  "id",
  "sectionId",
  "taskNumber",
  "title",
  "description",
  "category",
  "openlearningUrl",
  "startDate",
  "deadline",
  "createdAt",
  "updatedAt"
)
SELECT
  td.quest_id,
  bs.section_id,
  td.task_number,
  td.title,
  td.description,
  td.category,
  td.openlearning_url,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + ((td.task_number * 3) || ' days')::INTERVAL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM task_data td
CROSS JOIN bsit_section bs
ON CONFLICT ("sectionId", "taskNumber") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "openlearningUrl" = EXCLUDED."openlearningUrl",
  "updatedAt" = CURRENT_TIMESTAMP;

-- 3. Grant Supabase API Permissions (so SUPABASE_URL + SUPABASE_SECRET_KEY sync directly)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;

-- 4. Verify the 24 tasks in Section BSIT241
SELECT
  q."taskNumber",
  q."title",
  q."category",
  s."code" AS "sectionCode"
FROM "Quest" q
JOIN "Section" s ON s."id" = q."sectionId"
WHERE s."code" = 'BSIT241'
ORDER BY q."taskNumber" ASC;
