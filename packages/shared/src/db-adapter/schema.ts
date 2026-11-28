/**
 * Schema metadata: a hand-written mirror of packages/shared/prisma/schema.prisma.
 * If you change the Prisma schema, update SCHEMA here and supabase/setup.sql in the
 * same commit.
 */

export type AnyRecord = Record<string, any>;

export const TABLE_NAMES = [
  "User",
  "Section",
  "Enrollment",
  "Quest",
  "Submission",
  "EmailDigestLog",
  "SystemSetting",
] as const;

export type TableName = (typeof TABLE_NAMES)[number];
export type Store = Record<TableName, AnyRecord[]>;

// Postgres compares/sorts enums by declaration order, not alphabetically.
export const ENUMS = {
  Role: ["STUDENT", "TEACHER", "ADMIN"],
  QuestCategory: ["SELF_PACED", "ON_SITE_LIBRARY", "CREATIVE_OUTPUT", "REFLECTION"],
  SubmissionStatus: ["NOT_STARTED", "PENDING_REVIEW", "STAMPED", "NEEDS_REVISION"],
  FinalsTrack: ["UNDECIDED", "SYSTEM", "OPENLEARNING_MODULE"],
} as const;

export type EnumName = keyof typeof ENUMS;
export type ScalarType = "String" | "Int" | "Boolean" | "DateTime" | EnumName;

export interface ColumnSpec {
  type: ScalarType;
  nullable: boolean;
}

export type Relation =
  | { kind: "one"; table: TableName; foreignKey: string; onDelete: "Cascade" | "SetNull" }
  | { kind: "many"; table: TableName; foreignKey: string };

export interface ModelSpec {
  columns: Record<string, ColumnSpec>;
  /** Static @default values. */
  defaults: AnyRecord;
  /** Columns with @default(now()). */
  nowDefaults: string[];
  /** Model has an @updatedAt column named updatedAt. */
  hasUpdatedAt: boolean;
  /** Static @default for id; otherwise a cuid-like id is generated. */
  idDefault?: string;
  /** @unique / @@unique field sets (the primary key is always checked too). */
  unique: string[][];
  relations: Record<string, Relation>;
}

function cols(spec: Record<string, string>): Record<string, ColumnSpec> {
  const out: Record<string, ColumnSpec> = {};
  for (const [name, raw] of Object.entries(spec)) {
    const nullable = raw.endsWith("?");
    out[name] = { type: raw.replace("?", "") as ScalarType, nullable };
  }
  return out;
}

const one = (table: TableName, foreignKey: string, onDelete: "Cascade" | "SetNull"): Relation => ({
  kind: "one",
  table,
  foreignKey,
  onDelete,
});
const many = (table: TableName, foreignKey: string): Relation => ({ kind: "many", table, foreignKey });

