export type RoleValue = "STUDENT" | "TEACHER" | "ADMIN";
export type PortalKey = "student" | "teacher" | "admin";
export type QuestCategoryValue =
  | "SELF_PACED"
  | "ON_SITE_LIBRARY"
  | "CREATIVE_OUTPUT"
  | "REFLECTION";

export type SubmissionStatusValue =
  | "NOT_STARTED"
  | "PENDING_REVIEW"
  | "STAMPED"
  | "NEEDS_REVISION";

export interface SessionPayload {
  userId: string;
  email: string;
  role: RoleValue;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  studentId: string | null;
  courseCode: string | null;
  mustChangePassword: boolean;
  portal: PortalKey;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentNumber: string | null;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
  courseCode: string | null;
  stampedCount: number;
  pendingCount: number;
  totalQuests: number;
  completionPct: number;
  achievedAt: string | null;
  cumulativeTimeMs: number;
  speedLabel: string;
}

export interface DigestQuestGroup {
  questId: string;
  taskNumber: number;
  title: string;
  count: number;
  students: {
    submissionId: string;
    studentName: string;
    studentNumber: string | null;
    submittedAt: string | null;
    submissionUrl: string | null;
  }[];
}

export interface DigestQueueSummary {
  sectionId: string;
  sectionCode: string;
  sectionName: string;
  teacherEmail: string;
  teacherName: string;
  digestEnabled: boolean;
  digestThreshold: number;
  lastDigestSentAt: string | null;
  pendingCount: number;
  uniqueStudentCount: number;
  subject: string;
  groups: DigestQuestGroup[];
  htmlPreview: string;
}

export interface StudentImportRow {
  studentId: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  courseCode: string | null;
  email: string;
  password?: string;
}

export interface StudentImportParseResult {
  rows: StudentImportRow[];
  errors: { rowNumber: number; message: string }[];
}

export const QUEST_CATEGORY_LABELS: Record<QuestCategoryValue, string> = {
  SELF_PACED: "Self-Paced",
  ON_SITE_LIBRARY: "On-Site Library",
  CREATIVE_OUTPUT: "Creative Output",
  REFLECTION: "Reflection",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatusValue, string> = {
  NOT_STARTED: "Not Started",
  PENDING_REVIEW: "Pending Review",
  STAMPED: "Stamped",
  NEEDS_REVISION: "Needs Revision",
};
