import { NextRequest, NextResponse } from "next/server";
import { requirePasswordChanged } from "@rizlife/shared/portal-auth";
import {
  resetManagedUserPassword,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const passwordGate = requirePasswordChanged(session);
  if (passwordGate) return passwordGate;
  const { userId } = await context.params;
  try {
    const result = await resetManagedUserPassword({ targetUserId: userId, actor: session });
    return NextResponse.json(result);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
