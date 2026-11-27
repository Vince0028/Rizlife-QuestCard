// Must stay first: points the DB client at a throwaway local JSON file.
import { cleanupTestDb } from "./test-env";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { runSubmissionLifecycleChecks } from "./submission-lifecycle";
import { runMicrosoftSsoChecks } from "./sso-callback";
import { runDeadlineStateChecks } from "./deadline-states";
import { signSessionToken, verifySessionToken } from "../auth";
import { hashPassword, verifyPassword } from "../password";
import { createSectionSchema, validateSubmissionUrl } from "../validation";
import { computeLeaderboard } from "../leaderboard";
import { buildDigestEmailHtml } from "../digest";
import {
  generateStudentImportCsvTemplate,
  generateTrackerCsv,
  generateTrackerWorkbook,
  parseStudentImportFile,
} from "../excel";

async function run() {
  console.log("Running RizLife QuestCard core verification suite...");

  // 1. JWT Session Sign & Verify (portal-isolated)
  const token = await signSessionToken({
    userId: "u_1",
    email: "jdelacruz@student.apc.edu.ph",
    role: "STUDENT",
    firstName: "Juan",
    lastName: "Dela Cruz",
    studentId: "2024-140101",
    courseCode: "BSIT",
    mustChangePassword: false,
    portal: "student",
  });
  const verifiedStudent = await verifySessionToken(token, "student");
  assert.ok(verifiedStudent, "Student token should verify for student portal");
  assert.equal(verifiedStudent?.userId, "u_1");
  const rejectedTeacher = await verifySessionToken(token, "teacher");
  assert.equal(
    rejectedTeacher,
    null,
    "Student token must be rejected on teacher portal"
  );

  // 2. Password Hashing
  const hashed = await hashPassword("Student@2026");
  assert.equal(await verifyPassword("Student@2026", hashed), true);
  assert.equal(await verifyPassword("WrongPassword", hashed), false);

  // 3. OpenLearning URL validation
  const olCheck = validateSubmissionUrl(
    "https://www.openlearning.com/apc/courses/rizlife/task-1/post-123"
  );
  assert.equal(olCheck.valid, true);
  assert.equal(olCheck.isOpenLearningUrl, true);
  assert.equal(olCheck.sourceLabel, "OpenLearning Permalink");

  const extCheck = validateSubmissionUrl("https://www.canva.com/design/abc/view");
  assert.equal(extCheck.valid, true);
  assert.equal(extCheck.isOpenLearningUrl, false);
  assert.ok(extCheck.hint);

  const badCheck = validateSubmissionUrl("not-a-url");
  assert.equal(badCheck.valid, false);

  // 4. Speed Leaderboard Ranking & Tie-Breaker
  const lb = computeLeaderboard(
    [
      {
        id: "s_late",
        studentId: "2024-140102",
        firstName: "Patricia",
        lastName: "Tan",
        courseCode: "BSIT-MI",
      },
      {
        id: "s_fast",
        studentId: "2024-140101",
        firstName: "Gabriel",
        lastName: "Alcantara",
        courseCode: "BSIT",
      },
      {
        id: "s_zero",
        studentId: "2024-140103",
        firstName: "Marco",
        lastName: "Zero",
        courseCode: "BSCS",
      },
    ],
    [
      {
        studentId: "s_fast",
        questId: "q1",
        status: "STAMPED",
        firstSubmittedAt: "2026-11-10T08:00:00.000Z",
        submittedAt: "2026-11-10T08:00:00.000Z",
        stampedAt: "2026-11-10T09:00:00.000Z",
      },
      {
        studentId: "s_late",
        questId: "q1",
        status: "STAMPED",
        firstSubmittedAt: "2026-11-12T10:00:00.000Z",
        submittedAt: "2026-11-12T10:00:00.000Z",
        stampedAt: "2026-11-12T11:00:00.000Z",
      },
    ],
    12
  );
  assert.equal(lb[0].studentId, "s_fast", "Earlier 1-stamp student ranks #1");
  assert.equal(lb[0].rank, 1);
  assert.equal(lb[1].studentId, "s_late");
  assert.equal(lb[1].rank, 2);
  assert.equal(lb[2].studentId, "s_zero");
  assert.equal(lb[2].stampedCount, 0);

  // 5. Digest Email HTML Rendering
  const email = buildDigestEmailHtml({
    sectionId: "sec_1",
    sectionCode: "IT241",
    sectionName: "Life and Works of Rizal",
    term: "Term 2 AY 2026-2027",
    teacherName: "Prof. Elena Mendoza",
    groups: [
      {
        questId: "q1",
        taskNumber: 1,
        title: "Revisiting the Law",
        count: 20,
        students: [
          {
            submissionId: "sub_1",
            studentName: "Dela Cruz, Juan",
            studentNumber: "2024-140101",
            submittedAt: new Date().toISOString(),
            submissionUrl: "https://www.openlearning.com/apc/1",
          },
        ],
      },
    ],
    totalSubmissions: 20,
    uniqueStudents: 20,
    teacherPortalUrl: "https://teacher.rizlife.vercel.app",
  });
  assert.ok(email.subject.includes("20 Students Have Submitted"));
  assert.ok(email.html.includes("Revisiting the Law"));
  assert.ok(email.html.includes("sec_1"));

  // 6. Admin section-first validation (teacherId optional/null)
  const unassignedSec = createSectionSchema.safeParse({
    code: "IT243",
    name: "Life and Works of Rizal (BSCS)",
    term: "Term 2 AY 2026-2027",
    teacherId: null,
  });
  assert.equal(
    unassignedSec.success,
    true,
    "Admin should be able to create a section before assigning a teacher"
  );

  // 7. ExcelJS Tracker Export (including Timestamps Log) + CSV Template Round-Trip
  const wbBuffer = await generateTrackerWorkbook({
    sectionCode: "IT241",
    sectionName: "Life and Works of Rizal",
    term: "Term 2 AY 2026-2027",
    quests: [
      {
        id: "q1",
        taskNumber: 1,
        title: "Revisiting the Law",
        category: "SELF_PACED",
        openlearningUrl: null,
        startDate: null,
        deadline: null,
      },
    ],
    students: [
      {
        id: "s1",
        studentId: "2024-140101",
        firstName: "Juan",
        middleName: "M.",
        lastName: "Dela Cruz",
        courseCode: "BSIT",
        email: "jdelacruz@student.apc.edu.ph",
      },
    ],
    submissions: [
      {
        questId: "q1",
        studentId: "s1",
        status: "STAMPED",
        submissionUrl: "https://www.openlearning.com/apc/post/1",
        firstSubmittedAt: new Date("2026-11-18T09:00:00.000Z"),
        submittedAt: new Date("2026-11-18T09:00:00.000Z"),
        stampedAt: new Date("2026-11-18T10:30:00.000Z"),
      },
    ],
  });
  assert.ok(wbBuffer.byteLength > 2000, "XLSX buffer should be generated");
  const loadedWb = new ExcelJS.Workbook();
  await loadedWb.xlsx.load(wbBuffer as unknown as ArrayBuffer);
  assert.equal(loadedWb.worksheets.length, 3);
  assert.equal(loadedWb.worksheets[2].name, "Timestamps Log");

  const csvOut = generateTrackerCsv({
    quests: [
      {
        id: "q1",
        taskNumber: 1,
        title: "Revisiting the Law",
        category: "SELF_PACED",
        openlearningUrl: null,
        startDate: null,
        deadline: null,
      },
    ],
    students: [
      {
        id: "s1",
        studentId: "2024-140101",
        firstName: "Juan",
        middleName: "M.",
        lastName: "Dela Cruz",
        courseCode: "BSIT",
        email: "jdelacruz@student.apc.edu.ph",
      },
    ],
    submissions: [],
  });
  assert.ok(csvOut.includes("2024-140101"));

  const template = generateStudentImportCsvTemplate();
  const parsedImport = await parseStudentImportFile(
    Buffer.from(template, "utf-8"),
    "template.csv"
  );
  assert.equal(parsedImport.errors.length, 0);
  assert.equal(parsedImport.rows.length, 2);
  assert.equal(parsedImport.rows[0].studentId, "2024-140101");
  assert.equal(parsedImport.rows[0].lastName, "Alobin");
  assert.equal(parsedImport.rows[0].firstName, "Vince Nelmar");
  assert.equal(parsedImport.rows[0].middleName, "Pega");

  // 8. Submission lifecycle (resubmit after revision, stamped lock) + threshold digest
  await runSubmissionLifecycleChecks();

  // 9. Microsoft Entra ID SSO callback: state/PKCE, tenant, APC domain, linking, portal roles
  await runMicrosoftSsoChecks();

  // 10. Quest deadline states (Overdue / Due today / Due soon) in Asia/Manila days
  runDeadlineStateChecks();

  console.log("ALL CORE VERIFICATION CHECKS PASSED!");
}

run()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  })
  .finally(cleanupTestDb);
