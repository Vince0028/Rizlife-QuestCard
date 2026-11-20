import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rizlife/shared/db";
import { generateDefaultPassword, hashPassword } from "@rizlife/shared/password";
import { createUserAdminSchema } from "@rizlife/shared/validation";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createUserAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid user payload." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return NextResponse.json(
      { error: `An account with ${data.email} already exists.` },
      { status: 409 }
    );
  }

  if (data.studentId) {
    const existingId = await prisma.user.findUnique({
      where: { studentId: data.studentId },
    });
    if (existingId) {
      return NextResponse.json(
        { error: `Student ID ${data.studentId} is already assigned.` },
        { status: 409 }
      );
    }
  }

  const rawPassword = data.password || generateDefaultPassword(data.studentId);
  const passwordHash = await hashPassword(rawPassword);

  const user = await prisma.user.create({
    data: {
      role: data.role,
      studentId: data.studentId || null,
      firstName: data.firstName,
      middleName: data.middleName || null,
      lastName: data.lastName,
      courseCode: data.courseCode || null,
      email: data.email,
      passwordHash,
      mustChangePassword: data.mustChangePassword ?? true,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      studentId: true,
    },
  });

  if (data.role === "TEACHER" && data.assignSectionIds && data.assignSectionIds.length > 0) {
    await prisma.section.updateMany({
      where: { id: { in: data.assignSectionIds } },
      data: { teacherId: user.id },
    });
  }

  return NextResponse.json({ user, temporaryPassword: rawPassword }, { status: 201 });
}
