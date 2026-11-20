import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rizlife/shared/db";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await context.params;
  await prisma.section.delete({ where: { id: sectionId } });
  return NextResponse.json({ deleted: true });
}
