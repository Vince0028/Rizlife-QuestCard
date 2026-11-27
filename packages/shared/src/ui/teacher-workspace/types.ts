/** Data shapes for the teacher/admin workspace UI (mirrors GET /api/workspace/sections/[id]). */
import type { DigestQueueSummary, FinalsTrackValue, LeaderboardEntry, QuestCategoryValue, SubmissionStatusValue } from "../../types";

export interface WorkspaceSectionOption {
  id: string;
  code: string;
  name: string;
  term: string;
  teacherId: string | null;
  teacher?: { firstName: string; lastName: string; email: string } | null;
  _count?: { enrollments: number; quests: number };
}

export interface WorkspaceQuestItem {
  id: string;
  sectionId: string;
  taskNumber: number;
  title: string;
  description: string;
  category: QuestCategoryValue;
  openlearningUrl: string | null;
  startDate: string | null;
  deadline: string | null;
}

export interface WorkspaceStudentItem {
  id: string;
  studentId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  courseCode: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  finalsTrack?: FinalsTrackValue;
  assignedModuleTitle?: string | null;
  assignedModuleUrl?: string | null;
}

export interface WorkspaceSubmissionItem {
  id: string;
  questId: string;
  studentId: string;
  submissionUrl: string | null;
  studentNote: string | null;
  status: SubmissionStatusValue;
  teacherFeedback: string | null;
  firstSubmittedAt: string | null;
  submittedAt: string | null;
  stampedAt: string | null;
  stampedByName?: string | null;
  includedInDigest: boolean;
  quest: { id: string; taskNumber: number; title: string };
  student: {
    id: string;
    studentId: string | null;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    courseCode: string | null;
    email: string;
  };
}

export interface WorkspaceDigestLog {
  id: string;
  recipientEmail: string;
  subject: string;
  submissionCount: number;
  triggerType: string;
  deliveryStatus: string;
  errorMessage: string | null;
  sentAt: string;
}

export interface WorkspacePayload {
  section: {
    id: string;
    code: string;
    name: string;
    term: string;
    teacherId: string | null;
    teacherName: string;
    teacherEmail: string;
    leaderboardVisible: boolean;
    digestThreshold: number;
    digestEnabled: boolean;
    lastDigestSentAt: string | null;
  };
  quests: WorkspaceQuestItem[];
  students: WorkspaceStudentItem[];
  submissions: WorkspaceSubmissionItem[];
  leaderboard: LeaderboardEntry[];
  digestQueue: DigestQueueSummary | null;
  digestLogs: WorkspaceDigestLog[];
}

export type WorkspaceTab =
  | "queue"
  | "stampcard"
  | "tracker"
  | "quests"
  | "leaderboard"
  | "digest"
  | "roster";

export interface WorkspaceSummaryStats {
  sectionCode: string;
  studentsCount: number;
  questsCount: number;
  pendingCount: number;
  digestPendingCount: number;
  digestThreshold: number;
}
