import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { PortalKey, RoleValue, SessionPayload } from "./types";

export const PORTAL_COOKIES: Record<PortalKey, string> = {
  student: "rizlife_student_session",
  teacher: "rizlife_teacher_session",
  admin: "rizlife_admin_session",
};

export const PORTAL_ALLOWED_ROLES: Record<PortalKey, RoleValue[]> = {
  student: ["STUDENT"],
  teacher: ["TEACHER", "ADMIN"],
  admin: ["ADMIN"],
};

const DEV_FALLBACK_SECRET = "rizlife-dev-secret-change-in-production-2026";
let warnedDevSecret = false;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET environment variable must be set (minimum 16 characters) in production."
      );
    }
    if (!warnedDevSecret) {
      warnedDevSecret = true;
      console.warn(
        "[RizLife Auth] JWT_SECRET not configured; using development fallback secret."
      );
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    firstName: payload.firstName,
    middleName: payload.middleName ?? null,
    lastName: payload.lastName,
    studentId: payload.studentId,
    courseCode: payload.courseCode,
    mustChangePassword: payload.mustChangePassword,
    portal: payload.portal,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string | undefined | null,
  expectedPortal?: PortalKey
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    const portal = payload.portal as PortalKey | undefined;
    const role = payload.role as RoleValue | undefined;
    const userId = payload.userId as string | undefined;
    const email = payload.email as string | undefined;

    if (!portal || !role || !userId || !email) {
      return null;
    }

    if (expectedPortal) {
      if (portal !== expectedPortal) return null;
      if (!PORTAL_ALLOWED_ROLES[expectedPortal].includes(role)) return null;
    }

    return {
      userId,
      email,
      role,
      firstName: String(payload.firstName ?? ""),
      middleName: (payload.middleName as string | null) ?? null,
      lastName: String(payload.lastName ?? ""),
      studentId: (payload.studentId as string | null) ?? null,
      courseCode: (payload.courseCode as string | null) ?? null,
      mustChangePassword: Boolean(payload.mustChangePassword),
      portal,
    };
  } catch {
    return null;
  }
}

export function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function getClearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
