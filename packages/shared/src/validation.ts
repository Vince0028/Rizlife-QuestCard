import { z } from "zod";

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl: string | null;
  isOpenLearningUrl: boolean;
  sourceLabel: string;
  hint: string | null;
  error: string | null;
}

export function validateSubmissionUrl(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: null,
      isOpenLearningUrl: false,
      sourceLabel: "Invalid",
      hint: null,
      error: "Please paste a valid submission URL before notifying your teacher.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: null,
      isOpenLearningUrl: false,
      sourceLabel: "Invalid",
      hint: null,
      error: "URL must start with https:// or http:// (e.g. https://www.openlearning.com/...).",
    };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      valid: false,
      normalizedUrl: null,
      isOpenLearningUrl: false,
      sourceLabel: "Invalid",
      hint: null,
      error: "Only http:// or https:// links are allowed.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isOpenLearningUrl =
    host === "openlearning.com" || host.endsWith(".openlearning.com");

  let sourceLabel = "External Output Link";
  let hint: string | null =
    "External link detected. Ensure viewing permissions are open to your APC instructor, or paste your direct OpenLearning permalink.";

  if (isOpenLearningUrl) {
    sourceLabel = "OpenLearning Permalink";
    hint = null;
  } else if (host.includes("canva.com")) {
    sourceLabel = "Canva Link";
  } else if (host.includes("drive.google.com") || host.includes("docs.google.com")) {
    sourceLabel = "Google Drive / Docs";
  } else if (host.includes("youtube.com") || host.includes("youtu.be")) {
    sourceLabel = "YouTube Video";
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    isOpenLearningUrl,
    sourceLabel,
    hint,
    error: null,
  };
}

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid APC email address.").toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional().default(""),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters long.")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmPassword"],
  });

export const submitQuestSchema = z.object({
  questId: z.string().min(1),
  submissionUrl: z.string().trim().min(1, "Submission URL is required."),
  studentNote: z.string().max(1000).optional().nullable(),
});

export const reviewSubmissionSchema = z.object({
  submissionId: z.string().optional(),
  questId: z.string().min(1),
  studentId: z.string().min(1),
  action: z.enum(["STAMP", "NEEDS_REVISION", "RESET"]),
  teacherFeedback: z.string().max(1000).optional().nullable(),
  submissionUrl: z.string().trim().optional().nullable(),
});

export const questPayloadSchema = z.object({
  sectionId: z.string().min(1),
  taskNumber: z.coerce.number().int().min(1).max(60).optional(),
  title: z.string().trim().min(2, "Quest title is required.").max(140),
  description: z.string().trim().min(2, "Instructions are required.").max(4000),
  category: z.enum(["SELF_PACED", "ON_SITE_LIBRARY", "CREATIVE_OUTPUT", "REFLECTION"]),
  openlearningUrl: z.string().trim().optional().nullable(),
  startDate: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
});

export const createStudentSchema = z.object({
  sectionId: z.string().min(1),
  studentId: z.string().trim().min(3, "Student ID is required.").max(40),
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  middleName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  courseCode: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email("Valid APC student email required.").toLowerCase(),
  defaultPassword: z.string().min(6).max(128).optional(),
});

export const updateStudentSchema = z.object({
  studentId: z.string().trim().min(3, "Student ID is required.").max(40).optional().nullable(),
  firstName: z.string().trim().min(1, "First name is required.").max(80).optional(),
  middleName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().min(1, "Last name is required.").max(80).optional(),
  courseCode: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email("Valid APC email required.").toLowerCase().optional(),
});

export const updateEnrollmentTrackSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required."),
  studentIds: z
    .array(z.string().min(1).max(64))
    .min(1, "At least one student must be selected.")
    .max(500, "Assign at most 500 students at a time."),
  finalsTrack: z.enum(["UNDECIDED", "SYSTEM", "OPENLEARNING_MODULE"]),
  assignedModuleTitle: z.string().trim().max(180).optional().nullable(),
  assignedModuleUrl: z.string().trim().max(500).optional().nullable(),
});

export const createSectionSchema = z.object({
  code: z.string().trim().min(2, "Section code is required.").max(30).toUpperCase(),
  name: z.string().trim().min(2, "Section title is required.").max(120),
  term: z.string().trim().min(2).max(60).optional(),
  teacherId: z.string().trim().optional().nullable(),
  digestThreshold: z.coerce.number().int().min(1).max(200).optional(),
});

export const updateSectionSettingsSchema = z.object({
  leaderboardVisible: z.boolean().optional(),
  digestEnabled: z.boolean().optional(),
  digestThreshold: z.coerce.number().int().min(1).max(200).optional(),
  code: z.string().trim().min(2).max(30).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  term: z.string().trim().min(2).max(60).optional(),
  teacherId: z.string().trim().optional().nullable(),
});

export const createUserAdminSchema = z.object({
  role: z.enum(["STUDENT", "TEACHER", "ADMIN"]),
  studentId: z.string().trim().max(40).optional().nullable(),
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().min(1).max(80),
  courseCode: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(6).max(128).optional(),
  mustChangePassword: z.boolean().optional(),
  assignSectionIds: z.array(z.string().max(64)).max(100).optional(),
});

export const systemSettingsSchema = z.object({
  activeTerm: z.string().trim().min(2).max(80),
  defaultDigestThreshold: z.coerce.number().int().min(1).max(200),
  digestCronSchedule: z.string().trim().min(5).max(50),
  emailProvider: z.enum(["preview", "resend", "smtp"]),
  emailFromAddress: z.string().trim().min(3).max(160),
  allowedStudentDomain: z.string().trim().min(3).max(100).toLowerCase(),
  allowedStaffDomain: z.string().trim().min(3).max(100).toLowerCase(),
  microsoftSsoEnabled: z.boolean(),
});
