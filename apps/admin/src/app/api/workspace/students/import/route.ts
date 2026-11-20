import { NextRequest, NextResponse } from "next/server";
import {
  bulkImportStudentsForSection,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const sectionId = String(form.get("sectionId") || "");
    const defaultPassword = String(form.get("defaultPassword") || "").trim() || undefined;
    const file = form.get("file");

    if (!sectionId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Section ID and CSV/XLSX file are required." },
        { status: 400 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const result = await bulkImportStudentsForSection({
      sectionId,
      fileBuffer: Buffer.from(arrayBuf),
      filename: file.name,
      fallbackPassword: defaultPassword,
      user: session,
    });

    return NextResponse.json(result);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
