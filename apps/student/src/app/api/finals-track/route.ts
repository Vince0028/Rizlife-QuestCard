import { NextRequest, NextResponse } from "next/server";
import { requirePasswordChanged } from "@rizlife/shared/portal-auth";
import { z } from "zod";
import {
  chooseStudentFinalsTrack,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getStudentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const studentTrackChoiceSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required.").max(64),
  finalsTrack: z.enum(["SYSTEM", "OPENLEARNING_MODULE"]),
});

export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const passwordGate = requirePasswordChanged(session);
  if (passwordGate) return passwordGate;

  const parsed = studentTrackChoiceSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid track choice." },
      { status: 400 }
    );
  }

  try {
    const finalsTrack = await chooseStudentFinalsTrack({
      studentUserId: session.userId,
      ...parsed.data,
    });
    return NextResponse.json({ success: true, finalsTrack });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
