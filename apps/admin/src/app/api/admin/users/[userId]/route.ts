import { NextRequest, NextResponse } from "next/server";
import { deleteUserAsAdmin, updateUserAsAdmin } from "@rizlife/shared/admin-service";
import { toWorkspaceError } from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ userId: string }> };

export async function PATCH(req: NextRequest, context: Context) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await context.params;
  try {
    const user = await updateUserAsAdmin({
      userId,
      rawBody: await req.json().catch(() => ({})),
      actor: session,
    });
    return NextResponse.json({ user });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

export async function DELETE(_req: NextRequest, context: Context) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await context.params;
  try {
    return NextResponse.json(await deleteUserAsAdmin({ userId, actor: session }));
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
