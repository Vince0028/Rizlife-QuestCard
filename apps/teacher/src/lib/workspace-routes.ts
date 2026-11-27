import { createWorkspaceRoutes } from "@rizlife/shared/workspace-routes";
import { getTeacherSession } from "@/lib/session";

/** /api/workspace/** handlers, authenticated with the teacher portal session. */
export const workspaceRoutes = createWorkspaceRoutes(getTeacherSession);
