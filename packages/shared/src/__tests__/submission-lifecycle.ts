/**
 * Submission lifecycle + threshold digest checks. These run the real service code
 * (submitStudentQuest, reviewOrStampSubmission, maybeTriggerThresholdDigest) against
 * the local JSON adapter configured by ./test-env.
 */
import assert from "node:assert/strict";
import { prisma } from "../db";
import {
  getSectionWorkspaceData,
  reviewOrStampSubmission,
  submitStudentQuest,
} from "../workspace-service";
import { maybeTriggerThresholdDigest, sendSectionDigest } from "../digest";
import type { SessionPayload } from "../types";

const TEACHER_ID = "usr_teacher_01"; // from the adapter's seed (mirrors supabase/setup.sql)

const teacherSession: SessionPayload = {
  userId: TEACHER_ID,
  email: "teacher@apc.edu.ph",
  role: "TEACHER",
  firstName: "Maria Clara",
  lastName: "de los Santos",
  studentId: null,
  courseCode: null,
  mustChangePassword: false,
  portal: "teacher",
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 15));
const url = (n: number | string) =>
  `https://www.openlearning.com/apc/courses/rizlife/task-1/post-${n}`;

let seq = 0;
async function createSectionFixture(studentCount: number, digestThreshold = 20) {
  seq += 1;
  const section = await prisma.section.create({
    data: {
      code: `VERIFY${seq}`,
      name: `Verify Section ${seq}`,
      term: "Term 2 AY 2026-2027",
      teacherId: TEACHER_ID,
      digestThreshold,
    },
  });
  const quest = await prisma.quest.create({
    data: {
      sectionId: section.id,
      taskNumber: 1,
      title: "Revisiting the Law",
      description: "Post your reflection on OpenLearning.",
    },
  });
  const students = [];
  for (let i = 0; i < studentCount; i++) {
    const student = await prisma.user.create({
      data: {
        studentId: `2099-${seq}${String(i).padStart(4, "0")}`,
        firstName: `Student${i}`,
        lastName: `Verify${seq}`,
        email: `verify${seq}.s${i}@student.apc.edu.ph`,
        role: "STUDENT",
      },
    });
    await prisma.enrollment.create({
      data: { studentId: student.id, sectionId: section.id },
    });
    students.push(student);
  }
  return { section, quest, students };
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  try {
    await promise;
  } catch (err) {
    assert.equal((err as { status?: number }).status, status);
    return err as Error;
  }
  assert.fail(`Expected the call to be rejected with status ${status}`);
}

