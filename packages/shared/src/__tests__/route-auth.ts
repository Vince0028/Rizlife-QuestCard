/**
 * HTTP-layer authorization checks for the shared workspace routes (teacher + admin
 * portals) and the shared portal middleware. Handlers run against the throwaway local
 * JSON DB from ./test-env with an injected session.
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../db";
import { PORTAL_COOKIES, signSessionToken } from "../auth";
import { createPortalMiddleware } from "../portal-middleware";
import { createWorkspaceRoutes, type RouteHandler } from "../workspace-routes";
import type { PortalKey, SessionPayload } from "../types";

const BASE = "http://localhost:3002/api/workspace";

function session(
  userId: string,
  role: SessionPayload["role"],
  portal: PortalKey = role === "ADMIN" ? "admin" : "teacher"
): SessionPayload {
  return {
    userId,
    email: `${userId}@apc.edu.ph`,
    role,
    firstName: "Route",
    lastName: userId,
    studentId: null,
    courseCode: null,
    mustChangePassword: false,
    portal,
  };
}

let current: SessionPayload | null = null;
const routes = createWorkspaceRoutes(async () => current);

function json(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

async function call(
  handler: RouteHandler<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  path: string,
  init: RequestInit,
  params: Record<string, string> = {}
) {
  const res = await handler(new Request(`${BASE}${path}`, init), {
    params: Promise.resolve(params),
  });
  return res;
}

export async function runRouteAuthChecks() {
  // --- Fixtures: teacher A owns section A, teacher B owns section B ---------------
  const mkUser = (id: string, role: "TEACHER" | "ADMIN" | "STUDENT", extra: object = {}) =>
    prisma.user.create({
      data: { id, firstName: "Route", lastName: id, email: `${id}@apc.edu.ph`, role, ...extra },
    });
  await mkUser("rt_teacher_a", "TEACHER");
  await mkUser("rt_teacher_b", "TEACHER");
  await mkUser("rt_admin", "ADMIN");
  const student = await mkUser("rt_student", "STUDENT", { studentId: "2099-900001" });
  const secA = await prisma.section.create({
    data: { code: "ROUTEA", name: "Route A", term: "T", teacherId: "rt_teacher_a" },
  });
  await prisma.section.create({
    data: { code: "ROUTEB", name: "Route B", term: "T", teacherId: "rt_teacher_b" },
  });
  await prisma.enrollment.create({ data: { studentId: student.id, sectionId: secA.id } });
  const quest = await prisma.quest.create({
    data: { sectionId: secA.id, taskNumber: 1, title: "Route quest", description: "Do it." },
  });
  await prisma.submission.create({
    data: {
      questId: quest.id,
      studentId: student.id,
      status: "PENDING_REVIEW",
      submissionUrl: "https://www.openlearning.com/apc/post/route",
      submittedAt: new Date(),
      firstSubmittedAt: new Date(),
    },
  });
  const log = await prisma.emailDigestLog.create({
    data: {
      teacherId: "rt_teacher_a",
      sectionId: secA.id,
      recipientEmail: "rt_teacher_a@apc.edu.ph",
      subject: "Route digest",
      submissionCount: 1,
      triggerType: "MANUAL",
      deliveryStatus: "PREVIEW_ONLY",
      htmlPreview: "<p>route</p>",
    },
  });

  const s = { sectionId: secA.id };
  const importForm = () => {
    const form = new FormData();
    form.set("sectionId", secA.id);
    form.set(
      "file",
      new File(
        ["Student ID,Last Name,First Name,APC Email\n2099-900002,Route,Imported,rt.imported@student.apc.edu.ph"],
        "roster.csv",
        { type: "text/csv" }
      )
    );
    return { method: "POST", body: form } as RequestInit;
  };

  // Every handler that touches section A's data. Read-only / idempotent where possible
  // so the same table can be replayed for each caller.
  const sectionScoped: Array<[string, () => Promise<Response>]> = [
    ["section.GET", () => call(routes.section.GET, `/sections/${secA.id}`, json("GET"), s)],
    ["section.PATCH", () => call(routes.section.PATCH, `/sections/${secA.id}`, json("PATCH", { name: "Route A" }), s)],
    ["sectionExport.GET", () => call(routes.sectionExport.GET, `/sections/${secA.id}/export?format=csv`, json("GET"), s)],
    ["sectionDigest.POST", () => call(routes.sectionDigest.POST, `/sections/${secA.id}/digest`, json("POST"), s)],
    ["digestLog.GET", () => call(routes.digestLog.GET, `/sections/${secA.id}/digest-logs/${log.id}`, json("GET"), { ...s, logId: log.id })],
    ["quests.POST", () => call(routes.quests.POST, "/quests", json("POST", { sectionId: secA.id, title: "Extra quest", description: "More.", category: "REFLECTION" }))],
    ["quest.PATCH", () => call(routes.quest.PATCH, `/quests/${quest.id}`, json("PATCH", { title: "Route quest" }), { questId: quest.id })],
    ["questReorder.POST", () => call(routes.questReorder.POST, `/quests/${quest.id}/reorder`, json("POST", { direction: "UP" }), { questId: quest.id })],
    ["students.POST", () => call(routes.students.POST, "/students", json("POST", { sectionId: secA.id, studentId: "2099-900001", firstName: "Route", lastName: "rt_student", email: "rt_student@apc.edu.ph" }))],
    ["student.PATCH", () => call(routes.student.PATCH, `/students/${student.id}`, json("PATCH", { courseCode: "BSIT" }), { studentId: student.id })],
    ["studentResetPassword.POST", () => call(routes.studentResetPassword.POST, `/students/${student.id}/reset-password`, json("POST", { newPassword: "Route@2099" }), { studentId: student.id })],
    ["studentsImport.POST", () => call(routes.studentsImport.POST, "/students/import", importForm())],
    ["studentsAssignTrack.POST", () => call(routes.studentsAssignTrack.POST, "/students/assign-track", json("POST", { sectionId: secA.id, studentIds: [student.id], finalsTrack: "SYSTEM" }))],
    ["submissionReview.POST", () => call(routes.submissionReview.POST, "/submissions/review", json("POST", { questId: quest.id, studentId: student.id, action: "NEEDS_REVISION", teacherFeedback: "Again" }))],
  ];
  const destructive: Array<[string, () => Promise<Response>]> = [
    ["sectionEnrollment.DELETE", () => call(routes.sectionEnrollment.DELETE, `/sections/${secA.id}/enrollments/${student.id}`, json("DELETE"), { ...s, studentId: student.id })],
    ["quest.DELETE", () => call(routes.quest.DELETE, `/quests/${quest.id}`, json("DELETE"), { questId: quest.id })],
    ["section.DELETE", () => call(routes.section.DELETE, `/sections/${secA.id}`, json("DELETE"), s)],
  ];
  const unscoped: Array<[string, () => Promise<Response>]> = [
    ["sections.GET", () => call(routes.sections.GET, "/sections", json("GET"))],
    ["sections.POST", () => call(routes.sections.POST, "/sections", json("POST", { code: "ROUTEX", name: "Route X" }))],
    ["studentsTemplate.GET", () => call(routes.studentsTemplate.GET, "/students/template", json("GET"))],
  ];

  // 1) No session -> 401 everywhere (nothing is executed, so destructive calls are safe).
  current = null;
  for (const [name, run] of [...unscoped, ...sectionScoped, ...destructive]) {
    assert.equal((await run()).status, 401, `${name} without a session must be 401`);
  }

  // 2) Teacher B can't touch section A.
  current = session("rt_teacher_b", "TEACHER");
  for (const [name, run] of [...sectionScoped, ...destructive]) {
    const res = await run();
    assert.equal(res.status, 403, `${name} by another teacher must be 403 (got ${res.status}: ${(await res.text()).slice(0, 200)})`);
  }
  const listB = (await (await unscoped[0][1]()).json()) as { sections: { id: string }[] };
  assert.ok(!listB.sections.some((x) => x.id === secA.id), "teacher B's section list excludes section A");

  // 3) The owning teacher, then the admin override, succeed.
  for (const actor of [session("rt_teacher_a", "TEACHER"), session("rt_admin", "ADMIN")]) {
    current = actor;
    for (const [name, run] of sectionScoped) {
      const res = await run();
      assert.ok(res.ok, `${name} by ${actor.userId} should succeed (got ${res.status}: ${(await res.text()).slice(0, 200)})`);
    }
  }
  const preview = (await (await sectionScoped[4][1]()).json()) as { html: string };
  assert.equal(preview.html, "<p>route</p>", "digest log preview returns the stored HTML");
  const listA = (await (await unscoped[0][1]()).json()) as { sections: { id: string }[] };
  assert.ok(listA.sections.some((x) => x.id === secA.id), "admin sees section A");

  // A digest log from section A can't be read through another section's URL.
  current = session("rt_teacher_b", "TEACHER");
  const secBId = (await prisma.section.findFirst({ where: { code: "ROUTEB" } }))!.id;
  const crossLog = await call(
    routes.digestLog.GET,
    `/sections/${secBId}/digest-logs/${log.id}`,
    json("GET"),
    { sectionId: secBId, logId: log.id }
  );
  assert.equal(crossLog.status, 404, "digest log is scoped to its own section");

  current = session("rt_teacher_a", "TEACHER");
  for (const [name, run] of destructive) {
    const res = await run();
    assert.ok(res.ok, `${name} by the owner should succeed (got ${res.status}: ${(await res.text()).slice(0, 200)})`);
  }
  current = null;

  await runPortalMiddlewareChecks();
}

async function runPortalMiddlewareChecks() {
  const token = (portal: PortalKey, role: SessionPayload["role"], mustChangePassword = false) =>
    signSessionToken({ ...session(`mw_${portal}`, role, portal), mustChangePassword });
  const request = (portal: PortalKey, path: string, cookie?: string) =>
    new NextRequest(`http://localhost:3002${path}`, {
      headers: cookie ? { cookie: `${PORTAL_COOKIES[portal]}=${cookie}` } : {},
    });
  const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";

  const teacherMw = createPortalMiddleware("teacher", { publicPrefixes: ["/api/cron/"] });
  const studentMw = createPortalMiddleware("student");

  // A student token presented on the teacher portal is not a teacher session.
  const studentToken = await token("student", "STUDENT");
  const apiRes = await teacherMw(request("teacher", "/api/workspace/sections", studentToken));
  assert.equal(apiRes.status, 401, "teacher API rejects a student-portal token");
  const pageRes = await teacherMw(request("teacher", "/dashboard", studentToken));
  assert.equal(pageRes.status, 307);
  assert.ok(pageRes.headers.get("location")?.includes("/login?error=unauthorized"));
  assert.match(pageRes.headers.get("set-cookie") ?? "", /rizlife_teacher_session=;/, "bad cookie cleared");

  // Valid session passes; forced password change redirects pages but not APIs.
  const teacherToken = await token("teacher", "TEACHER");
  assert.ok(passes(await teacherMw(request("teacher", "/dashboard", teacherToken))));
  const mustChange = await token("teacher", "TEACHER", true);
  const forced = await teacherMw(request("teacher", "/dashboard", mustChange));
  assert.ok(forced.headers.get("location")?.endsWith("/change-password"));

  // /api/cron/ is public on the teacher portal only; /api/auth/ is public everywhere.
  assert.ok(passes(await teacherMw(request("teacher", "/api/cron/digest"))));
  assert.equal((await studentMw(request("student", "/api/cron/digest"))).status, 401);
  assert.ok(passes(await studentMw(request("student", "/api/auth/login"))));
}
