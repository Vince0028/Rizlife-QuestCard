/**
 * M4: server-side timestamps (leaderboard milestones, Excel exports) are Asia/Manila
 * even when the host runs in UTC, as Vercel does. M3: the student-facing leaderboard
 * carries no classmate student numbers or internal fields.
 */
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { computeLeaderboard, formatSpeedTimestamp, toStudentLeaderboardEntry } from "../leaderboard";
import { generateTrackerWorkbook } from "../excel";

// 2026-11-10 08:00 UTC = 2026-11-10 16:00 Manila; 2026-11-27 16:30 UTC = Nov 28, 00:30 Manila.
const STAMP = "2026-11-10T08:00:00.000Z";
const LATE_DEADLINE = "2026-11-27T16:30:00.000Z";

async function withServerTimezone<T>(tz: string, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.TZ;
  process.env.TZ = tz; // Node re-reads TZ on assignment
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
}

export async function runTimezoneAndPrivacyChecks() {
  for (const tz of ["UTC", "America/Los_Angeles"]) {
    await withServerTimezone(tz, async () => {
      assert.equal(new Date(STAMP).getHours(), tz === "UTC" ? 8 : 0, `TZ=${tz} is in effect`);

      // Leaderboard milestone label
      const label = formatSpeedTimestamp(STAMP).replace(/\s/g, " ");
      assert.match(label, /Nov 10, 04:00 PM/i, `leaderboard in Manila time under TZ=${tz}: ${label}`);

      // Excel: Quest Legend dates + Timestamps Log
      const buffer = await generateTrackerWorkbook({
        sectionCode: "TZ1",
        sectionName: "Timezone",
        term: "T",
        quests: [
          {
            id: "q1", taskNumber: 1, title: "Late quest", category: "SELF_PACED",
            openlearningUrl: null, startDate: STAMP, deadline: LATE_DEADLINE,
          },
        ],
        students: [
          {
            id: "s1", studentId: "2099-000001", firstName: "Juan", middleName: null,
            lastName: "Dela Cruz", courseCode: "BSIT", email: "jdelacruz@student.apc.edu.ph",
          },
        ],
        submissions: [
          {
            questId: "q1", studentId: "s1", status: "STAMPED", submissionUrl: "https://example.com",
            firstSubmittedAt: new Date(STAMP), submittedAt: new Date(STAMP), stampedAt: new Date(STAMP),
          },
        ],
      });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      const legendRow = wb.worksheets[1].getRow(2);
      const legend = (legendRow.values as unknown[]).map(String).join(" | ");
      assert.ok(legend.includes("11/10/2026"), `start date in Manila: ${legend}`);
      assert.ok(legend.includes("11/28/2026"), `deadline at 00:30 Manila is the 28th, not the 27th: ${legend}`);
      const logRow = wb.getWorksheet("Timestamps Log")!.getRow(2);
      const firstRequested = String(logRow.getCell(1).value).replace(/\s/g, " ");
      assert.match(firstRequested, /11\/10\/2026, 4:00:00 PM/i, `timestamps log in Manila: ${firstRequested}`);
    });
  }

  // M3: student-facing leaderboard rows
  const [entry] = computeLeaderboard(
    [{ id: "u1", studentId: "2099-000001", firstName: "Juan", middleName: "Reyes", lastName: "Dela Cruz", courseCode: "BSIT" }],
    [{ studentId: "u1", questId: "q1", status: "STAMPED", firstSubmittedAt: STAMP, submittedAt: STAMP, stampedAt: STAMP }],
    3
  ).map(toStudentLeaderboardEntry);
  assert.deepEqual(Object.keys(entry).sort(), [
    "completionPct", "courseCode", "fullName", "rank", "speedLabel", "stampedCount", "studentId", "totalQuests",
  ]);
  assert.equal(entry.fullName, "Dela Cruz, Juan", "no middle name in the student view");
  assert.ok(!JSON.stringify(entry).includes("2099-000001"), "no student number anywhere in the row");
  assert.equal(entry.studentId, "u1", "internal user id kept for the YOU highlight");
}
