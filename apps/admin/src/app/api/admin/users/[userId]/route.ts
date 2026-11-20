import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rizlife/shared/db";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    email?: string;
    studentId?: string | null;
    courseCode?: string | null;
    role?: "STUDENT" | "TEACHER" | "ADMIN";
    isActive?: boolean;
  };

  if (userId === session.userId && body.isActive === false) {
    return NextResponse.json(
      { error: "You cannot deactivate your own active admin account." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const normalizedEmail = body.email?.trim().toLowerCase();
  if (normalizedEmail && normalizedEmail !== existingUser.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (emailConflict && emailConflict.id !== userId) {
      return NextResponse.json(
        { error: `Email ${normalizedEmail} is already used by another account.` },
        { status: 409 }
      );
    }
  }

  const normalizedStudentId =
    body.studentId === undefined ? undefined : body.studentId?.trim() || null;
  if (normalizedStudentId && normalizedStudentId !== existingUser.studentId) {
    const idConflict = await prisma.user.findUnique({
      where: { studentId: normalizedStudentId },
    });
    if (idConflict && idConflict.id !== userId) {
      return NextResponse.json(
        { error: `Student ID ${normalizedStudentId} is already assigned.` },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.firstName !== undefined && { firstName: body.firstName.trim() }),
      ...(body.lastName !== undefined && { lastName: body.lastName.trim() }),
      ...(body.middleName !== undefined && {
        middleName: body.middleName?.trim() || null,
      }),
      ...(normalizedEmail !== undefined && { email: normalizedEmail }),
      ...(normalizedStudentId !== undefined && { studentId: normalizedStudentId }),
      ...(body.courseCode !== undefined && {
        courseCode: body.courseCode?.trim() || null,
      }),
      ...(body.role !== undefined && { role: body.role }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await context.params;
  if (userId === session.userId) {
    return NextResponse.json(
      { error: "You cannot delete your own active admin account." },
      { status: 400 }
    );
  }

  const ownedSections = await prisma.section.count({
    where: { teacherId: userId },
  });
  if (ownedSections > 0) {
    return NextResponse.json(
      {
        error: `This user still owns ${ownedSections} section(s). Reassign those sections to another teacher first.`,
      },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ deleted: true });
}
