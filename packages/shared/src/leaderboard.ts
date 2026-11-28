import { formatManilaDateTime } from "./deadline";
import type {
  LeaderboardEntry,
  StudentLeaderboardEntry,
  SubmissionStatusValue,
} from "./types";

export interface LeaderboardStudentInput {
  id: string;
  studentId: string | null;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  courseCode: string | null;
}

export interface LeaderboardSubmissionInput {
  studentId: string;
  questId: string;
  status: SubmissionStatusValue;
  firstSubmittedAt: Date | string | null;
  submittedAt: Date | string | null;
  stampedAt: Date | string | null;
}

function toMs(val: Date | string | null | undefined): number | null {
  if (!val) return null;
  const d = typeof val === "string" ? new Date(val) : val;
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/** Milestone time in Asia/Manila (never the server's timezone), e.g. "Nov 10, 04:00 PM". */
export function formatSpeedTimestamp(iso: string | null): string {
  return (
    formatManilaDateTime(iso, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) || "No stamps yet"
  );
}

/**
 * What a student may see about classmates: no student numbers, middle names, pending
 * counts or internal tie-break values. `studentId` is the internal user id (the UI uses
 * it to highlight "YOU"), not the school-issued student number.
 */
export function toStudentLeaderboardEntry(entry: LeaderboardEntry): StudentLeaderboardEntry {
  return {
    rank: entry.rank,
    studentId: entry.studentId,
    fullName: `${entry.lastName}, ${entry.firstName}`,
    courseCode: entry.courseCode,
    stampedCount: entry.stampedCount,
    totalQuests: entry.totalQuests,
    completionPct: entry.completionPct,
    speedLabel: entry.speedLabel,
  };
}

/**
 * Ranks students by:
 * 1. Total Stamped Quests (descending)
 * 2. Earliest timestamp at which they reached their stamped count (`achievedAt` ascending)
 *    — students with 0 stamps always trail after stamped students
 * 3. Cumulative submission timestamps (ascending)
 * 4. Last name, then first name (ascending)
 */
export function computeLeaderboard(
  students: LeaderboardStudentInput[],
  submissions: LeaderboardSubmissionInput[],
  totalQuests: number
): LeaderboardEntry[] {
  const byStudent = new Map<string, LeaderboardSubmissionInput[]>();
  for (const sub of submissions) {
    const arr = byStudent.get(sub.studentId) ?? [];
    arr.push(sub);
    byStudent.set(sub.studentId, arr);
  }

  const rows: Omit<LeaderboardEntry, "rank">[] = students.map((student) => {
    const subs = byStudent.get(student.id) ?? [];
    const stamped = subs.filter((s) => s.status === "STAMPED");
    const pendingCount = subs.filter((s) => s.status === "PENDING_REVIEW").length;

    let maxAchievedMs: number | null = null;
    let cumulativeTimeMs = 0;

    for (const s of stamped) {
      const ts =
        toMs(s.firstSubmittedAt) ?? toMs(s.submittedAt) ?? toMs(s.stampedAt);
      if (ts !== null) {
        cumulativeTimeMs += ts;
        if (maxAchievedMs === null || ts > maxAchievedMs) {
          maxAchievedMs = ts;
        }
      }
    }

    const achievedAt =
      maxAchievedMs !== null ? new Date(maxAchievedMs).toISOString() : null;
    const stampedCount = stamped.length;
    const completionPct =
      totalQuests > 0 ? Math.round((stampedCount / totalQuests) * 100) : 0;

    return {
      studentId: student.id,
      studentNumber: student.studentId,
      firstName: student.firstName,
      middleName: student.middleName ?? null,
      lastName: student.lastName,
      fullName: `${student.lastName}, ${student.firstName}${
        student.middleName ? ` ${student.middleName}` : ""
      }`,
      courseCode: student.courseCode,
      stampedCount,
      pendingCount,
      totalQuests,
      completionPct,
      achievedAt,
      cumulativeTimeMs,
      speedLabel:
        stampedCount > 0 ? formatSpeedTimestamp(achievedAt) : "Awaiting first stamp",
    };
  });

  rows.sort((a, b) => {
    if (b.stampedCount !== a.stampedCount) {
      return b.stampedCount - a.stampedCount;
    }

    const aTime = a.achievedAt ? new Date(a.achievedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.achievedAt ? new Date(b.achievedAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) {
      return aTime - bTime;
    }

    if (a.cumulativeTimeMs !== b.cumulativeTimeMs) {
      return a.cumulativeTimeMs - b.cumulativeTimeMs;
    }

    const lastCmp = a.lastName.localeCompare(b.lastName);
    if (lastCmp !== 0) return lastCmp;
    return a.firstName.localeCompare(b.firstName);
  });

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
