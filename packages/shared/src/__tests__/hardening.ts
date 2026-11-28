/**
 * Edge-case guards: admin user/section routes, settings + digest schedule, finals-track
 * persistence, module URL validation, quest date/task-number validation, and the
 * client-safe error mapping. Runs on the throwaway local JSON DB from ./test-env.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db";
import {
  deleteSectionAsAdmin,
  deleteUserAsAdmin,
  saveSystemSettings,
  updateUserAsAdmin,
} from "../admin-service";
import {
  chooseStudentFinalsTrack,
  createManagedQuest,
  toWorkspaceError,
  updateEnrollmentTrack,
  updateManagedQuest,
} from "../workspace-service";
import { DIGEST_CRON_SCHEDULE_UTC, type SessionPayload } from "../types";

function actor(userId: string, role: SessionPayload["role"]): SessionPayload {
  return {
    userId,
    email: `${userId}@apc.edu.ph`,
    role,
    firstName: "Hard",
    lastName: userId,
    studentId: null,
    courseCode: null,
    mustChangePassword: false,
    portal: role === "ADMIN" ? "admin" : "teacher",
  };
}

async function expectStatus(promise: Promise<unknown>, status: number, label: string) {
  try {
    await promise;
  } catch (err) {
    assert.equal(toWorkspaceError(err).status, status, `${label}: ${(err as Error).message}`);
    return (err as Error).message;
  }
  assert.fail(`${label}: expected a ${status} error`);
}

export async function runHardeningChecks() {
  // --- L2: client-safe error mapping ---------------------------------------------
  {
    const savedError = console.error;
    console.error = () => {};
    const internal = toWorkspaceError(new Error('relation "User" does not exist (secret detail)'));
    console.error = savedError;
    assert.equal(internal.status, 500);
    assert.ok(!internal.message.includes("secret"), "500s never echo internal error text");
    assert.equal(toWorkspaceError(Object.assign(new Error("x"), { code: "P2002" })).status, 409);
    assert.equal(toWorkspaceError(Object.assign(new Error("x"), { code: "P2025" })).status, 404);
    assert.equal(toWorkspaceError(Object.assign(new Error("Nope"), { status: 403 })).message, "Nope");
  }

  // --- M8 / L9: admin user + section routes ----------------------------------------
  const adminA = await prisma.user.create({
    data: { id: "hd_admin_a", firstName: "Hard", lastName: "AdminA", email: "hd.admin.a@apc.edu.ph", role: "ADMIN" },
  });
  const adminB = await prisma.user.create({
    data: { id: "hd_admin_b", firstName: "Hard", lastName: "AdminB", email: "hd.admin.b@apc.edu.ph", role: "ADMIN" },
  });
  const asA = actor(adminA.id, "ADMIN");

  await expectStatus(updateUserAsAdmin({ userId: adminB.id, rawBody: { email: "not-an-email" }, actor: asA }), 400, "invalid email");
  await expectStatus(updateUserAsAdmin({ userId: adminB.id, rawBody: { role: "SUPERUSER" }, actor: asA }), 400, "unknown role");
  await expectStatus(updateUserAsAdmin({ userId: adminA.id, rawBody: { role: "TEACHER" }, actor: asA }), 400, "self-demotion");
  await expectStatus(updateUserAsAdmin({ userId: adminA.id, rawBody: { isActive: false }, actor: asA }), 400, "self-deactivation");
  await expectStatus(updateUserAsAdmin({ userId: "hd_missing", rawBody: { firstName: "X" }, actor: asA }), 404, "missing user");
  await expectStatus(deleteUserAsAdmin({ userId: "hd_missing", actor: asA }), 404, "delete missing user");
  await expectStatus(deleteSectionAsAdmin("hd_missing_section"), 404, "delete missing section");

  // Last active admin: deactivate every other admin, then try to demote adminB as A.
  const otherAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true, id: { notIn: [adminA.id, adminB.id] } },
    select: { id: true },
  });
  const otherIds = otherAdmins.map((u) => u.id);
  await prisma.user.updateMany({ where: { id: { in: otherIds } }, data: { isActive: false } });
  try {
    // A and B are the only active admins: demoting B leaves A, so it's allowed.
    const demoted = await updateUserAsAdmin({ userId: adminB.id, rawBody: { role: "TEACHER" }, actor: asA });
    assert.equal(demoted.role, "TEACHER");
    // A session for an admin that no longer exists can't remove the last one (A).
    const ghost = actor("hd_ghost_admin", "ADMIN");
    await expectStatus(updateUserAsAdmin({ userId: adminA.id, rawBody: { role: "TEACHER" }, actor: ghost }), 409, "demote last admin");
    await expectStatus(updateUserAsAdmin({ userId: adminA.id, rawBody: { isActive: false }, actor: ghost }), 409, "deactivate last admin");
    await expectStatus(deleteUserAsAdmin({ userId: adminA.id, actor: ghost }), 409, "delete last admin");
  } finally {
    await prisma.user.updateMany({ where: { id: { in: otherIds } }, data: { isActive: true } });
  }

  // --- M6: digest schedule mirrors apps/teacher/vercel.json ------------------------
  {
    const vercelPath = path.join(__dirname, "../../../../apps/teacher/vercel.json");
    const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf-8")) as {
      crons: { path: string; schedule: string }[];
    };
    const cron = vercel.crons.find((c) => c.path === "/api/cron/digest");
    assert.equal(cron?.schedule, DIGEST_CRON_SCHEDULE_UTC, "DIGEST_CRON_SCHEDULE_UTC must match vercel.json");
    const before = await prisma.systemSetting.findUnique({ where: { id: "global" } });
    const saved = await saveSystemSettings({
      activeTerm: before!.activeTerm,
      defaultDigestThreshold: before!.defaultDigestThreshold,
      digestCronSchedule: "* * * * *",
      emailProvider: before!.emailProvider,
      emailFromAddress: before!.emailFromAddress,
      allowedStudentDomain: before!.allowedStudentDomain,
      allowedStaffDomain: before!.allowedStaffDomain,
      microsoftSsoEnabled: before!.microsoftSsoEnabled,
    });
    assert.equal(saved.digestCronSchedule, DIGEST_CRON_SCHEDULE_UTC, "a submitted schedule is ignored");
  }

  // --- M9 / L5 / L11: finals track + module URL ------------------------------------
  {
    const teacher = await prisma.user.create({
      data: { id: "hd_teacher", firstName: "Hard", lastName: "Teacher", email: "hd.teacher@apc.edu.ph", role: "TEACHER" },
    });
    const student = await prisma.user.create({
      data: { id: "hd_student", firstName: "Hard", lastName: "Student", email: "hd.student@student.apc.edu.ph", studentId: "2099-930001", role: "STUDENT" },
    });
    const section = await prisma.section.create({
      data: { code: "HARD1", name: "Hard", term: "T", teacherId: teacher.id },
    });
    await prisma.enrollment.create({ data: { studentId: student.id, sectionId: section.id } });
    const asTeacher = actor(teacher.id, "TEACHER");

    await expectStatus(
      updateEnrollmentTrack({
        sectionId: section.id, studentIds: [student.id], finalsTrack: "OPENLEARNING_MODULE",
        assignedModuleTitle: "Bad link", assignedModuleUrl: "javascript:alert(1)", user: asTeacher,
      }),
      400,
      "module URL must be http(s)"
    );
    const assigned = await updateEnrollmentTrack({
      sectionId: section.id, studentIds: [student.id, "hd_not_enrolled"], finalsTrack: "OPENLEARNING_MODULE",
      assignedModuleTitle: "Noli Module", assignedModuleUrl: "https://www.openlearning.com/apc/noli", user: asTeacher,
    });
    assert.equal(assigned.count, 1, "count reports rows actually updated");

    const toSystem = await chooseStudentFinalsTrack({ studentUserId: student.id, sectionId: section.id, finalsTrack: "SYSTEM" });
    assert.equal(toSystem.track, "SYSTEM");
    assert.equal(toSystem.assignedModuleTitle, "Noli Module", "switching to SYSTEM keeps the assigned module");
    const back = await chooseStudentFinalsTrack({ studentUserId: student.id, sectionId: section.id, finalsTrack: "OPENLEARNING_MODULE" });
    assert.equal(back.assignedModuleUrl, "https://www.openlearning.com/apc/noli");
    await expectStatus(
      chooseStudentFinalsTrack({ studentUserId: student.id, sectionId: "hd_other", finalsTrack: "SYSTEM" }),
      404,
      "not enrolled"
    );

    // --- L3: quest dates and task numbers ------------------------------------------
    const base = { sectionId: section.id, title: "Quest", description: "Do it.", category: "REFLECTION" };
    await expectStatus(createManagedQuest({ ...base, deadline: "not-a-date" }, asTeacher), 400, "invalid deadline");
    await expectStatus(
      createManagedQuest({ ...base, startDate: "2026-12-10T00:00:00Z", deadline: "2026-12-01T00:00:00Z" }, asTeacher),
      400,
      "deadline before start"
    );
    const q1 = await createManagedQuest({ ...base, taskNumber: 7 }, asTeacher);
    const dupMsg = await expectStatus(createManagedQuest({ ...base, taskNumber: 7 }, asTeacher), 409, "duplicate task number");
    assert.match(dupMsg ?? "", /Task #7 already exists/);
    await expectStatus(updateManagedQuest(q1.id, { deadline: "31/12/2026" }, asTeacher), 400, "invalid date on update");
  }
}
