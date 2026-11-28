/**
 * Admin-console account and section operations (apps/admin/src/app/api/admin/**).
 * Kept in the shared package so the guards are covered by `npm run verify`.
 * Errors carry `status`; routes map them with toWorkspaceError.
 */
import { prisma } from "./db";
import { DIGEST_CRON_SCHEDULE_UTC } from "./types";
import type { SessionPayload } from "./types";
import {
  createUserAdminSchema,
  systemSettingsSchema,
  updateUserAdminSchema,
} from "./validation";
import { clientError, issueTemporaryPassword } from "./workspace-service";

async function countOtherActiveAdmins(excludeUserId: string) {
  return prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: excludeUserId } },
  });
}

export async function updateUserAsAdmin(params: {
  userId: string;
  rawBody: unknown;
  actor: SessionPayload;
}) {
  const parsed = updateUserAdminSchema.safeParse(params.rawBody);
  if (!parsed.success) {
    throw clientError(parsed.error.issues[0]?.message || "Invalid user update.");
  }
  const data = parsed.data;
  const isSelf = params.userId === params.actor.userId;

  if (isSelf && data.isActive === false) {
    throw clientError("You cannot deactivate your own active admin account.");
  }
  if (isSelf && data.role !== undefined && data.role !== "ADMIN") {
    throw clientError(
      "You cannot remove your own admin role. Ask another administrator to change it."
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!existing) throw clientError("User not found.", 404);

  const losesAdminAccess =
    existing.role === "ADMIN" &&
    existing.isActive &&
    ((data.role !== undefined && data.role !== "ADMIN") || data.isActive === false);
  if (losesAdminAccess && (await countOtherActiveAdmins(existing.id)) === 0) {
    throw clientError("This is the last active administrator account; keep at least one.", 409);
  }

  if (data.email && data.email !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email: data.email } });
    if (clash && clash.id !== existing.id) {
      throw clientError(`Email ${data.email} is already used by another account.`, 409);
    }
  }
  const studentId = data.studentId === undefined ? undefined : data.studentId || null;
  if (studentId && studentId !== existing.studentId) {
    const clash = await prisma.user.findUnique({ where: { studentId } });
    if (clash && clash.id !== existing.id) {
      throw clientError(`Student ID ${studentId} is already assigned.`, 409);
    }
  }

  // Losing access or changing role ends the user's current sessions immediately.
  const revokeSessions =
    (data.role !== undefined && data.role !== existing.role) ||
    (data.isActive === false && existing.isActive);

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(revokeSessions && { sessionVersion: (existing.sessionVersion ?? 0) + 1 }),
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.middleName !== undefined && { middleName: data.middleName || null }),
      ...(data.email !== undefined && { email: data.email }),
      ...(studentId !== undefined && { studentId }),
      ...(data.courseCode !== undefined && { courseCode: data.courseCode || null }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      role: true,
      courseCode: true,
      mustChangePassword: true,
      isActive: true,
    },
  });
}

export async function deleteUserAsAdmin(params: { userId: string; actor: SessionPayload }) {
  if (params.userId === params.actor.userId) {
    throw clientError("You cannot delete your own active admin account.");
  }
  const existing = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!existing) throw clientError("User not found.", 404);

  if (
    existing.role === "ADMIN" &&
    existing.isActive &&
    (await countOtherActiveAdmins(existing.id)) === 0
  ) {
    throw clientError("This is the last active administrator account; keep at least one.", 409);
  }

  const ownedSections = await prisma.section.count({ where: { teacherId: existing.id } });
  if (ownedSections > 0) {
    throw clientError(
      `This user still owns ${ownedSections} section(s). Reassign those sections to another teacher first.`,
      409
    );
  }

  await prisma.user.delete({ where: { id: existing.id } });
  return { deleted: true };
}

export async function deleteSectionAsAdmin(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true },
  });
  if (!section) throw clientError("Section not found.", 404);
  await prisma.section.delete({ where: { id: section.id } });
  return { deleted: true };
}

/**
 * Saves global settings. The digest schedule is fixed by the Vercel cron in
 * apps/teacher/vercel.json, so the stored value always mirrors that file.
 */
export async function saveSystemSettings(rawBody: unknown) {
  const parsed = systemSettingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw clientError(parsed.error.issues[0]?.message || "Invalid system settings.");
  }
  const data = { ...parsed.data, digestCronSchedule: DIGEST_CRON_SCHEDULE_UTC };
  return prisma.systemSetting.upsert({
    where: { id: "global" },
    update: data,
    create: { id: "global", ...data },
  });
}

/**
 * Admin "create account": every new account gets a random temporary password (shown
 * once, forced change at first sign-in, expires in 7 days). Admins can't pick one.
 */
export async function createUserAsAdmin(rawBody: unknown) {
  const parsed = createUserAdminSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw clientError(parsed.error.issues[0]?.message || "Invalid user payload.");
  }
  const data = parsed.data;

  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    throw clientError(`An account with ${data.email} already exists.`, 409);
  }
  if (data.studentId && (await prisma.user.findUnique({ where: { studentId: data.studentId } }))) {
    throw clientError(`Student ID ${data.studentId} is already assigned.`, 409);
  }

  const user = await prisma.user.create({
    data: {
      role: data.role,
      studentId: data.studentId || null,
      firstName: data.firstName,
      middleName: data.middleName || null,
      lastName: data.lastName,
      courseCode: data.courseCode || null,
      email: data.email,
      passwordHash: null,
      mustChangePassword: true,
      isActive: true,
    },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, studentId: true },
  });
  const issued = await issueTemporaryPassword(user.id);

  if (data.role === "TEACHER" && data.assignSectionIds && data.assignSectionIds.length > 0) {
    await prisma.section.updateMany({
      where: { id: { in: data.assignSectionIds } },
      data: { teacherId: user.id },
    });
  }

  return {
    user,
    temporaryPassword: issued.temporaryPassword,
    temporaryPasswordExpiresAt: issued.expiresAt,
  };
}
