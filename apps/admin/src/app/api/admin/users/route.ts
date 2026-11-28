import { NextRequest, NextResponse } from "next/server";
import { requirePasswordChanged } from "@rizlife/shared/portal-auth";
import { createUserAsAdmin } from "@rizlife/shared/admin-service";
import { toWorkspaceError } from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const passwordGate = requirePasswordChanged(session);
  if (passwordGate) return passwordGate;
  try {
    const result = await createUserAsAdmin(await req.json().catch(() => ({})));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