export const SCHEMA: Record<TableName, ModelSpec> = {
  User: {
    columns: cols({
      id: "String",
      studentId: "String?",
      firstName: "String",
      middleName: "String?",
      lastName: "String",
      email: "String",
      passwordHash: "String?",
      role: "Role",
      courseCode: "String?",
      mustChangePassword: "Boolean",
      isActive: "Boolean",
      microsoftOid: "String?",
      sessionVersion: "Int",
      createdAt: "DateTime",
      updatedAt: "DateTime",
    }),
    defaults: { role: "STUDENT", mustChangePassword: false, isActive: true, sessionVersion: 0 },
    nowDefaults: ["createdAt"],
    hasUpdatedAt: true,
    unique: [["studentId"], ["email"], ["microsoftOid"]],
    relations: {
      taughtSections: many("Section", "teacherId"),
      enrollments: many("Enrollment", "studentId"),
      submissions: many("Submission", "studentId"),
      stampedSubmissions: many("Submission", "stampedById"),
      digestLogs: many("EmailDigestLog", "teacherId"),
    },
  },
  Section: {
    columns: cols({
      id: "String",
      code: "String",
      name: "String",
      term: "String",
      teacherId: "String?",
      leaderboardVisible: "Boolean",
      digestThreshold: "Int",
      digestEnabled: "Boolean",
      lastDigestSentAt: "DateTime?",
      createdAt: "DateTime",
      updatedAt: "DateTime",
    }),
    defaults: { leaderboardVisible: false, digestThreshold: 20, digestEnabled: true },
    nowDefaults: ["createdAt"],
    hasUpdatedAt: true,
    unique: [["code", "term"]],
    relations: {
      teacher: one("User", "teacherId", "SetNull"),
      enrollments: many("Enrollment", "sectionId"),
      quests: many("Quest", "sectionId"),
      digestLogs: many("EmailDigestLog", "sectionId"),
    },
  },
  Enrollment: {
    columns: cols({
      id: "String",
      studentId: "String",
      sectionId: "String",
      finalsTrack: "FinalsTrack",
      assignedModuleTitle: "String?",
      assignedModuleUrl: "String?",
      enrolledAt: "DateTime",
    }),
    defaults: { finalsTrack: "UNDECIDED" },
    nowDefaults: ["enrolledAt"],
    hasUpdatedAt: false,
    unique: [["studentId", "sectionId"]],
    relations: {
      student: one("User", "studentId", "Cascade"),
      section: one("Section", "sectionId", "Cascade"),
    },
  },
  Quest: {
    columns: cols({
      id: "String",
      sectionId: "String",
      taskNumber: "Int",
      title: "String",
      description: "String",
      category: "QuestCategory",
      openlearningUrl: "String?",
      startDate: "DateTime?",
      deadline: "DateTime?",
      createdAt: "DateTime",
      updatedAt: "DateTime",
    }),
    defaults: { category: "SELF_PACED" },
    nowDefaults: ["createdAt"],
    hasUpdatedAt: true,
    unique: [["sectionId", "taskNumber"]],
    relations: {
      section: one("Section", "sectionId", "Cascade"),
      submissions: many("Submission", "questId"),
    },
  },
  Submission: {
    columns: cols({
      id: "String",
      questId: "String",
      studentId: "String",
      submissionUrl: "String?",
      studentNote: "String?",
      status: "SubmissionStatus",
      teacherFeedback: "String?",
      firstSubmittedAt: "DateTime?",
      submittedAt: "DateTime?",
      stampedAt: "DateTime?",
      stampedById: "String?",
      includedInDigest: "Boolean",
      updatedAt: "DateTime",
    }),
    defaults: { status: "NOT_STARTED", includedInDigest: false },
    nowDefaults: [],
    hasUpdatedAt: true,
    unique: [["questId", "studentId"]],
    relations: {
      quest: one("Quest", "questId", "Cascade"),
      student: one("User", "studentId", "Cascade"),
      stampedBy: one("User", "stampedById", "SetNull"),
    },
  },
  EmailDigestLog: {
    columns: cols({
      id: "String",
      teacherId: "String",
      sectionId: "String",
      recipientEmail: "String",
      subject: "String",
      submissionCount: "Int",
      triggerType: "String",
      deliveryStatus: "String",
      htmlPreview: "String",
      errorMessage: "String?",
      sentAt: "DateTime",
    }),
    defaults: {},
    nowDefaults: ["sentAt"],
    hasUpdatedAt: false,
    unique: [],
    relations: {
      teacher: one("User", "teacherId", "Cascade"),
      section: one("Section", "sectionId", "Cascade"),
    },
  },
  SystemSetting: {
    columns: cols({
      id: "String",
      activeTerm: "String",
      defaultDigestThreshold: "Int",
      digestCronSchedule: "String",
      emailProvider: "String",
      emailFromAddress: "String",
      allowedStudentDomain: "String",
      allowedStaffDomain: "String",
      microsoftSsoEnabled: "Boolean",
      updatedAt: "DateTime",
    }),
    defaults: {
      activeTerm: "Term 2 AY 2026-2027",
      defaultDigestThreshold: 20,
      digestCronSchedule: "0 8,17 * * *",
      emailProvider: "preview",
      emailFromAddress: "RizLife QuestCard <noreply@rizlife.apc.edu.ph>",
      allowedStudentDomain: "student.apc.edu.ph",
      allowedStaffDomain: "apc.edu.ph",
      microsoftSsoEnabled: false,
    },
    nowDefaults: [],
    hasUpdatedAt: true,
    idDefault: "global",
    unique: [],
    relations: {},
  },
};

/**
 * Columns the Supabase backend leaves out of its whole-table snapshot and loads only
 * for the rows a query actually returns (see remote.ts / client.ts). Every listed
 * column must be NOT NULL in the schema: in a snapshot row, `undefined` means
 * "not loaded".
 */
export const LAZY_REMOTE_COLUMNS: Partial<Record<TableName, readonly string[]>> = {
  EmailDigestLog: ["htmlPreview"],
};

/** Prisma compound-unique selector names, e.g. `questId_studentId`. */
export const COMPOUND_KEYS: Record<TableName, Record<string, string[]>> = Object.fromEntries(
  TABLE_NAMES.map((t) => [
    t,
    Object.fromEntries(
      SCHEMA[t].unique.filter((f) => f.length > 1).map((fields) => [fields.join("_"), fields])
    ),
  ])
) as Record<TableName, Record<string, string[]>>;

/** For each table, the to-one relations in other tables that point at it (for onDelete). */
type InboundRelation = { table: TableName; rel: Extract<Relation, { kind: "one" }> };
export const INBOUND = Object.fromEntries(
  TABLE_NAMES.map((t) => [t, [] as InboundRelation[]])
) as Record<TableName, InboundRelation[]>;
for (const t of TABLE_NAMES) {
  for (const rel of Object.values(SCHEMA[t].relations)) {
    if (rel.kind === "one") INBOUND[rel.table].push({ table: t, rel });
  }
}
