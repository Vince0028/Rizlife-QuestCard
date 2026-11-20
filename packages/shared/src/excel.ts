import ExcelJS from "exceljs";
import type {
  StudentImportParseResult,
  StudentImportRow,
  SubmissionStatusValue,
} from "./types";

export interface TrackerExportQuest {
  id: string;
  taskNumber: number;
  title: string;
  category: string;
  openlearningUrl: string | null;
  startDate: Date | string | null;
  deadline: Date | string | null;
}

export interface TrackerExportStudent {
  id: string;
  studentId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  courseCode: string | null;
  email: string;
}

export interface TrackerExportSubmission {
  questId: string;
  studentId: string;
  status: SubmissionStatusValue;
  submissionUrl: string | null;
  firstSubmittedAt?: Date | string | null;
  submittedAt: Date | string | null;
  stampedAt: Date | string | null;
}

export async function generateTrackerWorkbook(params: {
  sectionCode: string;
  sectionName: string;
  term: string;
  quests: TrackerExportQuest[];
  students: TrackerExportStudent[];
  submissions: TrackerExportSubmission[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RizLife QuestCard Management System";
  workbook.created = new Date();

  const sortedQuests = [...params.quests].sort(
    (a, b) => a.taskNumber - b.taskNumber
  );
  const sortedStudents = [...params.students].sort((a, b) =>
    a.lastName.localeCompare(b.lastName)
  );

  const subMap = new Map<string, TrackerExportSubmission>();
  for (const s of params.submissions) {
    subMap.set(`${s.studentId}:${s.questId}`, s);
  }

  const sheetName = `${params.sectionCode}_Task Tracker`.slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName);

  // Title banner
  const totalCols = 7 + sortedQuests.length;
  sheet.mergeCells(1, 1, 1, Math.max(totalCols, 7));
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `APC RizLife QuestCard Master Tracker - ${params.sectionCode} (${params.term})`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFAF7F2" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2C2520" },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 28;

  const headers = [
    "Student ID",
    "Last Name",
    "First Name",
    "Middle Name",
    "Course Code",
    "APC Email",
    "Progress",
    ...sortedQuests.map((q) => `T${q.taskNumber}: ${q.title}`),
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FF2C2520" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8DEC8" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD8CBB8" } },
      bottom: { style: "medium", color: { argb: "FFC5A880" } },
      left: { style: "thin", color: { argb: "FFD8CBB8" } },
      right: { style: "thin", color: { argb: "FFD8CBB8" } },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  for (const student of sortedStudents) {
    let stampedCount = 0;
    for (const q of sortedQuests) {
      const sub = subMap.get(`${student.id}:${q.id}`);
      if (sub?.status === "STAMPED") stampedCount += 1;
    }

    const rowValues: (string | { text: string; hyperlink: string })[] = [
      student.studentId ?? "-",
      student.lastName,
      student.firstName,
      student.middleName ?? "",
      student.courseCode ?? "-",
      student.email,
      `${stampedCount} / ${sortedQuests.length}`,
    ];

    const row = sheet.addRow(rowValues);
    row.height = 22;

    sortedQuests.forEach((q, idx) => {
      const colIndex = 8 + idx;
      const cell = row.getCell(colIndex);
      const sub = subMap.get(`${student.id}:${q.id}`);
      const status = sub?.status ?? "NOT_STARTED";

      if (status === "STAMPED") {
        cell.value = sub?.submissionUrl
          ? { text: "STAMPED", hyperlink: sub.submissionUrl }
          : "STAMPED";
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDCFCE7" },
        };
        cell.font = { bold: true, color: { argb: "FF15803D" } };
      } else if (status === "PENDING_REVIEW") {
        cell.value = sub?.submissionUrl
          ? { text: "PENDING REVIEW", hyperlink: sub.submissionUrl }
          : "PENDING REVIEW";
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" },
        };
        cell.font = { bold: true, color: { argb: "FFB45309" } };
      } else if (status === "NEEDS_REVISION") {
        cell.value = sub?.submissionUrl
          ? { text: "REVISION", hyperlink: sub.submissionUrl }
          : "REVISION";
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEE2E2" },
        };
        cell.font = { bold: true, color: { argb: "FFB91C1C" } };
      } else {
        cell.value = "NOT STARTED";
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF3F4F6" },
        };
        cell.font = { color: { argb: "FF6B7280" } };
      }

      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  }

  sheet.columns.forEach((col, i) => {
    if (i === 0) col.width = 15;
    else if (i === 1 || i === 2 || i === 3) col.width = 16;
    else if (i === 4) col.width = 13;
    else if (i === 5) col.width = 28;
    else if (i === 6) col.width = 12;
    else col.width = 19;
  });

  sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 2 }];

  // Sheet 2: Quest Legend
  const legendSheet = workbook.addWorksheet("Quest Legend");
  legendSheet.addRow([
    "Task #",
    "Title",
    "Category",
    "Start Date",
    "Deadline",
    "OpenLearning Reference URL",
  ]);
  legendSheet.getRow(1).font = { bold: true };
  for (const q of sortedQuests) {
    legendSheet.addRow([
      q.taskNumber,
      q.title,
      q.category,
      q.startDate ? new Date(q.startDate).toLocaleDateString("en-PH") : "",
      q.deadline ? new Date(q.deadline).toLocaleDateString("en-PH") : "",
      q.openlearningUrl ?? "",
    ]);
  }
  legendSheet.columns.forEach((col, i) => {
    col.width = i === 1 ? 34 : i === 5 ? 45 : 18;
  });

  // Sheet 3: Chronological Timestamps Log (Who requested first & who checked first)
  const tsSheet = workbook.addWorksheet("Timestamps Log");
  tsSheet.addRow([
    "First Requested At",
    "Last Requested At",
    "Checked & Stamped At",
    "Student ID",
    "Student Name",
    "Task #",
    "Quest Title",
    "Status",
    "OpenLearning URL",
  ]);
  tsSheet.getRow(1).font = { bold: true };
  tsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8DEC8" },
  };

  const studentById = new Map(params.students.map((s) => [s.id, s]));
  const questById = new Map(params.quests.map((q) => [q.id, q]));

  const fmtTs = (v: Date | string | null | undefined) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-PH");
  };

  const trackedSubs = params.submissions
    .filter(
      (s) =>
        s.status !== "NOT_STARTED" ||
        s.firstSubmittedAt ||
        s.submittedAt ||
        s.stampedAt
    )
    .sort((a, b) => {
      const aTime = new Date(
        a.firstSubmittedAt ?? a.submittedAt ?? a.stampedAt ?? 0
      ).getTime();
      const bTime = new Date(
        b.firstSubmittedAt ?? b.submittedAt ?? b.stampedAt ?? 0
      ).getTime();
      return aTime - bTime;
    });

  for (const sub of trackedSubs) {
    const st = studentById.get(sub.studentId);
    const q = questById.get(sub.questId);
    if (!st || !q) continue;
    tsSheet.addRow([
      fmtTs(sub.firstSubmittedAt ?? sub.submittedAt),
      fmtTs(sub.submittedAt),
      fmtTs(sub.stampedAt),
      st.studentId ?? "",
      `${st.lastName}, ${st.firstName}`,
      q.taskNumber,
      q.title,
      sub.status,
      sub.submissionUrl ?? "",
    ]);
  }
  tsSheet.columns.forEach((col, i) => {
    col.width = i <= 2 ? 22 : i === 4 ? 24 : i === 6 ? 28 : i === 8 ? 44 : 15;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function escapeCsvCell(val: string): string {
  const safe = val.replace(/"/g, '""');
  return /[",\n\r]/.test(safe) ? `"${safe}"` : safe;
}

export function generateTrackerCsv(params: {
  quests: TrackerExportQuest[];
  students: TrackerExportStudent[];
  submissions: TrackerExportSubmission[];
}): string {
  const sortedQuests = [...params.quests].sort(
    (a, b) => a.taskNumber - b.taskNumber
  );
  const sortedStudents = [...params.students].sort((a, b) =>
    a.lastName.localeCompare(b.lastName)
  );
  const subMap = new Map<string, TrackerExportSubmission>();
  for (const s of params.submissions) {
    subMap.set(`${s.studentId}:${s.questId}`, s);
  }

  const header = [
    "Student ID",
    "Last Name",
    "First Name",
    "Middle Name",
    "Course Code",
    "APC Email",
    "Progress",
    ...sortedQuests.flatMap((q) => [
      `Task ${q.taskNumber} Status`,
      `Task ${q.taskNumber} Link`,
    ]),
  ];

  const lines: string[] = [header.map(escapeCsvCell).join(",")];

  for (const student of sortedStudents) {
    let stampedCount = 0;
    for (const q of sortedQuests) {
      if (subMap.get(`${student.id}:${q.id}`)?.status === "STAMPED") {
        stampedCount += 1;
      }
    }

    const row = [
      student.studentId ?? "",
      student.lastName,
      student.firstName,
      student.middleName ?? "",
      student.courseCode ?? "",
      student.email,
      `${stampedCount}/${sortedQuests.length}`,
      ...sortedQuests.flatMap((q) => {
        const sub = subMap.get(`${student.id}:${q.id}`);
        return [sub?.status ?? "NOT_STARTED", sub?.submissionUrl ?? ""];
      }),
    ];
    lines.push(row.map(escapeCsvCell).join(","));
  }

  return lines.join("\r\n");
}

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(current.trim());
        if (row.some((c) => c.length > 0)) rows.push(row);
        row = [];
        current = "";
        i += 1;
      } else if (ch === "\n" || ch === "\r") {
        row.push(current.trim());
        if (row.some((c) => c.length > 0)) rows.push(row);
        row = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellToString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val).trim();
  }
  if (typeof val === "object") {
    if ("text" in val && typeof val.text === "string") return val.text.trim();
    if ("result" in val && val.result !== undefined) return String(val.result).trim();
  }
  return String(val).trim();
}

export async function parseStudentImportFile(
  buffer: Buffer,
  filename: string
): Promise<StudentImportParseResult> {
  let matrix: string[][] = [];

  if (filename.toLowerCase().endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = wb.worksheets[0];
    if (!sheet) {
      return {
        rows: [],
        errors: [{ rowNumber: 1, message: "Excel workbook has no worksheets." }],
      };
    }
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = cellToString(cell.value);
      });
      if (cells.some((c) => c.length > 0)) {
        matrix.push(cells);
      }
    });
  } else {
    matrix = parseCsvLines(buffer.toString("utf-8"));
  }

  if (matrix.length < 2) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message: "File must contain a header row and at least one student row.",
        },
      ],
    };
  }

  const headers = matrix[0].map(normalizeHeader);
  const idx = {
    studentId: headers.findIndex((h) =>
      ["studentid", "id", "studentnumber", "idnumber"].includes(h)
    ),
    lastName: headers.findIndex((h) => ["lastname", "surname", "lname"].includes(h)),
    firstName: headers.findIndex((h) =>
      ["firstname", "givenname", "fname"].includes(h)
    ),
    middleName: headers.findIndex((h) =>
      ["middlename", "mname", "mi"].includes(h)
    ),
    courseCode: headers.findIndex((h) =>
      ["coursecode", "course", "program"].includes(h)
    ),
    email: headers.findIndex((h) =>
      ["email", "apcemail", "studentemail", "microsoftemail"].includes(h)
    ),
    password: headers.findIndex((h) =>
      ["password", "defaultpassword"].includes(h)
    ),
  };

  if (idx.studentId === -1 || idx.lastName === -1 || idx.firstName === -1 || idx.email === -1) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message:
            "Missing required columns. Expected headers: Student ID, Last Name, First Name, APC Email (optional: Middle Name, Course Code, Password).",
        },
      ],
    };
  }

  const rows: StudentImportRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const rowNumber = r + 1;
    const studentId = (line[idx.studentId] ?? "").trim();
    const lastName = (line[idx.lastName] ?? "").trim();
    const firstName = (line[idx.firstName] ?? "").trim();
    const middleName =
      idx.middleName >= 0 ? (line[idx.middleName] ?? "").trim() || null : null;
    const courseCode =
      idx.courseCode >= 0 ? (line[idx.courseCode] ?? "").trim() || null : null;
    const email = (line[idx.email] ?? "").trim().toLowerCase();
    const password =
      idx.password >= 0 ? (line[idx.password] ?? "").trim() || undefined : undefined;

    if (!studentId || !lastName || !firstName || !email) {
      errors.push({
        rowNumber,
        message: "Missing Student ID, Last Name, First Name, or Email.",
      });
      continue;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ rowNumber, message: `Invalid email address: ${email}` });
      continue;
    }

    rows.push({
      studentId,
      lastName,
      firstName,
      middleName,
      courseCode,
      email,
      password,
    });
  }

  return { rows, errors };
}

export function generateStudentImportCsvTemplate(): string {
  return [
    "Student ID,Last Name,First Name,Middle Name,Course Code,APC Email,Default Password",
    "2024-140201,Bautista,Rafael,Cruz,BSIT,rbautista@student.apc.edu.ph,Student@2026",
    "2024-140202,Villanueva,Sofia,Reyes,BSIT-MI,svillanueva@student.apc.edu.ph,Student@2026",
  ].join("\r\n");
}
