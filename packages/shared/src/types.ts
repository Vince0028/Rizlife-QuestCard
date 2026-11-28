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

export type FinalsTrackValue = "UNDECIDED" | "SYSTEM" | "OPENLEARNING_MODULE";

export interface PresetOpenLearningModule {
  id: string;
  title: string;
  url: string;
  description?: string;
}

export const PRESET_OPENLEARNING_MODULES: PresetOpenLearningModule[] = [
  {
    id: "jose-app",
    title: "JOSE Gamified App & Mastery Quizzes",
    url: "https://www.openlearning.com/apc/courses/rizlife/task-10-jose-gamified-app",
    description: "Interactive learning modules and mastery quizzes inside JOSE Gamified App",
  },
  {
    id: "rizal-arcade",
    title: "Rizal Arcade Gamified Challenge",
    url: "https://www.openlearning.com/apc/courses/rizlife/task-21-rizal-arcade-gamified-app",
    description: "Rizal Arcade historical scenarios and mastery challenges",
  },
  {
    id: "noli-fili-deepdive",
    title: "Noli Me Tangere & El Filibusterismo Literary Analysis",
    url: "https://www.openlearning.com/apc/courses/rizlife/noli-fili-literary-analysis",
    description: "Comprehensive character and socio-political comparative analysis",
  },
  {
    id: "propaganda-movement",
    title: "The Propaganda Movement & La Solidaridad Press Archives",
    url: "https://www.openlearning.com/apc/courses/rizlife/propaganda-movement-archives",
    description: "Historical archival evaluation of 19th-century reform journalism",
  },
  {
    id: "women-malolos-morga",
    title: "Women of Malolos & Morga's Sucesos Historiography",
    url: "https://www.openlearning.com/apc/courses/rizlife/women-malolos-morga-historiography",
    description: "Critical inquiry into gender empowerment and pre-colonial Philippine history",
  },
];

export const FINALS_TRACK_LABELS: Record<FinalsTrackValue, string> = {
  UNDECIDED: "Undecided / Pending",
  SYSTEM: "Creating a System",
  OPENLEARNING_MODULE: "OpenLearning Module",
};

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
  /** User.sessionVersion when the token was issued (missing on pre-2026-11 tokens = 0). */
  sessionVersion?: number;
  /** How the user signed in. SSO sessions aren't gated by a pending temporary password. */
  authMethod?: "password" | "sso";
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

/** Leaderboard row as exposed to students (GET /api/questcard). */
export type StudentLeaderboardEntry = Pick<
  LeaderboardEntry,
  | "rank"
  | "studentId"
  | "fullName"
  | "courseCode"
  | "stampedCount"
  | "totalQuests"
  | "completionPct"
  | "speedLabel"
>;

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

/**
 * Scheduled digest cron. Must match apps/teacher/vercel.json (checked by `npm run verify`).
 * Vercel cron runs in UTC: 00:00 and 09:00 UTC = 08:00 and 17:00 Philippine time.
 */
export const DIGEST_CRON_SCHEDULE_UTC = "0 0,9 * * *";
export const DIGEST_SCHEDULE_LABEL = "Daily at 08:00 and 17:00 Philippine time";

export interface StudentImportRow {
  /** 1-based row/line in the uploaded file (for error messages). */
  rowNumber: number;
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
