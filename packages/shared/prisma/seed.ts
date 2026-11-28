import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/password";

/**
 * This demo seed sets KNOWN passwords (they're in the README). Refuse to run it anywhere
 * but a local development database unless explicitly forced.
 */
function assertDemoSeedAllowed() {
  if (process.argv.includes("--force-demo")) return;
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    // unparsable/missing URL: Prisma will report it
  }
  const local = ["localhost", "127.0.0.1", "::1", "postgres", "db"].includes(host);
  if (process.env.NODE_ENV === "production" || (host && !local)) {
    console.error(
      `Refusing to run the demo seed against ${host || "this database"}: it creates accounts with publicly known passwords.\n` +
        "It is meant for a local Docker database. Pass --force-demo only for a throwaway database."
    );
    process.exit(1);
  }
}

assertDemoSeedAllowed();
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding RizLife QuestCard database...");

  await prisma.systemSetting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      activeTerm: "Term 2 AY 2026-2027",
      defaultDigestThreshold: 20,
      digestCronSchedule: "0 8,17 * * *",
      emailProvider: "preview",
      emailFromAddress: "RizLife QuestCard <noreply@rizlife.apc.edu.ph>",
      allowedStudentDomain: "student.apc.edu.ph",
      allowedStaffDomain: "apc.edu.ph",
      microsoftSsoEnabled: false,
    },
  });

  const adminHash = await hashPassword("Admin@RizLife2026");
  const teacherHash = await hashPassword("Teacher@RizLife2026");
  const studentHash = await hashPassword("Student@2026");

  const admin = await prisma.user.upsert({
    where: { email: "admin@apc.edu.ph" },
    update: {},
    create: {
      email: "admin@apc.edu.ph",
      firstName: "RizLife",
      lastName: "Admin",
      role: "ADMIN",
      passwordHash: adminHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const defaultTeacher = await prisma.user.upsert({
    where: { email: "teacher@apc.edu.ph" },
    update: {},
    create: {
      email: "teacher@apc.edu.ph",
      firstName: "Elena",
      lastName: "Mendoza",
      role: "TEACHER",
      passwordHash: teacherHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const sectionBSIT = await prisma.section.upsert({
    where: { code_term: { code: "BSIT", term: "Term 2 AY 2026-2027" } },
    update: {},
    create: {
      code: "BSIT",
      name: "Life and Works of Rizal (BSIT)",
      term: "Term 2 AY 2026-2027",
      teacherId: defaultTeacher.id,
      leaderboardVisible: false,
      digestThreshold: 20,
      digestEnabled: true,
    },
  });

  const bsitDemoStudent = await prisma.user.upsert({
    where: { email: "irivera@student.apc.edu.ph" },
    update: {},
    create: {
      studentId: "2099-140001",
      firstName: "Isagani",
      lastName: "Rivera",
      courseCode: "BSIT",
      email: "irivera@student.apc.edu.ph",
      passwordHash: studentHash,
      role: "STUDENT",
      mustChangePassword: false,
      isActive: true,
    },
  });

  await prisma.enrollment.upsert({
    where: {
      studentId_sectionId: {
        studentId: bsitDemoStudent.id,
        sectionId: sectionBSIT.id,
      },
    },
    update: {},
    create: {
      studentId: bsitDemoStudent.id,
      sectionId: sectionBSIT.id,
    },
  });

  const profMendoza = await prisma.user.upsert({
    where: { email: "prof.mendoza@apc.edu.ph" },
    update: {},
    create: {
      email: "prof.mendoza@apc.edu.ph",
      firstName: "Elena",
      lastName: "Mendoza",
      role: "TEACHER",
      passwordHash: teacherHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const profReyes = await prisma.user.upsert({
    where: { email: "prof.reyes@apc.edu.ph" },
    update: {},
    create: {
      email: "prof.reyes@apc.edu.ph",
      firstName: "Marco",
      lastName: "Reyes",
      role: "TEACHER",
      passwordHash: teacherHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const sectionIT241 = await prisma.section.upsert({
    where: { code_term: { code: "IT241", term: "Term 2 AY 2026-2027" } },
    update: {},
    create: {
      code: "IT241",
      name: "Life and Works of Rizal (BSIT)",
      term: "Term 2 AY 2026-2027",
      teacherId: profMendoza.id,
      leaderboardVisible: false,
      digestThreshold: 20,
      digestEnabled: true,
    },
  });

  const sectionIT242 = await prisma.section.upsert({
    where: { code_term: { code: "IT242", term: "Term 2 AY 2026-2027" } },
    update: {},
    create: {
      code: "IT242",
      name: "Life and Works of Rizal (BSIT-MI)",
      term: "Term 2 AY 2026-2027",
      teacherId: profReyes.id,
      leaderboardVisible: false,
      digestThreshold: 20,
      digestEnabled: true,
    },
  });

  const sectionIT243 = await prisma.section.upsert({
    where: { code_term: { code: "IT243", term: "Term 2 AY 2026-2027" } },
    update: {},
    create: {
      code: "IT243",
      name: "Life and Works of Rizal (BSCS)",
      term: "Term 2 AY 2026-2027",
      teacherId: null,
      leaderboardVisible: false,
      digestThreshold: 20,
      digestEnabled: true,
    },
  });

  const studentSpecs = [
    {
      studentId: "2099-140101",
      firstName: "Juan",
      middleName: "Mercado",
      lastName: "Dela Cruz",
      courseCode: "BSIT",
      email: "jdelacruz@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140102",
      firstName: "Maria",
      middleName: "Alonzo",
      lastName: "Santos",
      courseCode: "BSIT-MI",
      email: "msantos@student.apc.edu.ph",
      mustChangePassword: true,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140103",
      firstName: "Gabriel",
      middleName: "Reyes",
      lastName: "Alcantara",
      courseCode: "BSIT",
      email: "galcantara@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140104",
      firstName: "Patricia",
      middleName: "Lim",
      lastName: "Tan",
      courseCode: "BSIT-MI",
      email: "ptan@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140105",
      firstName: "Miguel",
      middleName: "Castillo",
      lastName: "Navarro",
      courseCode: "BSIT",
      email: "mnavarro@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140106",
      firstName: "Sophia",
      middleName: "Dizon",
      lastName: "Aquino",
      courseCode: "BSIT",
      email: "saquino@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140107",
      firstName: "Daniel",
      middleName: "Ocampo",
      lastName: "Soriano",
      courseCode: "BSCS",
      email: "dsoriano@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140108",
      firstName: "Camille",
      middleName: "Flores",
      lastName: "Pangilinan",
      courseCode: "BSIT-MI",
      email: "cpangilinan@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140109",
      firstName: "Lorenzo",
      middleName: "Torres",
      lastName: "Magsaysay",
      courseCode: "BSIT",
      email: "lmagsaysay@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140110",
      firstName: "Bianca",
      middleName: "Gomez",
      lastName: "Hernandez",
      courseCode: "BSIT-MI",
      email: "bhernandez@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT241.id,
    },
    {
      studentId: "2099-140201",
      firstName: "Carlo",
      middleName: "Bautista",
      lastName: "Ramos",
      courseCode: "BSIT-MI",
      email: "cramos@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT242.id,
    },
    {
      studentId: "2099-140202",
      firstName: "Alyssa",
      middleName: "Pineda",
      lastName: "Mercado",
      courseCode: "BSIT-MI",
      email: "amercado@student.apc.edu.ph",
      mustChangePassword: false,
      sectionId: sectionIT242.id,
    },
  ];

  const createdStudents: { id: string; email: string; sectionId: string }[] = [];

  for (const s of studentSpecs) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        studentId: s.studentId,
        firstName: s.firstName,
        middleName: s.middleName,
        lastName: s.lastName,
        courseCode: s.courseCode,
        email: s.email,
        passwordHash: studentHash,
        role: "STUDENT",
        mustChangePassword: s.mustChangePassword,
        isActive: true,
      },
    });

    await prisma.enrollment.upsert({
      where: {
        studentId_sectionId: { studentId: user.id, sectionId: s.sectionId },
      },
      update: {},
      create: {
        studentId: user.id,
        sectionId: s.sectionId,
      },
    });

    createdStudents.push({ id: user.id, email: s.email, sectionId: s.sectionId });
  }

  const now = new Date();
  const daysFromNow = (offset: number) =>
    new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);

  const questsIT241 = [
    {
      taskNumber: 1,
      title: "Revisiting the Law (R.A. 1425)",
      category: "SELF_PACED" as const,
      description:
        "Read Republic Act No. 1425 (The Rizal Law) and post a 250-word synthesis in the OpenLearning Module 1 reflection gallery explaining why mandatory study remains relevant for BSIT/BSCS students.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-1-revisiting-the-law",
      startDate: daysFromNow(-42),
      deadline: daysFromNow(-30),
    },
    {
      taskNumber: 2,
      title: "Rizal Law Reel",
      category: "CREATIVE_OUTPUT" as const,
      description:
        "Produce a 60-second vertical reel dramatizing the 1956 Senate debate between Claro M. Recto and opposition groups. Share your video post on OpenLearning and copy the post permalink.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-1-rizal-law-reel",
      startDate: daysFromNow(-35),
      deadline: daysFromNow(-24),
    },
    {
      taskNumber: 3,
      title: "19th Century Philippines Timeline",
      category: "SELF_PACED" as const,
      description:
        "Construct an annotated timeline of economic, social, and political shifts in 19th-century Philippines (Galleon Trade end, Suez Canal opening, Secularization issue).",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-2-19th-century",
      startDate: daysFromNow(-28),
      deadline: daysFromNow(-18),
    },
    {
      taskNumber: 4,
      title: "Calamba Childhood Archive",
      category: "ON_SITE_LIBRARY" as const,
      description:
        "Visit the APC Library Filipiniana section during class hours to inspect primary biographical accounts of Rizal's youth in Calamba and log your summary card in OpenLearning.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-3-calamba-archive",
      startDate: daysFromNow(-24),
      deadline: daysFromNow(-14),
    },
    {
      taskNumber: 5,
      title: "Ateneo & UST Academic Reflections",
      category: "REFLECTION" as const,
      description:
        "Compare Rizal's Jesuit pedagogy at Ateneo Municipal with his experience at UST. Upload a reflection note comparing them to modern APC project-based learning.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-4-ateneo-ust",
      startDate: daysFromNow(-20),
      deadline: daysFromNow(-9),
    },
    {
      taskNumber: 6,
      title: "First Voyage Abroad Postcard",
      category: "CREATIVE_OUTPUT" as const,
      description:
        "Design a digital postcard chronicling Rizal's 1882 departure to Madrid, highlighting his motivations and early Propaganda Movement letters.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-5-first-voyage",
      startDate: daysFromNow(-16),
      deadline: daysFromNow(-4),
    },
    {
      taskNumber: 7,
      title: "Noli Me Tangere Character Dossier",
      category: "SELF_PACED" as const,
      description:
        "Analyze two allegorical characters from Noli Me Tangere (e.g., Sisa, Elias, Doña Victorina) and map their social parallels in contemporary Philippine society.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-6-noli-dossier",
      startDate: daysFromNow(-12),
      deadline: daysFromNow(3),
    },
    {
      taskNumber: 8,
      title: "Library Primary Source Hunt",
      category: "ON_SITE_LIBRARY" as const,
      description:
        "Locate an authentic issue or digitized excerpt of La Solidaridad in the APC Library archives and submit a brief source evaluation checklist.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-7-library-hunt",
      startDate: daysFromNow(-8),
      deadline: daysFromNow(7),
    },
    {
      taskNumber: 9,
      title: "El Filibusterismo Comparative Essay",
      category: "REFLECTION" as const,
      description:
        "Contrast Simoun's revolutionary urgency in El Filibusterismo with Crisostomo Ibarra's reformist idealism in Noli Me Tangere.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-8-el-fili-essay",
      startDate: daysFromNow(-5),
      deadline: daysFromNow(12),
    },
    {
      taskNumber: 10,
      title: "Dapitan Exile Community Map",
      category: "CREATIVE_OUTPUT" as const,
      description:
        "Illustrate Rizal's civic engineering, education, and community waterworks projects during his exile in Dapitan and connect them to APC's community-engaged computing.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-9-dapitan-map",
      startDate: daysFromNow(-2),
      deadline: daysFromNow(18),
    },
    {
      taskNumber: 11,
      title: "Mi Ultimo Adios Spoken Reflection",
      category: "REFLECTION" as const,
      description:
        "Record or write an annotated close reading of your chosen stanza from Mi Ultimo Adios and share your OpenLearning submission link.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-10-ultimo-adios",
      startDate: daysFromNow(1),
      deadline: daysFromNow(24),
    },
    {
      taskNumber: 12,
      title: "My Modern Hero Capstone",
      category: "CREATIVE_OUTPUT" as const,
      description:
        "Feature an unsung modern Filipino hero in your community or tech industry who embodies Rizal's civic virtues, and publish your capstone showcase on OpenLearning.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-12-modern-hero",
      startDate: daysFromNow(4),
      deadline: daysFromNow(32),
    },
    {
      taskNumber: 13,
      title: "Propaganda Movement Press Analysis",
      category: "SELF_PACED" as const,
      description:
        "Examine Marcelo H. del Pilar and Graciano Lopez Jaena's essays alongside Rizal's contributions in La Solidaridad and summarize key reform arguments.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-13-propaganda-press",
      startDate: daysFromNow(-18),
      deadline: daysFromNow(-6),
    },
    {
      taskNumber: 14,
      title: "Indolence of the Filipinos Essay",
      category: "REFLECTION" as const,
      description:
        "Analyze Rizal's historical rebuttal in Sobre la Indolencia de los Filipinos and discuss structural factors affecting modern productivity.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-14-indolence",
      startDate: daysFromNow(-15),
      deadline: daysFromNow(-3),
    },
    {
      taskNumber: 15,
      title: "Letter to the Women of Malolos",
      category: "REFLECTION" as const,
      description:
        "Reflect on Rizal's 1889 letter praising civic courage and education for women, and post your reflection in the OpenLearning gallery.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-15-women-of-malolos",
      startDate: daysFromNow(-12),
      deadline: daysFromNow(-1),
    },
    {
      taskNumber: 16,
      title: "Morga's Sucesos Annotations",
      category: "ON_SITE_LIBRARY" as const,
      description:
        "Inspect Rizal's annotations of Antonio de Morga's Sucesos de las Islas Filipinas in the APC library reference collection and upload your source card.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-16-morga-sucesos",
      startDate: daysFromNow(-10),
      deadline: daysFromNow(2),
    },
    {
      taskNumber: 17,
      title: "The Philippines a Century Hence",
      category: "SELF_PACED" as const,
      description:
        "Evaluate Rizal's geopolitical predictions in Filipinas Dentro de Cien Años and compare them against contemporary Southeast Asian history.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-17-century-hence",
      startDate: daysFromNow(-7),
      deadline: daysFromNow(5),
    },
    {
      taskNumber: 18,
      title: "La Liga Filipina Charter Pitch",
      category: "CREATIVE_OUTPUT" as const,
      description:
        "Translate the five objectives of La Liga Filipina into a modern civic tech organization charter and post your output link.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-18-liga-filipina",
      startDate: daysFromNow(-5),
      deadline: daysFromNow(8),
    },
    {
      taskNumber: 19,
      title: "Dapitan Letters Curated Thread",
      category: "SELF_PACED" as const,
      description:
        "Select three letters Rizal wrote from Dapitan to Blumentritt or his family and annotate what they reveal about his daily resilience.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-19-dapitan-letters",
      startDate: daysFromNow(-3),
      deadline: daysFromNow(11),
    },
    {
      taskNumber: 20,
      title: "Rizal & Philippine Nationalism Debate",
      category: "REFLECTION" as const,
      description:
        "Synthesize Renato Constantino's 'Veneration Without Understanding' vs. Floro Quibuyen's counter-argument in a 300-word OpenLearning post.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-20-nationalism-debate",
      startDate: daysFromNow(-1),
      deadline: daysFromNow(14),
    },
    {
      taskNumber: 21,
      title: "Trial & Bagumbayan Primary Sources",
      category: "ON_SITE_LIBRARY" as const,
      description:
        "Review archival court-martial transcripts from the 1896 trial and upload an evidence summary checklist.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-21-bagumbayan",
      startDate: daysFromNow(2),
      deadline: daysFromNow(18),
    },
    {
      taskNumber: 22,
      title: "Digital Heritage Museum Curation",
      category: "CREATIVE_OUTPUT" as const,
      description:
        "Curate a 5-artifact virtual Rizal exhibit using verified archival photos and share your gallery link.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-22-heritage-museum",
      startDate: daysFromNow(4),
      deadline: daysFromNow(22),
    },
    {
      taskNumber: 23,
      title: "Civic Ethics & Tech Responsibility",
      category: "REFLECTION" as const,
      description:
        "Connect Rizal's ethical ideals on education and civic duty to ethical software engineering and AI stewardship at APC.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-23-civic-ethics",
      startDate: daysFromNow(6),
      deadline: daysFromNow(26),
    },
    {
      taskNumber: 24,
      title: "Final Rizal Journey Portfolio",
      category: "CREATIVE_OUTPUT" as const,
      description:
        "Compile your complete semester reflections and share your OpenLearning Portfolio link for final Quest Card verification.",
      openlearningUrl:
        "https://www.openlearning.com/apc/courses/rizlife/module-24-final-portfolio",
      startDate: daysFromNow(8),
      deadline: daysFromNow(35),
    },
  ];

  const it241Quests = [];
  for (const q of questsIT241) {
    const created = await prisma.quest.upsert({
      where: {
        sectionId_taskNumber: {
          sectionId: sectionIT241.id,
          taskNumber: q.taskNumber,
        },
      },
      update: {},
      create: {
        sectionId: sectionIT241.id,
        ...q,
      },
    });
    it241Quests.push(created);
  }

  for (const q of questsIT241.slice(0, 4)) {
    await prisma.quest.upsert({
      where: {
        sectionId_taskNumber: {
          sectionId: sectionIT242.id,
          taskNumber: q.taskNumber,
        },
      },
      update: {},
      create: {
        sectionId: sectionIT242.id,
        ...q,
      },
    });
  }

  // Seed varied submissions for IT241 so tracker, queue, digest, and speed leaderboard work out-of-the-box
  const it241Students = createdStudents.filter((s) => s.sectionId === sectionIT241.id);
  const existingSubCount = await prisma.submission.count({
    where: { quest: { sectionId: sectionIT241.id } },
  });

  if (existingSubCount === 0) {
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);

    const stampProfiles: Record<number, { stamped: number; pending: number[]; revision?: number; speedOffsetHours: number }> = {
      0: { stamped: 17, pending: [18, 19], revision: 20, speedOffsetHours: 240 }, // Juan Dela Cruz (mirrors 24-stamp postcard)
      1: { stamped: 10, pending: [11, 12], speedOffsetHours: 200 }, // Maria Santos
      2: { stamped: 19, pending: [20], speedOffsetHours: 260 }, // Gabriel Alcantara (#1 fastest!)
      3: { stamped: 19, pending: [20, 21], speedOffsetHours: 160 }, // Patricia Tan (19 stamps, later than Gabriel)
      4: { stamped: 14, pending: [15], speedOffsetHours: 175 }, // Miguel Navarro
      5: { stamped: 12, pending: [13, 14], speedOffsetHours: 150 }, // Sophia Aquino
      6: { stamped: 8, pending: [9], revision: 10, speedOffsetHours: 130 }, // Daniel Soriano
      7: { stamped: 15, pending: [16, 17], speedOffsetHours: 185 }, // Camille Pangilinan
      8: { stamped: 6, pending: [7], speedOffsetHours: 110 }, // Lorenzo Magsaysay
      9: { stamped: 11, pending: [12], speedOffsetHours: 140 }, // Bianca Hernandez
    };

    for (let sIdx = 0; sIdx < it241Students.length; sIdx++) {
      const student = it241Students[sIdx];
      const profile = stampProfiles[sIdx] ?? { stamped: 2, pending: [3], speedOffsetHours: 90 };

      for (const quest of it241Quests) {
        const slug = `https://www.openlearning.com/apc/courses/rizlife/task-${quest.taskNumber}/submission-${sIdx + 101}`;

        if (quest.taskNumber <= profile.stamped) {
          const submittedAt = hoursAgo(profile.speedOffsetHours - quest.taskNumber * 4);
          const stampedAt = hoursAgo(profile.speedOffsetHours - quest.taskNumber * 4 - 2);
          await prisma.submission.create({
            data: {
              questId: quest.id,
              studentId: student.id,
              submissionUrl: slug,
              status: "STAMPED",
              teacherFeedback: "Well-analyzed and verified in OpenLearning.",
              firstSubmittedAt: submittedAt,
              submittedAt,
              stampedAt,
              stampedById: profMendoza.id,
              includedInDigest: true,
            },
          });
        } else if (profile.pending.includes(quest.taskNumber)) {
          const submittedAt = hoursAgo(12 - (sIdx % 6));
          await prisma.submission.create({
            data: {
              questId: quest.id,
              studentId: student.id,
              submissionUrl: slug,
              studentNote: "Completed in OpenLearning gallery; ready for checking.",
              status: "PENDING_REVIEW",
              firstSubmittedAt: submittedAt,
              submittedAt,
              includedInDigest: false,
            },
          });
        } else if (profile.revision === quest.taskNumber) {
          const submittedAt = hoursAgo(30);
          await prisma.submission.create({
            data: {
              questId: quest.id,
              studentId: student.id,
              submissionUrl: slug,
              status: "NEEDS_REVISION",
              teacherFeedback:
                "Please double-check your OpenLearning post link—the current URL points to the module home instead of your specific post timestamp permalink.",
              firstSubmittedAt: submittedAt,
              submittedAt,
              includedInDigest: true,
            },
          });
        }
      }
    }
  }

  console.log("Seed complete:", {
    admin: admin.email,
    teachers: [profMendoza.email, profReyes.email],
    sections: [sectionIT241.code, sectionIT242.code, sectionIT243.code],
    students: createdStudents.length,
    questsIT241: it241Quests.length,
  });
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
