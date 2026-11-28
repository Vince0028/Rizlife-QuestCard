import { cookies } from "next/headers";
import { PORTAL_COOKIES } from "@rizlife/shared/auth";
import { getValidatedSession } from "@rizlife/shared/portal-auth";
import type { SessionPayload } from "@rizlife/shared/types";

/**
 * The signed-in admin, re-checked against the database on every call: null when the
 * account was deleted, deactivated, changed role, or had its sessions revoked
 * (password change/reset). See getValidatedSession.
 */
export async function getAdminSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return getValidatedSession(cookieStore.get(PORTAL_COOKIES.admin)?.value, "admin");
}
