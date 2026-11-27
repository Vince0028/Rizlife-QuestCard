/** Data shapes for the student dashboard (mirrors GET /api/questcard). */
import type {
  FinalsTrackValue,
  LeaderboardEntry,
  QuestCategoryValue,
  SessionPayload,
  SubmissionStatusValue,
} from "@rizlife/shared/types";

export interface StudentSection {
  id: string;
  code: string;
  name: string;
  term: string;
  leaderboardVisible: boolean;
  teacherName: string;
  teacherEmail: string;
}

export interface StudentQuest {
  id: string;
  taskNumber: number;
  title: string;
  description: string;
  category: QuestCategoryValue;
  openlearningUrl: string | null;
  startDate: string | null;
  deadline: string | null;
}

export interface StudentSubmission {
  id: string;
  questId: string;
  submissionUrl: string | null;
  studentNote: string | null;
  status: SubmissionStatusValue;
  teacherFeedback: string | null;
  submittedAt: string | null;
  stampedAt: string | null;
}

export interface QuestCardApiResponse {
  student: SessionPayload;
  sections: StudentSection[];
  activeSection: StudentSection | null;
  finalsTrack?: {
    track: FinalsTrackValue;
    assignedModuleTitle: string | null;
    assignedModuleUrl: string | null;
  } | null;
  quests: StudentQuest[];
  submissions: StudentSubmission[];
  leaderboard: {
    visible: boolean;
    entries: LeaderboardEntry[];
  };
}

export type ListFilter = "ALL" | SubmissionStatusValue | "OVERDUE" | "DUE_SOON";
