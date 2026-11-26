import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rizlife/shared/db";
import { z } from "zod";
import { getStudentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const studentTrackChoiceSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required."),
  finalsTrack: z.enum(["SYSTEM", "OPENLEARNING_MODULE"]),
});

export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = studentTrackChoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid track choice." },
      { status: 400 }
    );
  }

  // Look up enrollment either by compound unique or direct field matching
  let enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_sectionId: {
        studentId: session.userId,
        sectionId: parsed.data.sectionId,
      },
    },
  });

  if (!enrollment) {
    enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: session.userId,
        sectionId: parsed.data.sectionId,
      },
    });
  }

  if (!enrollment) {
    return NextResponse.json(
      { error: "You are not enrolled in this section." },
      { status: 404 }
    );
  }

  // Update track choice
  const updated = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      finalsTrack: parsed.data.finalsTrack,
      // If student chooses system, clear module fields; if module, keep existing if already assigned
      assignedModuleTitle:
        parsed.data.finalsTrack === "SYSTEM" ? null : enrollment.assignedModuleTitle,
      assignedModuleUrl:
        parsed.data.finalsTrack === "SYSTEM" ? null : enrollment.assignedModuleUrl,
    },
  });

  return NextResponse.json({
    success: true,
    finalsTrack: {
      track: updated.finalsTrack,
      assignedModuleTitle: updated.assignedModuleTitle,
      assignedModuleUrl: updated.assignedModuleUrl,
    },
  });
}
