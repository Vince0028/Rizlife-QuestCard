import { NextRequest, NextResponse } from "next/server";
import {
  deleteManagedQuest,
  toWorkspaceError,
  updateManagedQuest,
} from "@rizlife/shared/workspace-service";
import { getTeacherSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ questId: string }> }
) {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { questId } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));
    const quest = await updateManagedQuest(questId, body, session);
    return NextResponse.json({ quest });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ questId: string }> }
) {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { questId } = await context.params;
  try {
    const res = await deleteManagedQuest(questId, session);
    return NextResponse.json(res);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
