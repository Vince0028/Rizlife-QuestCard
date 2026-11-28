/**
 * Workspace API route handlers shared by the teacher and admin portals.
 *
 * Both portals expose the same /api/workspace/** surface; they differ only in which
 * session cookie authenticates the caller. Each app builds this once with its own
 * session getter (apps/{teacher,admin}/src/lib/workspace-routes.ts) and re-exports the
 * handlers from its route files. Authorization beyond "is signed in to this portal"
 * (section ownership, admin override) lives in workspace-service.ts.
 *
 * Handlers are web-standard (Request -> Response) so they can be unit-tested without
 * Next.js; Next's route handlers accept them as-is.
 */
import { generateStudentImportCsvTemplate } from "./excel";
import { updateEnrollmentTrackSchema } from "./validation";
import {
  bulkImportStudentsForSection,
  createManagedQuest,
  createManagedSection,
  createOrEnrollStudent,
  deleteManagedQuest,
  deleteManagedSection,
  exportSectionTrackerFile,
  getDigestLogPreview,
  getSectionWorkspaceData,
  listManageableSections,
  removeStudentFromSection,
  reorderManagedQuest,
  resetManagedUserPassword,
  reviewOrStampSubmission,
  toWorkspaceError,
  triggerManualSectionDigest,
  updateEnrollmentTrack,
  updateManagedQuest,
  updateManagedSection,
  updateManagedStudent,
} from "./workspace-service";
import { requirePasswordChanged } from "./portal-auth";
import type { SessionPayload } from "./types";

export type SessionGetter = () => Promise<SessionPayload | null>;

type Params = Record<string, string>;
export interface RouteContext<P extends Params = Params> {
  params: Promise<P>;
}
export type RouteHandler<P extends Params = Params> = (
  req: Request,
  context: RouteContext<P>
) => Promise<Response>;

const NO_PARAMS: RouteContext = { params: Promise.resolve({}) };

function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => ({}));
}

