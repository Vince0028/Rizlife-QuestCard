/** Data shapes for the admin console (mirrors GET /api/admin/overview). */
import type { WorkspaceSectionOption } from "@rizlife/shared/ui";
import type { RoleValue } from "@rizlife/shared/types";

export interface AdminUserRow {
  id: string;
  studentId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  role: RoleValue;
  courseCode: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  _count: { taughtSections: number; enrollments: number };
}

export interface AdminSectionRow extends WorkspaceSectionOption {
  leaderboardVisible: boolean;
  digestThreshold: number;
  digestEnabled: boolean;
}

export interface AdminOverviewResponse {
  metrics: {
    totalStudents: number;
    totalTeachers: number;
    totalAdmins: number;
    totalSections: number;
    totalQuests: number;
    stampedSubmissions: number;
    pendingSubmissions: number;
    digestsSent: number;
  };
  users: AdminUserRow[];
  sections: AdminSectionRow[];
  recentDigests: {
    id: string;
    sectionCode: string;
    teacherName: string;
    recipientEmail: string;
    submissionCount: number;
    triggerType: string;
    deliveryStatus: string;
    sentAt: string;
  }[];
  settings: {
    activeTerm: string;
    defaultDigestThreshold: number;
    digestCronSchedule: string;
    emailProvider: "preview" | "resend" | "smtp";
    emailFromAddress: string;
    allowedStudentDomain: string;
    allowedStaffDomain: string;
    microsoftSsoEnabled: boolean;
  };
  envStatus: {
    microsoftSsoConfigured: boolean;
    resendConfigured: boolean;
    smtpConfigured: boolean;
  };
}

export type AdminTab = "overview" | "users" | "sections" | "settings" | "override";
