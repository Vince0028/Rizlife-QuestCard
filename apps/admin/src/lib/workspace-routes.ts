import { createWorkspaceRoutes } from "@rizlife/shared/workspace-routes";
import { getAdminSession } from "@/lib/session";

/** /api/workspace/** handlers, authenticated with the admin portal session. */
export const workspaceRoutes = createWorkspaceRoutes(getAdminSession);
