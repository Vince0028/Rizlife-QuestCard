import { cookies } from "next/headers";
import { PORTAL_COOKIES, verifySessionToken } from "@rizlife/shared/auth";
import type { SessionPayload } from "@rizlife/shared/types";

export async function getAdminSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_COOKIES.admin)?.value;
  return verifySessionToken(token, "admin");
}
