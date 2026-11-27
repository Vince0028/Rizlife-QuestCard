import { NextRequest, NextResponse } from "next/server";
import { deleteSectionAsAdmin } from "@rizlife/shared/admin-service";
import { toWorkspaceError } from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await context.params;
  try {
    return NextResponse.json(await deleteSectionAsAdmin(sectionId));
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
