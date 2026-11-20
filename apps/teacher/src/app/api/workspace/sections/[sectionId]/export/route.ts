import { NextRequest, NextResponse } from "next/server";
import {
  exportSectionTrackerFile,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getTeacherSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sectionId: string }> }
) {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await context.params;
  const formatParam = req.nextUrl.searchParams.get("format");
  const format = formatParam === "csv" ? "csv" : "xlsx";

  try {
    const file = await exportSectionTrackerFile({
      sectionId,
      format,
      user: session,
    });
    return new NextResponse(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