export function createWorkspaceRoutes(getSession: SessionGetter) {
  /** Session check (401) + params + service-error mapping, shared by every handler. */
  function guard<P extends Params = Params>(
    fn: (args: { req: Request; params: P; session: SessionPayload }) => Promise<Response>
  ): RouteHandler<P> {
    return async (req, context) => {
      const session = await getSession();
      if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const gate = requirePasswordChanged(session);
      if (gate) return gate;
      try {
        const params = (await (context ?? NO_PARAMS).params) as P;
        return await fn({ req, params, session });
      } catch (err) {
        const e = toWorkspaceError(err);
        return Response.json({ error: e.message }, { status: e.status });
      }
    };
  }

  return {
    // /api/workspace/sections
    sections: {
      GET: guard(async ({ session }) =>
        Response.json({ sections: await listManageableSections(session) })
      ),
      POST: guard(async ({ req, session }) =>
        Response.json(
          { section: await createManagedSection(await readJson(req), session) },
          { status: 201 }
        )
      ),
    },

    // /api/workspace/sections/[sectionId]
    section: {
      GET: guard<{ sectionId: string }>(async ({ params, session }) =>
        Response.json(await getSectionWorkspaceData(params.sectionId, session))
      ),
      PATCH: guard<{ sectionId: string }>(async ({ req, params, session }) =>
        Response.json({
          section: await updateManagedSection(params.sectionId, await readJson(req), session),
        })
      ),
      DELETE: guard<{ sectionId: string }>(async ({ params, session }) =>
        Response.json(await deleteManagedSection(params.sectionId, session))
      ),
    },

    // /api/workspace/sections/[sectionId]/digest
    sectionDigest: {
      POST: guard<{ sectionId: string }>(async ({ params, session }) =>
        Response.json(await triggerManualSectionDigest(params.sectionId, session))
      ),
    },

    // /api/workspace/sections/[sectionId]/digest-logs/[logId]
    digestLog: {
      GET: guard<{ sectionId: string; logId: string }>(async ({ params, session }) =>
        Response.json(await getDigestLogPreview(params.sectionId, params.logId, session))
      ),
    },

    // /api/workspace/sections/[sectionId]/enrollments/[studentId]
    sectionEnrollment: {
      DELETE: guard<{ sectionId: string; studentId: string }>(async ({ params, session }) =>
        Response.json(
          await removeStudentFromSection({
            sectionId: params.sectionId,
            studentId: params.studentId,
            user: session,
          })
        )
      ),
    },

    // /api/workspace/sections/[sectionId]/export?format=xlsx|csv
    sectionExport: {
      GET: guard<{ sectionId: string }>(async ({ req, params, session }) => {
        const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
        const file = await exportSectionTrackerFile({
          sectionId: params.sectionId,
          format,
          user: session,
        });
        return new Response(new Uint8Array(file.data), {
          status: 200,
          headers: {
            "Content-Type": file.contentType,
            "Content-Disposition": `attachment; filename="${file.filename}"`,
          },
        });
      }),
    },

    // /api/workspace/quests
    quests: {
      POST: guard(async ({ req, session }) =>
        Response.json(
          { quest: await createManagedQuest(await readJson(req), session) },
          { status: 201 }
        )
      ),
    },

    // /api/workspace/quests/[questId]
    quest: {
      PATCH: guard<{ questId: string }>(async ({ req, params, session }) =>
        Response.json({
          quest: await updateManagedQuest(params.questId, await readJson(req), session),
        })
      ),
      DELETE: guard<{ questId: string }>(async ({ params, session }) =>
        Response.json(await deleteManagedQuest(params.questId, session))
      ),
    },

    // /api/workspace/quests/[questId]/reorder
    questReorder: {
      POST: guard<{ questId: string }>(async ({ req, params, session }) => {
        const body = (await readJson(req)) as { direction?: string };
        const direction = body.direction === "DOWN" ? "DOWN" : "UP";
        return Response.json(await reorderManagedQuest(params.questId, direction, session));
      }),
    },

    // /api/workspace/students
    students: {
      POST: guard(async ({ req, session }) =>
        Response.json(await createOrEnrollStudent(await readJson(req), session), {
          status: 201,
        })
      ),
    },

    // /api/workspace/students/[studentId]
    student: {
      PATCH: guard<{ studentId: string }>(async ({ req, params, session }) =>
        Response.json(
          await updateManagedStudent({
            studentUserId: params.studentId,
            rawBody: await readJson(req),
            actor: session,
          })
        )
      ),
    },

    // /api/workspace/students/[studentId]/reset-password (random temp password, shown once)
    studentResetPassword: {
      POST: guard<{ studentId: string }>(async ({ params, session }) =>
        Response.json(
          await resetManagedUserPassword({ targetUserId: params.studentId, actor: session })
        )
      ),
    },

    // /api/workspace/students/import (multipart: sectionId, file)
    studentsImport: {
      POST: guard(async ({ req, session }) => {
        const form = await req.formData();
        const sectionId = String(form.get("sectionId") || "");
        const file = form.get("file");
        if (!sectionId || !(file instanceof File)) {
          return Response.json(
            { error: "Section ID and CSV/XLSX file are required." },
            { status: 400 }
          );
        }
        return Response.json(
          await bulkImportStudentsForSection({
            sectionId,
            fileBuffer: Buffer.from(await file.arrayBuffer()),
            filename: file.name,
            user: session,
          })
        );
      }),
    },

    // /api/workspace/students/assign-track
    studentsAssignTrack: {
      POST: guard(async ({ req, session }) => {
        const parsed = updateEnrollmentTrackSchema.safeParse(await readJson(req));
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message || "Invalid payload." },
            { status: 400 }
          );
        }
        return Response.json(
          await updateEnrollmentTrack({ ...parsed.data, user: session })
        );
      }),
    },

    // /api/workspace/students/template (now session-guarded like every other route)
    studentsTemplate: {
      GET: guard(async () =>
        new Response(generateStudentImportCsvTemplate(), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="rizlife_student_import_template.csv"',
          },
        })
      ),
    },

    // /api/workspace/submissions/review
    submissionReview: {
      POST: guard(async ({ req, session }) =>
        Response.json({
          ok: true,
          submission: await reviewOrStampSubmission(await readJson(req), session),
        })
      ),
    },
  };
}

export type WorkspaceRoutes = ReturnType<typeof createWorkspaceRoutes>;
