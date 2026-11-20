import { NextResponse } from "next/server";
import { generateStudentImportCsvTemplate } from "@rizlife/shared/excel";

export async function GET() {
  const csv = generateStudentImportCsvTemplate();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rizlife_student_import_template.csv"',
    },
  });
}
