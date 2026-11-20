import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rizlife/shared/db";
import { systemSettingsSchema } from "@rizlife/shared/validation";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await prisma.systemSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = systemSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid system settings." },
      { status: 400 }
    );
  }

  const settings = await prisma.systemSetting.upsert({
    where: { id: "global" },
    update: parsed.data,
    create: { id: "global", ...parsed.data },
  });

  return NextResponse.json({ settings });
}
