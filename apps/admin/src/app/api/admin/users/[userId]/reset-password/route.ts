import { NextRequest, NextResponse } from "next/server";
import {
  resetManagedUserPassword,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await context.params;
  try {
    const body = (await req.json().catch(() => ({}))) as { newPassword?: string };
    const result = await resetManagedUserPassword({
      targetUserId: userId,
      newPassword: body.newPassword || "",
      actor: session,
    });
    return NextResponse.json(result);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
