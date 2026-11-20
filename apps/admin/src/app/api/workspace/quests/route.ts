import { NextRequest, NextResponse } from "next/server";
import {
  createManagedQuest,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const quest = await createManagedQuest(body, session);
    return NextResponse.json({ quest }, { status: 201 });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