export async function runSubmissionLifecycleChecks() {
  // (1) Resubmitting a NEEDS_REVISION quest keeps firstSubmittedAt and resets includedInDigest
  {
    const { quest, students } = await createSectionFixture(1);
    const studentUserId = students[0].id;

    const first = await submitStudentQuest({
      studentUserId,
      rawBody: { questId: quest.id, submissionUrl: url("first") },
    });
    const firstSubmittedAt = first.submission.firstSubmittedAt!.getTime();
    assert.equal(first.submission.status, "PENDING_REVIEW");
    assert.equal(first.submission.includedInDigest, false);

    await tick();
    await reviewOrStampSubmission(
      {
        questId: quest.id,
        studentId: studentUserId,
        action: "NEEDS_REVISION",
        teacherFeedback: "Please cite your sources.",
      },
      teacherSession
    );
    const revised = await prisma.submission.findUnique({
      where: { questId_studentId: { questId: quest.id, studentId: studentUserId } },
    });
    assert.equal(revised!.status, "NEEDS_REVISION");
    assert.equal(revised!.includedInDigest, true, "review marks the row as handled");

    await tick();
    await submitStudentQuest({
      studentUserId,
      rawBody: { questId: quest.id, submissionUrl: url("revised"), studentNote: "Added sources" },
    });
    const resubmitted = await prisma.submission.findUnique({
      where: { questId_studentId: { questId: quest.id, studentId: studentUserId } },
    });
    assert.equal(resubmitted!.status, "PENDING_REVIEW");
    assert.equal(
      resubmitted!.firstSubmittedAt!.getTime(),
      firstSubmittedAt,
      "firstSubmittedAt must survive a resubmission"
    );
    assert.ok(
      resubmitted!.submittedAt!.getTime() > firstSubmittedAt,
      "submittedAt should move to the resubmission time"
    );
    assert.equal(
      resubmitted!.includedInDigest,
      false,
      "resubmission must be queued for the next digest"
    );
    assert.equal(resubmitted!.submissionUrl, url("revised"));
    assert.equal(resubmitted!.teacherFeedback, "Please cite your sources.");
  }

  // (2) STAMPED submissions cannot be resubmitted
  {
    const { quest, students } = await createSectionFixture(1);
    const studentUserId = students[0].id;

    await submitStudentQuest({
      studentUserId,
      rawBody: { questId: quest.id, submissionUrl: url("stamp-me") },
    });
    await reviewOrStampSubmission(
      { questId: quest.id, studentId: studentUserId, action: "STAMP" },
      teacherSession
    );
    const stamped = await prisma.submission.findUnique({
      where: { questId_studentId: { questId: quest.id, studentId: studentUserId } },
    });
    assert.equal(stamped!.status, "STAMPED");

    const err = await expectStatus(
      submitStudentQuest({
        studentUserId,
        rawBody: { questId: quest.id, submissionUrl: url("sneaky-edit") },
      }),
      409
    );
    assert.match(err.message, /already been stamped/);

    const after = await prisma.submission.findUnique({
      where: { questId_studentId: { questId: quest.id, studentId: studentUserId } },
    });
    assert.equal(after!.status, "STAMPED");
    assert.equal(after!.submissionUrl, url("stamp-me"));
    assert.equal(after!.stampedAt!.getTime(), stamped!.stampedAt!.getTime());
    assert.equal(after!.submittedAt!.getTime(), stamped!.submittedAt!.getTime());
  }

  // (3) Reaching digestThreshold (20) fires exactly one THRESHOLD digest. In preview
  //     mode nothing is emailed, so the 20 submissions stay queued for a real send.
  {
    const { section, quest, students } = await createSectionFixture(21, 20);
    const submit = (i: number) =>
      submitStudentQuest({
        studentUserId: students[i].id,
        rawBody: { questId: quest.id, submissionUrl: url(`batch-${i}`) },
      });
    const digestLogs = () =>
      prisma.emailDigestLog.findMany({ where: { sectionId: section.id } });
    const undigested = () =>
      prisma.submission.count({
        where: { quest: { sectionId: section.id }, status: "PENDING_REVIEW", includedInDigest: false },
      });

    for (let i = 0; i < 19; i++) await submit(i);
    assert.equal((await digestLogs()).length, 0, "19 pending submissions must not trigger a digest");
    assert.equal(await undigested(), 19);

    await submit(19); // the 20th pending submission
    const logs = await digestLogs();
    assert.equal(logs.length, 1, "the 20th submission should trigger one digest");
    assert.equal(logs[0].triggerType, "THRESHOLD");
    assert.equal(logs[0].submissionCount, 20);
    assert.equal(logs[0].teacherId, TEACHER_ID);
    assert.equal(logs[0].recipientEmail, "teacher@apc.edu.ph");
    assert.equal(logs[0].deliveryStatus, "PREVIEW_ONLY");
    assert.equal(await undigested(), 20, "a preview is not an email: submissions stay queued");
    const refreshed = await prisma.section.findUnique({ where: { id: section.id } });
    assert.ok(refreshed!.lastDigestSentAt instanceof Date, "the attempt claims the section");

    await submit(20); // 21st: over threshold again, but inside the threshold cooldown
    assert.equal((await digestLogs()).length, 1, "threshold digests respect the cooldown");
    assert.equal(await undigested(), 21);
  }

  await runDigestDeliveryChecks();
}

