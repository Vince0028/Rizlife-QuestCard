import { NextRequest, NextResponse } from "next/server";
import {
  reorderManagedQuest,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ questId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { questId } = await context.params;
  try {
    const body = (await req.json().catch(() => ({}))) as { direction?: string };
    const direction = body.direction === "DOWN" ? "DOWN" : "UP";
    const res = await reorderManagedQuest(questId, direction, session);
    return NextResponse.json(res);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
