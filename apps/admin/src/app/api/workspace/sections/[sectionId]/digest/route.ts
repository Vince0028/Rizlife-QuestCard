import { NextRequest, NextResponse } from "next/server";
import {
  toWorkspaceError,
  triggerManualSectionDigest,
} from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await context.params;
  try {
    const result = await triggerManualSectionDigest(sectionId, session);
    return NextResponse.json(result);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