/** Points the global email provider at `provider` for the duration of `fn`. */
async function withEmailProvider<T>(provider: string, fn: () => Promise<T>): Promise<T> {
  const before = await prisma.systemSetting.findUnique({ where: { id: "global" } });
  await prisma.systemSetting.upsert({
    where: { id: "global" },
    update: { emailProvider: provider },
    create: { id: "global", emailProvider: provider },
  });
  try {
    return await fn();
  } finally {
    await prisma.systemSetting.update({
      where: { id: "global" },
      data: { emailProvider: before?.emailProvider ?? "preview" },
    });
  }
}

async function submitAll(questId: string, students: { id: string }[]) {
  for (const [i, st] of students.entries()) {
    await submitStudentQuest({
      studentUserId: st.id,
      rawBody: { questId, submissionUrl: url(`delivery-${i}`) },
      scheduleDigestCheck: () => {}, // threshold check not under test here
    });
  }
}

async function runDigestDeliveryChecks() {
  const savedKey = process.env.RESEND_API_KEY;
  const savedFetch = globalThis.fetch;
  const queued = (sectionId: string) =>
    prisma.submission.count({
      where: { quest: { sectionId }, status: "PENDING_REVIEW", includedInDigest: false },
    });

  try {
    // (4) Resend selected but RESEND_API_KEY missing: FAILED, nothing marked as digested.
    {
      delete process.env.RESEND_API_KEY;
      const { section, quest, students } = await createSectionFixture(2, 50);
      await submitAll(quest.id, students);
      const result = await withEmailProvider("resend", () =>
        sendSectionDigest(section.id, "MANUAL")
      );
      assert.equal(result.sent, false);
      assert.equal(result.deliveryStatus, "FAILED");
      assert.match(result.error ?? "", /RESEND_API_KEY/);
      assert.equal(await queued(section.id), 2, "unsent digests leave submissions queued");
      const [log] = await prisma.emailDigestLog.findMany({ where: { sectionId: section.id } });
      assert.equal(log.deliveryStatus, "FAILED");
      assert.match(log.errorMessage ?? "", /RESEND_API_KEY/);
    }

    // (5) A delivered email (Resend mocked) marks the batch and is the "last sent" time.
    {
      process.env.RESEND_API_KEY = "re_test_key";
      const sentTo: string[] = [];
      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        if (String(input) === "https://api.resend.com/emails") {
          sentTo.push(...(JSON.parse(String(init?.body)) as { to: string[] }).to);
          return Response.json({ id: "email_1" });
        }
        return savedFetch(input as RequestInfo, init);
      }) as typeof fetch;
      const { section, quest, students } = await createSectionFixture(3, 50);
      await submitAll(quest.id, students);
      const result = await withEmailProvider("resend", () =>
        sendSectionDigest(section.id, "MANUAL")
      );
      assert.equal(result.sent, true);
      assert.equal(result.deliveryStatus, "SENT");
      assert.deepEqual(sentTo, ["teacher@apc.edu.ph"]);
      assert.equal(await queued(section.id), 0, "a sent digest marks its submissions");
      const ws = await getSectionWorkspaceData(section.id, teacherSession);
      assert.ok(ws.section.lastDigestSentAt, "workspace reports the last *sent* digest");
      globalThis.fetch = savedFetch;
    }

    // (6) Concurrent triggers for one section produce exactly one digest.
    {
      const { section, quest, students } = await createSectionFixture(3, 3);
      await submitAll(quest.id, students);
      const results = await Promise.all([
        maybeTriggerThresholdDigest(section.id),
        maybeTriggerThresholdDigest(section.id),
        sendSectionDigest(section.id, "MANUAL"),
        sendSectionDigest(section.id, "SCHEDULED"),
        maybeTriggerThresholdDigest(section.id),
      ]);
      assert.equal(results.length, 5);
      const logs = await prisma.emailDigestLog.findMany({ where: { sectionId: section.id } });
      assert.equal(logs.length, 1, `expected one digest under concurrency, got ${logs.length}`);
      const again = await sendSectionDigest(section.id, "MANUAL");
      assert.equal(again.skipped, true, "a second manual send right after is held back");
    }
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedKey;
  }
}
