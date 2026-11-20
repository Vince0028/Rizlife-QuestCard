import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type AnyRecord = Record<string, any>;

interface DatabaseShape {
  User: AnyRecord[];
  Section: AnyRecord[];
  Enrollment: AnyRecord[];
  Quest: AnyRecord[];
  Submission: AnyRecord[];
  EmailDigestLog: AnyRecord[];
  SystemSetting: AnyRecord[];
}

type TableName = keyof DatabaseShape;

const TABLE_NAMES: TableName[] = [
  "User",
  "Section",
  "Enrollment",
  "Quest",
  "Submission",
  "EmailDigestLog",
  "SystemSetting",
];

const DATE_FIELDS: Record<TableName, string[]> = {
  User: ["createdAt", "updatedAt"],
  Section: ["lastDigestSentAt", "createdAt", "updatedAt"],
  Enrollment: ["enrolledAt"],
  Quest: ["startDate", "deadline", "createdAt", "updatedAt"],
  Submission: ["firstSubmittedAt", "submittedAt", "stampedAt", "updatedAt"],
  EmailDigestLog: ["sentAt"],
  SystemSetting: ["updatedAt"],
};

function findMonorepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(dir, "supabase", "setup.sql")) ||
      fs.existsSync(path.join(dir, "packages", "shared", "package.json"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const STORE_FILE_PATH = path.join(findMonorepoRoot(), ".rizlife-db.json");

function createInitialSeedData(): DatabaseShape {
  const nowIso = new Date().toISOString();
  return {
    SystemSetting: [
      {
        id: "global",
        activeTerm: "Term 2 AY 2026-2027",
        defaultDigestThreshold: 20,
        digestCronSchedule: "0 8,17 * * *",
        emailProvider: "preview",
        emailFromAddress: "RizLife QuestCard <noreply@rizlife.apc.edu.ph>",
        allowedStudentDomain: "student.apc.edu.ph",
        allowedStaffDomain: "apc.edu.ph",
        microsoftSsoEnabled: false,
        updatedAt: nowIso,
      },
    ],
    User: [
      {
        id: "usr_admin_01",
        studentId: null,
        firstName: "Clarisse",
        middleName: null,
        lastName: "Valdez",
        email: "admin@apc.edu.ph",
        passwordHash: "$2b$10$Cy7lPoCH/5hxqLN241wX7.0nAiIFq5aU0FqyIDxgMjmARFaNEOkQe",
        role: "ADMIN",
        courseCode: null,
        mustChangePassword: false,
        isActive: true,
        microsoftOid: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "usr_teacher_01",
        studentId: null,
        firstName: "Elena",
        middleName: null,
        lastName: "Mendoza",
        email: "teacher@apc.edu.ph",
        passwordHash: "$2b$10$k2ee53CavLcz6KlRu2kug.9Tvcq7lXcHjJNr0L05IZGBvNabEj9Lu",
        role: "TEACHER",
        courseCode: null,
        mustChangePassword: false,
        isActive: true,
        microsoftOid: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "usr_student_vince",
        studentId: "2024-140001",
        firstName: "Vince",
        middleName: null,
        lastName: "Alobin",
        email: "vpalobin@student.apc.edu.ph",
        passwordHash: "$2b$10$N2qYNY8Prf2CFM4ZVkIK8OjpaDFbA.E6xLCCWystzp0L32dFcWp6i",
        role: "STUDENT",
        courseCode: "BSIT",
        mustChangePassword: false,
        isActive: true,
        microsoftOid: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    Section: [
      {
        id: "sec_bsit_t2",
        code: "BSIT",
        name: "Life and Works of Rizal (BSIT)",
        term: "Term 2 AY 2026-2027",
        teacherId: "usr_teacher_01",
        leaderboardVisible: false,
        digestThreshold: 20,
        digestEnabled: true,
        lastDigestSentAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    Enrollment: [
      {
        id: "enr_vince_bsit",
        studentId: "usr_student_vince",
        sectionId: "sec_bsit_t2",
        enrolledAt: nowIso,
      },
    ],
    Quest: [],
    Submission: [],
    EmailDigestLog: [],
  };
}

function readLocalStore(): DatabaseShape {
  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      const raw = fs.readFileSync(STORE_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Partial<DatabaseShape>;
      const seed = createInitialSeedData();
      return {
        User: Array.isArray(parsed.User) ? parsed.User : seed.User,
        Section: Array.isArray(parsed.Section) ? parsed.Section : seed.Section,
        Enrollment: Array.isArray(parsed.Enrollment) ? parsed.Enrollment : seed.Enrollment,
        Quest: Array.isArray(parsed.Quest) ? parsed.Quest : [],
        Submission: Array.isArray(parsed.Submission) ? parsed.Submission : [],
        EmailDigestLog: Array.isArray(parsed.EmailDigestLog)
          ? parsed.EmailDigestLog
          : [],
        SystemSetting: Array.isArray(parsed.SystemSetting)
          ? parsed.SystemSetting
          : seed.SystemSetting,
      };
    }
  } catch {
    // Fall back to empty store
  }
  return createInitialSeedData();
}

function serializeForStorage(table: TableName, row: AnyRecord): AnyRecord {
  const copy: AnyRecord = { ...row };
  for (const field of DATE_FIELDS[table]) {
    const val = copy[field];
    if (val instanceof Date) {
      copy[field] = val.toISOString();
    }
  }
  return copy;
}

function hydrateRow(table: TableName, row: AnyRecord): AnyRecord {
  const copy: AnyRecord = { ...row };
  for (const field of DATE_FIELDS[table]) {
    const val = copy[field];
    if (typeof val === "string" && val.length > 0) {
      copy[field] = new Date(val);
    } else if (val instanceof Date) {
      copy[field] = new Date(val.getTime());
    } else {
      copy[field] = null;
    }
  }
  return copy;
}

function writeLocalStore(db: DatabaseShape): void {
  try {
    const serialized: DatabaseShape = {
      User: db.User.map((r) => serializeForStorage("User", r)),
      Section: db.Section.map((r) => serializeForStorage("Section", r)),
      Enrollment: db.Enrollment.map((r) => serializeForStorage("Enrollment", r)),
      Quest: db.Quest.map((r) => serializeForStorage("Quest", r)),
      Submission: db.Submission.map((r) => serializeForStorage("Submission", r)),
      EmailDigestLog: db.EmailDigestLog.map((r) => serializeForStorage("EmailDigestLog", r)),
      SystemSetting: db.SystemSetting.map((r) => serializeForStorage("SystemSetting", r)),
    };
    const tmpPath = `${STORE_FILE_PATH}.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(serialized, null, 2), "utf-8");
    fs.renameSync(tmpPath, STORE_FILE_PATH);
  } catch {
    try {
      fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
    } catch {
      // Ignore write lock contention
    }
  }
}

// Fast parallel sync + request-level memory cache with Supabase PostgREST
let supabaseRestStatus: "unknown" | "ready" | "permission_denied" | "disabled" = "unknown";
let lastPermissionCheckAt = 0;
let loggedFallbackNotice = false;
let memoryCache: DatabaseShape | null = null;
let lastSyncAt = 0;
let inflightSync: Promise<DatabaseShape> | null = null;
const SYNC_TTL_MS = 1200;

function getSupabaseRestCredentials(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

async function fetchAllFromSupabase(creds: {
  url: string;
  key: string;
}): Promise<DatabaseShape | null> {
  const localDb = memoryCache ?? readLocalStore();
  const results = await Promise.all(
    TABLE_NAMES.map(async (table) => {
      const res = await fetch(`${creds.url}/rest/v1/${table}?select=*`, {
        headers: { apikey: creds.key },
        cache: "no-store",
      });
      return { table, res };
    })
  );

  const first = results[0]?.res;
  if (first && (first.status === 401 || first.status === 403)) {
    supabaseRestStatus = "permission_denied";
    if (!loggedFallbackNotice) {
      loggedFallbackNotice = true;
      console.info(
        "[RizLife Supabase] Connected via SUPABASE_URL + SUPABASE_SECRET_KEY (local mirror active; run GRANT in supabase/setup.sql to enable direct PostgREST table sync)."
      );
    }
    return null;
  }

  if (!first || !first.ok) {
    return null;
  }

  const pulled: Partial<DatabaseShape> = {};
  await Promise.all(
    results.map(async ({ table, res }) => {
      if (res.ok) {
        pulled[table] = (await res.json()) as AnyRecord[];
      }
    })
  );

  const merged: DatabaseShape = {
    User: pulled.User ?? localDb.User,
    Section: pulled.Section ?? localDb.Section,
    Enrollment: pulled.Enrollment ?? localDb.Enrollment,
    Quest: pulled.Quest ?? [],
    Submission: pulled.Submission ?? [],
    EmailDigestLog: pulled.EmailDigestLog ?? [],
    SystemSetting: pulled.SystemSetting ?? localDb.SystemSetting,
  };
  supabaseRestStatus = "ready";
  memoryCache = merged;
  lastSyncAt = Date.now();
  return merged;
}

async function ensureSupabaseRestSync(forceRefresh = false): Promise<DatabaseShape> {
  const creds = getSupabaseRestCredentials();
  if (!creds) {
    supabaseRestStatus = "disabled";
    if (!memoryCache) memoryCache = readLocalStore();
    return memoryCache;
  }

  const now = Date.now();
  if (
    !forceRefresh &&
    memoryCache &&
    supabaseRestStatus === "ready" &&
    now - lastSyncAt < SYNC_TTL_MS
  ) {
    return memoryCache;
  }

  if (supabaseRestStatus === "permission_denied" && now - lastPermissionCheckAt < 15000) {
    if (!memoryCache) memoryCache = readLocalStore();
    return memoryCache;
  }

  if (inflightSync) {
    return inflightSync;
  }

  inflightSync = (async () => {
    try {
      lastPermissionCheckAt = Date.now();
      const fresh = await fetchAllFromSupabase(creds);
      if (fresh) return fresh;
      if (!memoryCache) memoryCache = readLocalStore();
      return memoryCache;
    } catch {
      if (!memoryCache) memoryCache = readLocalStore();
      return memoryCache;
    } finally {
      inflightSync = null;
    }
  })();

  return inflightSync;
}

async function syncRowToSupabaseRest(
  method: "UPSERT" | "DELETE",
  table: TableName,
  rowOrId: AnyRecord | string
): Promise<void> {
  const creds = getSupabaseRestCredentials();
  if (!creds || supabaseRestStatus !== "ready") return;

  try {
    if (method === "UPSERT" && typeof rowOrId === "object") {
      const payload = serializeForStorage(table, rowOrId);
      await fetch(`${creds.url}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: creds.key,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(payload),
      });
    } else if (method === "DELETE" && typeof rowOrId === "string") {
      await fetch(
        `${creds.url}/rest/v1/${table}?id=eq.${encodeURIComponent(rowOrId)}`,
        {
          method: "DELETE",
          headers: { apikey: creds.key },
        }
      );
    }
  } catch {
    // Keep local store authoritative on transient network error
  }
}

function getRelatedEntity(
  db: DatabaseShape,
  table: TableName,
  row: AnyRecord,
  relationKey: string
): AnyRecord | null {
  if (table === "Section" && relationKey === "teacher") {
    if (!row.teacherId) return null;
    const t = db.User.find((u) => u.id === row.teacherId);
    return t ? hydrateRow("User", t) : null;
  }
  if (table === "Enrollment" && relationKey === "student") {
    const s = db.User.find((u) => u.id === row.studentId);
    return s ? hydrateRow("User", s) : null;
  }
  if (table === "Enrollment" && relationKey === "section") {
    const sec = db.Section.find((s) => s.id === row.sectionId);
    return sec ? hydrateRow("Section", sec) : null;
  }
  if (table === "Quest" && relationKey === "section") {
    const sec = db.Section.find((s) => s.id === row.sectionId);
    return sec ? hydrateRow("Section", sec) : null;
  }
  if (table === "Submission" && relationKey === "quest") {
    const q = db.Quest.find((item) => item.id === row.questId);
    return q ? hydrateRow("Quest", q) : null;
  }
  if (table === "Submission" && relationKey === "student") {
    const s = db.User.find((u) => u.id === row.studentId);
    return s ? hydrateRow("User", s) : null;
  }
  if (table === "Submission" && relationKey === "stampedBy") {
    if (!row.stampedById) return null;
    const u = db.User.find((item) => item.id === row.stampedById);
    return u ? hydrateRow("User", u) : null;
  }
  if (table === "EmailDigestLog" && relationKey === "section") {
    const sec = db.Section.find((s) => s.id === row.sectionId);
    return sec ? hydrateRow("Section", sec) : null;
  }
  if (table === "EmailDigestLog" && relationKey === "teacher") {
    const u = db.User.find((item) => item.id === row.teacherId);
    return u ? hydrateRow("User", u) : null;
  }
  return null;
}

function getRelatedTableName(table: TableName, relationKey: string): TableName | null {
  if (table === "Section" && relationKey === "teacher") return "User";
  if (table === "Enrollment" && relationKey === "student") return "User";
  if (table === "Enrollment" && relationKey === "section") return "Section";
  if (table === "Quest" && relationKey === "section") return "Section";
  if (table === "Submission" && relationKey === "quest") return "Quest";
  if (table === "Submission" && relationKey === "student") return "User";
  if (table === "Submission" && relationKey === "stampedBy") return "User";
  if (table === "EmailDigestLog" && relationKey === "section") return "Section";
  if (table === "EmailDigestLog" && relationKey === "teacher") return "User";
  return null;
}

function computeCount(db: DatabaseShape, table: TableName, row: AnyRecord, selectSpec: AnyRecord): AnyRecord {
  const counts: AnyRecord = {};
  for (const [k, enabled] of Object.entries(selectSpec || {})) {
    if (!enabled) continue;
    if (table === "User" && k === "taughtSections") {
      counts.taughtSections = db.Section.filter((s) => s.teacherId === row.id).length;
    } else if (table === "User" && k === "enrollments") {
      counts.enrollments = db.Enrollment.filter((e) => e.studentId === row.id).length;
    } else if (table === "Section" && k === "enrollments") {
      counts.enrollments = db.Enrollment.filter((e) => e.sectionId === row.id).length;
    } else if (table === "Section" && k === "quests") {
      counts.quests = db.Quest.filter((q) => q.sectionId === row.id).length;
    } else {
      counts[k] = 0;
    }
  }
  return counts;
}

function matchesWhere(
  db: DatabaseShape,
  table: TableName,
  row: AnyRecord,
  where?: AnyRecord
): boolean {
  if (!where) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;

    if (key === "OR" && Array.isArray(condition)) {
      const anyMatch = condition.some((sub) => matchesWhere(db, table, row, sub));
      if (!anyMatch) return false;
      continue;
    }

    if (key === "AND" && Array.isArray(condition)) {
      const allMatch = condition.every((sub) => matchesWhere(db, table, row, sub));
      if (!allMatch) return false;
      continue;
    }

    // Compound unique keys
    if (key === "code_term" && condition && typeof condition === "object") {
      if (row.code !== condition.code || row.term !== condition.term) return false;
      continue;
    }
    if (key === "studentId_sectionId" && condition && typeof condition === "object") {
      if (
        row.studentId !== condition.studentId ||
        row.sectionId !== condition.sectionId
      )
        return false;
      continue;
    }
    if (key === "sectionId_taskNumber" && condition && typeof condition === "object") {
      if (
        row.sectionId !== condition.sectionId ||
        row.taskNumber !== condition.taskNumber
      )
        return false;
      continue;
    }
    if (key === "questId_studentId" && condition && typeof condition === "object") {
      if (row.questId !== condition.questId || row.studentId !== condition.studentId)
        return false;
      continue;
    }

    // Nested relation filter
    const relTable = getRelatedTableName(table, key);
    if (relTable && condition && typeof condition === "object") {
      const related = getRelatedEntity(db, table, row, key);
      if (!related) return false;
      if (!matchesWhere(db, relTable, related, condition)) return false;
      continue;
    }

    const actual = row[key];

    if (
      condition !== null &&
      typeof condition === "object" &&
      !(condition instanceof Date)
    ) {
      if ("in" in condition && Array.isArray(condition.in)) {
        if (!condition.in.includes(actual)) return false;
        continue;
      }
      if ("lt" in condition) {
        if (!(actual < condition.lt)) return false;
        continue;
      }
      if ("lte" in condition) {
        if (!(actual <= condition.lte)) return false;
        continue;
      }
      if ("gt" in condition) {
        if (!(actual > condition.gt)) return false;
        continue;
      }
      if ("gte" in condition) {
        if (!(actual >= condition.gte)) return false;
        continue;
      }
      if ("not" in condition) {
        if (actual === condition.not) return false;
        continue;
      }
    }

    if (actual !== condition) return false;
  }

  return true;
}

function compareValues(a: any, b: any, dir: "asc" | "desc"): number {
  const mult = dir === "desc" ? -1 : 1;
  if (a === b) return 0;
  if (a === null || a === undefined) return 1 * mult;
  if (b === null || b === undefined) return -1 * mult;
  const va = a instanceof Date ? a.getTime() : a;
  const vb = b instanceof Date ? b.getTime() : b;
  if (va < vb) return -1 * mult;
  if (va > vb) return 1 * mult;
  return 0;
}

function sortRows(
  db: DatabaseShape,
  table: TableName,
  rows: AnyRecord[],
  orderBy?: AnyRecord | AnyRecord[]
): AnyRecord[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((ra, rb) => {
    for (const spec of specs) {
      for (const [k, v] of Object.entries(spec)) {
        if (typeof v === "string") {
          const cmp = compareValues(ra[k], rb[k], v as "asc" | "desc");
          if (cmp !== 0) return cmp;
        } else if (v && typeof v === "object") {
          const relA = getRelatedEntity(db, table, ra, k);
          const relB = getRelatedEntity(db, table, rb, k);
          for (const [subK, subDir] of Object.entries(v)) {
            const cmp = compareValues(
              relA ? relA[subK] : null,
              relB ? relB[subK] : null,
              subDir as "asc" | "desc"
            );
            if (cmp !== 0) return cmp;
          }
        }
      }
    }
    return 0;
  });
}

function projectRow(
  db: DatabaseShape,
  table: TableName,
  rawRow: AnyRecord,
  options?: { include?: AnyRecord; select?: AnyRecord }
): AnyRecord {
  const row = hydrateRow(table, rawRow);

  if (options?.select) {
    const out: AnyRecord = {};
    for (const [k, spec] of Object.entries(options.select)) {
      if (!spec) continue;
      if (k === "_count" && typeof spec === "object") {
        out._count = computeCount(db, table, row, spec.select || spec);
      } else {
        const relTable = getRelatedTableName(table, k);
        if (relTable) {
          const rel = getRelatedEntity(db, table, row, k);
          out[k] =
            rel && typeof spec === "object"
              ? projectRow(db, relTable, rel, spec)
              : rel;
        } else {
          out[k] = row[k];
        }
      }
    }
    return out;
  }

  const out: AnyRecord = { ...row };
  if (options?.include) {
    for (const [k, spec] of Object.entries(options.include)) {
      if (!spec) continue;
      if (k === "_count" && typeof spec === "object") {
        out._count = computeCount(db, table, row, spec.select || spec);
      } else {
        const relTable = getRelatedTableName(table, k);
        if (relTable) {
          const rel = getRelatedEntity(db, table, row, k);
          out[k] =
            rel && typeof spec === "object"
              ? projectRow(db, relTable, rel, spec)
              : rel;
        }
      }
    }
  }
  return out;
}

function applyDefaults(table: TableName, data: AnyRecord): AnyRecord {
  const now = new Date();
  const id = data.id ?? `${table.toLowerCase()}_${crypto.randomUUID().slice(0, 12)}`;

  if (table === "User") {
    return {
      id,
      studentId: data.studentId ?? null,
      firstName: data.firstName,
      middleName: data.middleName ?? null,
      lastName: data.lastName,
      email: data.email,
      passwordHash: data.passwordHash ?? null,
      role: data.role ?? "STUDENT",
      courseCode: data.courseCode ?? null,
      mustChangePassword: data.mustChangePassword ?? false,
      isActive: data.isActive ?? true,
      microsoftOid: data.microsoftOid ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };
  }

  if (table === "Section") {
    return {
      id,
      code: data.code,
      name: data.name,
      term: data.term,
      teacherId: data.teacherId ?? null,
      leaderboardVisible: data.leaderboardVisible ?? false,
      digestThreshold: data.digestThreshold ?? 20,
      digestEnabled: data.digestEnabled ?? true,
      lastDigestSentAt: data.lastDigestSentAt ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };
  }

  if (table === "Enrollment") {
    return {
      id,
      studentId: data.studentId,
      sectionId: data.sectionId,
      enrolledAt: data.enrolledAt ?? now,
    };
  }

  if (table === "Quest") {
    return {
      id,
      sectionId: data.sectionId,
      taskNumber: data.taskNumber,
      title: data.title,
      description: data.description,
      category: data.category ?? "SELF_PACED",
      openlearningUrl: data.openlearningUrl ?? null,
      startDate: data.startDate ?? null,
      deadline: data.deadline ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };
  }

  if (table === "Submission") {
    return {
      id,
      questId: data.questId,
      studentId: data.studentId,
      submissionUrl: data.submissionUrl ?? null,
      studentNote: data.studentNote ?? null,
      status: data.status ?? "NOT_STARTED",
      teacherFeedback: data.teacherFeedback ?? null,
      firstSubmittedAt: data.firstSubmittedAt ?? null,
      submittedAt: data.submittedAt ?? null,
      stampedAt: data.stampedAt ?? null,
      stampedById: data.stampedById ?? null,
      includedInDigest: data.includedInDigest ?? false,
      updatedAt: data.updatedAt ?? now,
    };
  }

  if (table === "EmailDigestLog") {
    return {
      id,
      teacherId: data.teacherId,
      sectionId: data.sectionId,
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      submissionCount: data.submissionCount,
      triggerType: data.triggerType,
      deliveryStatus: data.deliveryStatus,
      htmlPreview: data.htmlPreview,
      errorMessage: data.errorMessage ?? null,
      sentAt: data.sentAt ?? now,
    };
  }

  // SystemSetting
  return {
    id: data.id ?? "global",
    activeTerm: data.activeTerm ?? "Term 2 AY 2026-2027",
    defaultDigestThreshold: data.defaultDigestThreshold ?? 20,
    digestCronSchedule: data.digestCronSchedule ?? "0 8,17 * * *",
    emailProvider: data.emailProvider ?? "preview",
    emailFromAddress:
      data.emailFromAddress ?? "RizLife QuestCard <noreply@rizlife.apc.edu.ph>",
    allowedStudentDomain: data.allowedStudentDomain ?? "student.apc.edu.ph",
    allowedStaffDomain: data.allowedStaffDomain ?? "apc.edu.ph",
    microsoftSsoEnabled: data.microsoftSsoEnabled ?? false,
    updatedAt: data.updatedAt ?? now,
  };
}

function cascadeDelete(db: DatabaseShape, table: TableName, target: AnyRecord): void {
  if (table === "Section") {
    db.Enrollment = db.Enrollment.filter((e) => e.sectionId !== target.id);
    const questIds = new Set(
      db.Quest.filter((q) => q.sectionId === target.id).map((q) => q.id)
    );
    db.Submission = db.Submission.filter((s) => !questIds.has(s.questId));
    db.Quest = db.Quest.filter((q) => q.sectionId !== target.id);
    db.EmailDigestLog = db.EmailDigestLog.filter((l) => l.sectionId !== target.id);
  } else if (table === "Quest") {
    db.Submission = db.Submission.filter((s) => s.questId !== target.id);
  } else if (table === "User") {
    db.Enrollment = db.Enrollment.filter((e) => e.studentId !== target.id);
    db.Submission = db.Submission.filter((s) => s.studentId !== target.id);
    db.EmailDigestLog = db.EmailDigestLog.filter((l) => l.teacherId !== target.id);
    for (const sec of db.Section) {
      if (sec.teacherId === target.id) sec.teacherId = null;
    }
    for (const sub of db.Submission) {
      if (sub.stampedById === target.id) sub.stampedById = null;
    }
  }
}

function createModelDelegate(table: TableName) {
  return {
    async findUnique(args?: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      const rows = db[table].map((r) => hydrateRow(table, r));
      const found = rows.find((r) => matchesWhere(db, table, r, args?.where));
      if (!found) return null;
      return projectRow(db, table, found, args);
    },

    async findFirst(args?: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      let rows = db[table]
        .map((r) => hydrateRow(table, r))
        .filter((r) => matchesWhere(db, table, r, args?.where));
      rows = sortRows(db, table, rows, args?.orderBy);
      const found = rows[0];
      if (!found) return null;
      return projectRow(db, table, found, args);
    },

    async findMany(args?: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      let rows = db[table]
        .map((r) => hydrateRow(table, r))
        .filter((r) => matchesWhere(db, table, r, args?.where));
      rows = sortRows(db, table, rows, args?.orderBy);
      if (typeof args?.take === "number") {
        rows = rows.slice(0, args.take);
      }
      return rows.map((r) => projectRow(db, table, r, args));
    },

    async count(args?: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      return db[table]
        .map((r) => hydrateRow(table, r))
        .filter((r) => matchesWhere(db, table, r, args?.where)).length;
    },

    async create(args: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      const record = applyDefaults(table, args.data || {});
      db[table].push(serializeForStorage(table, record));
      writeLocalStore(db);
      await syncRowToSupabaseRest("UPSERT", table, record);
      return projectRow(db, table, record, args);
    },

    async update(args: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      const idx = db[table].findIndex((r) =>
        matchesWhere(db, table, hydrateRow(table, r), args.where)
      );
      if (idx === -1) {
        throw Object.assign(new Error(`${table} record not found for update.`), {
          code: "P2025",
        });
      }
      const existing = hydrateRow(table, db[table][idx]);
      const updated: AnyRecord = {
        ...existing,
        ...args.data,
      };
      if (DATE_FIELDS[table].includes("updatedAt")) {
        updated.updatedAt = new Date();
      }
      db[table][idx] = serializeForStorage(table, updated);
      writeLocalStore(db);
      await syncRowToSupabaseRest("UPSERT", table, updated);
      return projectRow(db, table, updated, args);
    },

    async updateMany(args: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      let count = 0;
      for (let i = 0; i < db[table].length; i++) {
        const hydrated = hydrateRow(table, db[table][i]);
        if (matchesWhere(db, table, hydrated, args?.where)) {
          const updated: AnyRecord = {
            ...hydrated,
            ...args.data,
          };
          if (DATE_FIELDS[table].includes("updatedAt")) {
            updated.updatedAt = new Date();
          }
          db[table][i] = serializeForStorage(table, updated);
          count += 1;
          await syncRowToSupabaseRest("UPSERT", table, updated);
        }
      }
      if (count > 0) writeLocalStore(db);
      return { count };
    },

    async upsert(args: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      const idx = db[table].findIndex((r) =>
        matchesWhere(db, table, hydrateRow(table, r), args.where)
      );
      if (idx !== -1) {
        const existing = hydrateRow(table, db[table][idx]);
        const updated: AnyRecord = {
          ...existing,
          ...args.update,
        };
        if (DATE_FIELDS[table].includes("updatedAt")) {
          updated.updatedAt = new Date();
        }
        db[table][idx] = serializeForStorage(table, updated);
        writeLocalStore(db);
        await syncRowToSupabaseRest("UPSERT", table, updated);
        return projectRow(db, table, updated, args);
      }
      const record = applyDefaults(table, args.create || {});
      db[table].push(serializeForStorage(table, record));
      writeLocalStore(db);
      await syncRowToSupabaseRest("UPSERT", table, record);
      return projectRow(db, table, record, args);
    },

    async delete(args: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      const idx = db[table].findIndex((r) =>
        matchesWhere(db, table, hydrateRow(table, r), args.where)
      );
      if (idx === -1) {
        throw Object.assign(new Error(`${table} record not found for delete.`), {
          code: "P2025",
        });
      }
      const removed = hydrateRow(table, db[table][idx]);
      db[table].splice(idx, 1);
      cascadeDelete(db, table, removed);
      writeLocalStore(db);
      if (removed.id) {
        await syncRowToSupabaseRest("DELETE", table, removed.id);
      }
      return projectRow(db, table, removed, args);
    },

    async deleteMany(args?: AnyRecord) {
      const db = await ensureSupabaseRestSync();
      const remaining: AnyRecord[] = [];
      let count = 0;
      for (const raw of db[table]) {
        const hydrated = hydrateRow(table, raw);
        if (matchesWhere(db, table, hydrated, args?.where)) {
          count += 1;
          cascadeDelete(db, table, hydrated);
          if (hydrated.id) {
            await syncRowToSupabaseRest("DELETE", table, hydrated.id);
          }
        } else {
          remaining.push(raw);
        }
      }
      db[table] = remaining;
      if (count > 0) writeLocalStore(db);
      return { count };
    },
  };
}

export function createSupabasePrismaClient() {
  const client: AnyRecord = {
    user: createModelDelegate("User"),
    section: createModelDelegate("Section"),
    enrollment: createModelDelegate("Enrollment"),
    quest: createModelDelegate("Quest"),
    submission: createModelDelegate("Submission"),
    emailDigestLog: createModelDelegate("EmailDigestLog"),
    systemSetting: createModelDelegate("SystemSetting"),
    async $transaction(arg: any) {
      if (typeof arg === "function") {
        return arg(client);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    },
    async $connect() {},
    async $disconnect() {},
  };
  return client;
}
