-- ============================================================================
-- RizLife QuestCard - Section BSIT241 Class Roster (34 New Students + Vince)
-- Starter Password for all new students: Student@2026
-- Safe to re-run multiple times (idempotent).
-- ============================================================================

-- 1. Rename existing BSIT section to BSIT241
UPDATE "Section"
SET
  "code" = 'BSIT241',
  "name" = 'Life and Works of Rizal (BSIT241)',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'sec_bsit_t2';

-- 2. Insert all 34 remaining students (excluding Vince Nelmar Alobin who already exists)
WITH roster (id, student_id, last_name, first_name, middle_name, course_code, email) AS (
  VALUES
    ('usr_stu_2024_140320', '2024-140320', 'Albania',    'Roman Rico',               'Bundalian',   'BSIT',    'rbalbania2@student.apc.edu.ph'),
    ('usr_stu_2024_140211', '2024-140211', 'Albeza Jr.', 'Romeo',                    'Lava',        'BSIT',    'rlalbezajr@student.apc.edu.ph'),
    ('usr_stu_2023_140187', '2023-140187', 'Baluyan',    'John Zane',                'Anga-angan',  'BSIT-MI', 'jabaluyan@student.apc.edu.ph'),
    ('usr_stu_2024_140118', '2024-140118', 'Baracena',   'John Carlo',               'Emploma',     'BSIT',    'jebaracena@student.apc.edu.ph'),
    ('usr_stu_2024_140092', '2024-140092', 'Buaquiña',   'Gian Ace',                 'Saclauso',    'BSIT',    'gsbuaquina@student.apc.edu.ph'),
    ('usr_stu_2024_140124', '2024-140124', 'Carpio',     'Beejay',                   'Anunciacion', 'BSIT',    'bacarpio@student.apc.edu.ph'),
    ('usr_stu_2024_140226', '2024-140226', 'Cheng',      'Sheila Nicole',            'Dizon',       'BSIT',    'sdcheng@student.apc.edu.ph'),
    ('usr_stu_2024_140325', '2024-140325', 'Clavero',    'Joshmar',                  'Limocon',     'BSIT',    'jlclavero@student.apc.edu.ph'),
    ('usr_stu_2024_140176', '2024-140176', 'Cruz',       'Rick Francis',             'Turingan',    'BSIT',    'rtcruz3@student.apc.edu.ph'),
    ('usr_stu_2024_140141', '2024-140141', 'Dela Cruz',  'Raniel',                   'Quiray',      'BSIT',    'rqdelacruz@student.apc.edu.ph'),
    ('usr_stu_2024_140161', '2024-140161', 'Duenas',     'Anthony',                  'Salik',       'BSIT',    'asduenas@student.apc.edu.ph'),
    ('usr_stu_2024_140106', '2024-140106', 'Famisaran',  'Chase Ian',                'Lacsamana',   'BSIT',    'clfamisaran@student.apc.edu.ph'),
    ('usr_stu_2024_140164', '2024-140164', 'Fortaleza',  'Lance Art',                'Picaña',      'BSIT',    'lpfortaleza@student.apc.edu.ph'),
    ('usr_stu_2024_140265', '2024-140265', 'Galido',     'Rei Khalil',               'Sales',       'BSIT',    'rsgalido@student.apc.edu.ph'),
    ('usr_stu_2024_140016', '2024-140016', 'Garcia',     'Ashton Brian',             'Solis',       'BSIT',    'asgarcia@student.apc.edu.ph'),
    ('usr_stu_2024_140024', '2024-140024', 'Garcia',     'Charlize Jacee',           'Go',          'BSIT',    'cggarcia@student.apc.edu.ph'),
    ('usr_stu_2024_140095', '2024-140095', 'Gonzales',   'Marwin John',              'Garingan',    'BSIT',    'mggonzales@student.apc.edu.ph'),
    ('usr_stu_2024_140026', '2024-140026', 'Guzman',     'John Carl Gabriel',        'Bersalona',   'BSIT',    'jbguzman@student.apc.edu.ph'),
    ('usr_stu_2024_140088', '2024-140088', 'Hamer',      'Aleksej Aidan Konstantin', NULL,          'BSIT',    'ahamer@student.apc.edu.ph'),
    ('usr_stu_2024_140143', '2024-140143', 'Ibe',        'Rodmina Jhoy',             'Alba',        'BSIT',    'raibe@student.apc.edu.ph'),
    ('usr_stu_2024_140156', '2024-140156', 'Juvida',     'Raiza Joy',                'Mendija',     'BSIT',    'rmjuvida@student.apc.edu.ph'),
    ('usr_stu_2024_140190', '2024-140190', 'Lopez',      'John Christian',           'Zuñiga',      'BSIT',    'jzlopez@student.apc.edu.ph'),
    ('usr_stu_2024_140126', '2024-140126', 'Mendoza',    'Vinz Szymone Roi',         'Venancio',    'BSIT',    'vvmendoza@student.apc.edu.ph'),
    ('usr_stu_2024_140091', '2024-140091', 'Mirador',    'Jose Javier',              'Santos',      'BSIT',    'jsmirador@student.apc.edu.ph'),
    ('usr_stu_2024_140069', '2024-140069', 'Nagales',    'Qelvin Joszeler',          'Dela Rosa',   'BSIT',    'qdnagales@student.apc.edu.ph'),
    ('usr_stu_2024_140130', '2024-140130', 'Nipas',      'Eunice',                   'Bertulano',   'BSIT',    'ebnipas@student.apc.edu.ph'),
    ('usr_stu_2024_140225', '2024-140225', 'Ochoa',      'John Adrian',              'Crisostomo',  'BSIT',    'jcochoa@student.apc.edu.ph'),
    ('usr_stu_2024_140129', '2024-140129', 'Padilla',    'Neichaela Antonia',        'Salvador',    'BSIT',    'nspadilla@student.apc.edu.ph'),
    ('usr_stu_2024_140136', '2024-140136', 'Padua',      'Iane Sofia Francheska',    'Acidera',     'BSIT',    'iapadua@student.apc.edu.ph'),
    ('usr_stu_2024_140146', '2024-140146', 'Pinlac',     'Crate Marshall',           'Andaya',      'BSIT',    'capinlac@student.apc.edu.ph'),
    ('usr_stu_2024_140196', '2024-140196', 'Ramos',      'Niña Arcel',               'Rivera',      'BSIT',    'nrramos@student.apc.edu.ph'),
    ('usr_stu_2024_140187', '2024-140187', 'Salud',      'Gwyneth',                  'Cortez',      'BSIT',    'gcsalud@student.apc.edu.ph'),
    ('usr_stu_2024_140112', '2024-140112', 'Varona',     'Nairb Ackillis',           'Galang',      'BSIT',    'ngvarona@student.apc.edu.ph'),
    ('usr_stu_2024_140070', '2024-140070', 'Villaflor',  'Nathaniel',                'Javier',      'BSIT',    'njvillaflor@student.apc.edu.ph')
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
  '$2b$10$N2qYNY8Prf2CFM4ZVkIK8OjpaDFbA.E6xLCCWystzp0L32dFcWp6i',
  'STUDENT'::"Role",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM roster r
ON CONFLICT ("email") DO NOTHING;

-- 3. Enroll all 34 students into Section BSIT241
INSERT INTO "Enrollment" ("id", "studentId", "sectionId", "enrolledAt")
SELECT
  'enr_' || u."id",
  u."id",
  'sec_bsit_t2',
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."id" LIKE 'usr_stu_%'
ON CONFLICT ("studentId", "sectionId") DO NOTHING;
