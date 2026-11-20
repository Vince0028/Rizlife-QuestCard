import { NextRequest, NextResponse } from "next/server";
import {
  deleteManagedSection,
  getSectionWorkspaceData,
  toWorkspaceError,
  updateManagedSection,
} from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await context.params;
  try {
    const data = await getSectionWorkspaceData(sectionId, session);
    return NextResponse.json(data);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));
    const section = await updateManagedSection(sectionId, body, session);
    return NextResponse.json({ section });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await context.params;
  try {
    const res = await deleteManagedSection(sectionId, session);
    return NextResponse.json(res);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
