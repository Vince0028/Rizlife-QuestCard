/**
 * Prisma-compatible client used when DATABASE_URL is not set.
 *
 * Backends:
 *   - Supabase PostgREST (SUPABASE_URL + SUPABASE_SECRET_KEY): Postgres is the source of
 *     truth. Reads come from a short-lived in-memory snapshot; writes go to PostgREST
 *     first and are only applied to the snapshot once Postgres accepts them.
 *   - Local JSON (.rizlife-db.json at the monorepo root): used when no Supabase
 *     credentials are configured, or (outside production only) when PostgREST is
 *     unreachable. Constraints from schema.prisma are enforced in-process.
 *
 * Everything below mirrors packages/shared/prisma/schema.prisma. If you change the
 * schema, update SCHEMA here and supabase/setup.sql in the same commit.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type AnyRecord = Record<string, any>;

// ---------------------------------------------------------------------------
// Schema metadata (mirror of schema.prisma)
// ---------------------------------------------------------------------------

const TABLE_NAMES = [
  "User",
  "Section",
  "Enrollment",
  "Quest",
  "Submission",
  "EmailDigestLog",
  "SystemSetting",
] as const;

type TableName = (typeof TABLE_NAMES)[number];
type Store = Record<TableName, AnyRecord[]>;

// Postgres compares/sorts enums by declaration order, not alphabetically.
const ENUMS = {
  Role: ["STUDENT", "TEACHER", "ADMIN"],
  QuestCategory: ["SELF_PACED", "ON_SITE_LIBRARY", "CREATIVE_OUTPUT", "REFLECTION"],
  SubmissionStatus: ["NOT_STARTED", "PENDING_REVIEW", "STAMPED", "NEEDS_REVISION"],
  FinalsTrack: ["UNDECIDED", "SYSTEM", "OPENLEARNING_MODULE"],
} as const;

type EnumName = keyof typeof ENUMS;
type ScalarType = "String" | "Int" | "Boolean" | "DateTime" | EnumName;

interface ColumnSpec {
  type: ScalarType;
  nullable: boolean;
}

type Relation =
  | { kind: "one"; table: TableName; foreignKey: string; onDelete: "Cascade" | "SetNull" }
  | { kind: "many"; table: TableName; foreignKey: string };

interface ModelSpec {
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

const SCHEMA: Record<TableName, ModelSpec> = {
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
      createdAt: "DateTime",
      updatedAt: "DateTime",
    }),
    defaults: { role: "STUDENT", mustChangePassword: false, isActive: true },
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

/** Prisma compound-unique selector names, e.g. `questId_studentId`. */
const COMPOUND_KEYS: Record<TableName, Record<string, string[]>> = Object.fromEntries(
  TABLE_NAMES.map((t) => [
    t,
    Object.fromEntries(
      SCHEMA[t].unique.filter((f) => f.length > 1).map((fields) => [fields.join("_"), fields])
    ),
  ])
) as Record<TableName, Record<string, string[]>>;

/** For each table, the to-one relations in other tables that point at it (for onDelete). */
const INBOUND: Record<TableName, Array<{ table: TableName; rel: Extract<Relation, { kind: "one" }> }>> =
  Object.fromEntries(TABLE_NAMES.map((t) => [t, []])) as any;
for (const t of TABLE_NAMES) {
  for (const rel of Object.values(SCHEMA[t].relations)) {
    if (rel.kind === "one") INBOUND[rel.table].push({ table: t, rel });
  }
}

// ---------------------------------------------------------------------------
// Errors (shaped like Prisma's so `err.code === "P2002"` checks keep working)
// ---------------------------------------------------------------------------

const ADAPTER_VERSION = "rizlife-supabase-adapter";

class AdapterKnownRequestError extends Error {
  code: string;
  meta?: AnyRecord;
  clientVersion = ADAPTER_VERSION;
  constructor(code: string, message: string, meta?: AnyRecord) {
    super(message);
    this.name = "PrismaClientKnownRequestError";
    this.code = code;
    this.meta = meta;
  }
}

class AdapterValidationError extends Error {
  clientVersion = ADAPTER_VERSION;
  constructor(message: string) {
    super(message);
    this.name = "PrismaClientValidationError";
  }
}

function notFound(table: TableName, action: string) {
  return new AdapterKnownRequestError(
    "P2025",
    `An operation failed because it depends on one or more records that were required but not found. No ${table} record found for ${action}.`,
    { modelName: table, cause: `No record was found for ${action}.` }
  );
}

function uniqueViolation(table: TableName, fields: string[]) {
  return new AdapterKnownRequestError(
    "P2002",
    `Unique constraint failed on the fields: (${fields.map((f) => `\`${f}\``).join(",")})`,
    { modelName: table, target: fields }
  );
}

function foreignKeyViolation(table: TableName, field: string) {
  return new AdapterKnownRequestError(
    "P2003",
    `Foreign key constraint violated on the constraint: \`${table}_${field}_fkey\``,
    { modelName: table, field_name: `${table}_${field}_fkey` }
  );
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

const HAS_TZ = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Parses timestamps the way Prisma reads TIMESTAMP(3) columns: as UTC.
 * PostgREST returns `timestamp without time zone` with no offset ("2026-11-26T08:00:00.123"),
 * which `new Date()` would otherwise interpret in the server's local time zone.
 */
function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    let s = value.trim().replace(" ", "T");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = `${s}T00:00:00Z`;
    else if (!HAS_TZ.test(s)) s = `${s}Z`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isPlainObject(v: unknown): v is AnyRecord {
  return v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);
}

function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

function cloneValue(v: unknown) {
  return v instanceof Date ? new Date(v.getTime()) : v;
}

function cloneRow(row: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(row)) out[k] = cloneValue(v);
  return out;
}

/** Keeps only schema columns, fills missing ones with null, and turns timestamps into Dates. */
function hydrateRow(table: TableName, raw: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  for (const [name, col] of Object.entries(SCHEMA[table].columns)) {
    const v = raw[name];
    out[name] = col.type === "DateTime" ? parseDate(v) : v === undefined ? null : v;
  }
  return out;
}

function serializeRow(row: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

function toComparable(v: unknown, col?: ColumnSpec): unknown {
  if (v === null || v === undefined) return null;
  if (col?.type === "DateTime" || v instanceof Date) return parseDate(v)?.getTime() ?? null;
  return v;
}

function scalarEquals(a: unknown, b: unknown, col?: ColumnSpec): boolean {
  return toComparable(a, col) === toComparable(b, col);
}

/** Compares two non-null comparables. Strings compare by code point (Postgres "C" collation). */
function compareScalar(a: any, b: any, col?: ColumnSpec): number {
  if (col && col.type in ENUMS) {
    const order = ENUMS[col.type as EnumName] as readonly string[];
    return order.indexOf(a) - order.indexOf(b);
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function generateId(): string {
  // Same shape as Prisma's cuid(): 25 chars starting with "c".
  return `c${crypto.randomBytes(12).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Write-data validation (what Prisma's query engine + Postgres would reject)
// ---------------------------------------------------------------------------

function coerceValue(table: TableName, field: string, col: ColumnSpec, value: unknown): unknown {
  if (value === null) {
    if (!col.nullable) {
      throw new AdapterValidationError(`Argument \`${field}\` must not be null (${table}.${field}).`);
    }
    return null;
  }
  const bad = (expected: string) =>
    new AdapterValidationError(
      `Invalid value for argument \`${field}\` on ${table}: expected ${expected}, received ${JSON.stringify(value)}.`
    );
  switch (col.type) {
    case "String":
      if (typeof value !== "string") throw bad("String");
      return value;
    case "Int":
      if (typeof value !== "number" || !Number.isInteger(value)) throw bad("Int");
      return value;
    case "Boolean":
      if (typeof value !== "boolean") throw bad("Boolean");
      return value;
    case "DateTime": {
      const d = value instanceof Date || typeof value === "string" ? parseDate(value) : null;
      if (!d) throw bad("DateTime (Date or ISO-8601 string)");
      return d;
    }
    default: {
      const allowed = ENUMS[col.type as EnumName] as readonly string[];
      if (typeof value !== "string" || !allowed.includes(value)) throw bad(`${col.type} (${allowed.join(" | ")})`);
      return value;
    }
  }
}

function normalizeWriteData(table: TableName, data: unknown): AnyRecord {
  if (data === undefined || data === null) return {};
  if (!isPlainObject(data)) throw new AdapterValidationError(`Argument \`data\` for ${table} must be an object.`);
  const spec = SCHEMA[table];
  const out: AnyRecord = {};
  for (const [field, raw] of Object.entries(data)) {
    if (raw === undefined) continue; // Prisma ignores undefined fields.
    const col = spec.columns[field];
    if (!col) {
      if (spec.relations[field]) {
        throw new AdapterValidationError(
          `Nested relation writes (${table}.${field}) are not supported without DATABASE_URL; set the foreign-key column instead.`
        );
      }
      throw new AdapterValidationError(`Unknown argument \`${field}\` for ${table}.`);
    }
    let value: unknown = raw;
    if (isPlainObject(raw)) {
      const ops = Object.keys(raw);
      if (ops.length === 1 && ops[0] === "set") value = raw.set;
      else {
        throw new AdapterValidationError(
          `Update operator(s) ${ops.join(", ")} on ${table}.${field} are not supported without DATABASE_URL.`
        );
      }
    }
    out[field] = coerceValue(table, field, col, value);
  }
  return out;
}

function buildCreateRecord(table: TableName, data: unknown, now: Date): AnyRecord {
  const spec = SCHEMA[table];
  const input = normalizeWriteData(table, data);
  const record: AnyRecord = {};
  for (const [name, col] of Object.entries(spec.columns)) {
    if (name in input) record[name] = input[name];
    else if (name === "id") record.id = spec.idDefault ?? generateId();
    else if (name in spec.defaults) record[name] = spec.defaults[name];
    else if (spec.nowDefaults.includes(name) || (spec.hasUpdatedAt && name === "updatedAt")) {
      record[name] = new Date(now.getTime());
    } else if (col.nullable) record[name] = null;
    else throw new AdapterValidationError(`Argument \`${name}\` is missing (${table}.create).`);
  }
  return record;
}

/** Returns only the changed columns (+ updatedAt), or {} when there is nothing to write. */
function buildUpdatePatch(table: TableName, data: unknown, now: Date): AnyRecord {
  const patch = normalizeWriteData(table, data);
  if (Object.keys(patch).length === 0) return {};
  if (SCHEMA[table].hasUpdatedAt && !("updatedAt" in patch)) patch.updatedAt = new Date(now.getTime());
  return patch;
}

/** Unique (incl. primary key) and foreign-key checks for the local JSON backend. */
function assertConstraints(store: Store, table: TableName, row: AnyRecord, ignoreId?: string) {
  const spec = SCHEMA[table];
  for (const fields of [["id"], ...spec.unique]) {
    if (fields.some((f) => row[f] === null || row[f] === undefined)) continue; // NULLs never collide
    const clash = store[table].some(
      (other) => other.id !== ignoreId && fields.every((f) => scalarEquals(other[f], row[f], spec.columns[f]))
    );
    if (clash) throw uniqueViolation(table, fields);
  }
  for (const rel of Object.values(spec.relations)) {
    if (rel.kind !== "one") continue;
    const fk = row[rel.foreignKey];
    if (fk === null || fk === undefined) continue;
    if (!store[rel.table].some((r) => r.id === fk)) throw foreignKeyViolation(table, rel.foreignKey);
  }
}

// ---------------------------------------------------------------------------
// Query evaluation: where / orderBy / select / include / _count
// ---------------------------------------------------------------------------

function resolveOne(store: Store, row: AnyRecord, rel: Extract<Relation, { kind: "one" }>): AnyRecord | null {
  const fk = row[rel.foreignKey];
  if (fk === null || fk === undefined) return null;
  return store[rel.table].find((r) => r.id === fk) ?? null;
}

function resolveMany(store: Store, row: AnyRecord, rel: Extract<Relation, { kind: "many" }>): AnyRecord[] {
  return store[rel.table].filter((r) => r[rel.foreignKey] === row.id);
}

function matchesScalar(actual: unknown, cond: unknown, col: ColumnSpec): boolean {
  if (cond === null) return actual === null || actual === undefined;
  if (!isPlainObject(cond)) return scalarEquals(actual, cond, col);

  const isNull = actual === null || actual === undefined;
  const insensitive = cond.mode === "insensitive";
  for (const [op, operand] of Object.entries(cond)) {
    if (operand === undefined || op === "mode") continue;
    switch (op) {
      case "equals":
        if (operand === null) {
          if (!isNull) return false;
        } else if (insensitive && typeof actual === "string" && typeof operand === "string") {
          if (actual.toLowerCase() !== operand.toLowerCase()) return false;
        } else if (!scalarEquals(actual, operand, col)) {
          return false;
        }
        break;
      case "in":
        // SQL: NULL IN (...) is never true.
        if (isNull || !asArray(operand).some((v) => scalarEquals(actual, v, col))) return false;
        break;
      case "notIn": {
        const list = asArray(operand);
        if (list.length === 0) break;
        if (isNull || list.some((v) => scalarEquals(actual, v, col))) return false;
        break;
      }
      case "lt":
      case "lte":
      case "gt":
      case "gte": {
        // SQL: comparisons with NULL are never true (JS would coerce null to 0).
        const a = toComparable(actual, col);
        const b = toComparable(operand, col);
        if (a === null || b === null) return false;
        const c = compareScalar(a, b, col);
        if (op === "lt" && !(c < 0)) return false;
        if (op === "lte" && !(c <= 0)) return false;
        if (op === "gt" && !(c > 0)) return false;
        if (op === "gte" && !(c >= 0)) return false;
        break;
      }
      case "not":
        if (operand === null) {
          if (isNull) return false;
        } else if (isPlainObject(operand)) {
          if (matchesScalar(actual, operand, col)) return false;
        } else if (isNull || scalarEquals(actual, operand, col)) {
          // SQL: `col <> value` excludes NULL rows.
          return false;
        }
        break;
      case "contains":
      case "startsWith":
      case "endsWith": {
        if (typeof actual !== "string") return false;
        const a = insensitive ? actual.toLowerCase() : actual;
        const b = insensitive ? String(operand).toLowerCase() : String(operand);
        if (op === "contains" && !a.includes(b)) return false;
        if (op === "startsWith" && !a.startsWith(b)) return false;
        if (op === "endsWith" && !a.endsWith(b)) return false;
        break;
      }
      default:
        throw new AdapterValidationError(`Filter operator \`${op}\` is not supported without DATABASE_URL.`);
    }
  }
  return true;
}

function matchesWhere(store: Store, table: TableName, row: AnyRecord, where?: AnyRecord): boolean {
  if (!where) return true;
  const spec = SCHEMA[table];

  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;

    if (key === "AND") {
      if (!asArray(cond).every((w: AnyRecord) => matchesWhere(store, table, row, w))) return false;
      continue;
    }
    if (key === "OR") {
      if (!asArray(cond).some((w: AnyRecord) => matchesWhere(store, table, row, w))) return false;
      continue;
    }
    if (key === "NOT") {
      if (asArray(cond).some((w: AnyRecord) => matchesWhere(store, table, row, w))) return false;
      continue;
    }

    const compound = COMPOUND_KEYS[table][key];
    if (compound) {
      if (!isPlainObject(cond)) throw new AdapterValidationError(`\`${key}\` must be an object.`);
      if (!compound.every((f) => scalarEquals(row[f], cond[f], spec.columns[f]))) return false;
      continue;
    }

    const rel = spec.relations[key];
    if (rel) {
      if (rel.kind === "one") {
        const related = resolveOne(store, row, rel);
        if (cond === null) {
          if (related !== null) return false;
        } else if (isPlainObject(cond) && ("is" in cond || "isNot" in cond)) {
          if ("is" in cond && cond.is !== undefined) {
            const ok = cond.is === null ? related === null : !!related && matchesWhere(store, rel.table, related, cond.is);
            if (!ok) return false;
          }
          if ("isNot" in cond && cond.isNot !== undefined) {
            const hit =
              cond.isNot === null ? related === null : !!related && matchesWhere(store, rel.table, related, cond.isNot);
            if (hit) return false;
          }
        } else if (!related || !matchesWhere(store, rel.table, related, cond)) {
          return false;
        }
      } else {
        const children = resolveMany(store, row, rel);
        for (const [op, sub] of Object.entries(cond ?? {})) {
          if (sub === undefined) continue;
          const test = (c: AnyRecord) => matchesWhere(store, rel.table, c, sub as AnyRecord);
          if (op === "some" && !children.some(test)) return false;
          else if (op === "every" && !children.every(test)) return false;
          else if (op === "none" && children.some(test)) return false;
          else if (op !== "some" && op !== "every" && op !== "none") {
            throw new AdapterValidationError(`Relation filter \`${key}.${op}\` is not supported.`);
          }
        }
      }
      continue;
    }

    const col = spec.columns[key];
    if (!col) throw new AdapterValidationError(`Unknown field \`${key}\` in where clause for ${table}.`);
    if (!matchesScalar(row[key], cond, col)) return false;
  }

  return true;
}

function compareForSort(
  x: unknown,
  y: unknown,
  col: ColumnSpec,
  dir: "asc" | "desc",
  nulls: "first" | "last"
): number {
  const a = toComparable(x, col);
  const b = toComparable(y, col);
  if (a === null && b === null) return 0;
  if (a === null) return nulls === "first" ? -1 : 1;
  if (b === null) return nulls === "first" ? 1 : -1;
  const c = compareScalar(a, b, col);
  return dir === "desc" ? -c : c;
}

function compareByOrder(store: Store, table: TableName, a: AnyRecord, b: AnyRecord, key: string, spec: unknown): number {
  const model = SCHEMA[table];
  const col = model.columns[key];
  if (col) {
    const dir: "asc" | "desc" = typeof spec === "string" ? (spec as any) : (spec as AnyRecord)?.sort ?? "asc";
    // Postgres default: NULLS LAST for ASC, NULLS FIRST for DESC.
    const nulls: "first" | "last" =
      (isPlainObject(spec) && spec.nulls) || (dir === "desc" ? "first" : "last");
    return compareForSort(a[key], b[key], col, dir, nulls);
  }
  const rel = model.relations[key];
  if (rel?.kind === "one" && isPlainObject(spec)) {
    const ra = resolveOne(store, a, rel) ?? {};
    const rb = resolveOne(store, b, rel) ?? {};
    for (const [subKey, subSpec] of Object.entries(spec)) {
      if (subSpec === undefined) continue;
      const c = compareByOrder(store, rel.table, ra, rb, subKey, subSpec);
      if (c !== 0) return c;
    }
    return 0;
  }
  throw new AdapterValidationError(`orderBy \`${key}\` is not supported for ${table} without DATABASE_URL.`);
}

function sortRows(store: Store, table: TableName, rows: AnyRecord[], orderBy?: AnyRecord | AnyRecord[]): AnyRecord[] {
  if (!orderBy) return rows;
  const specs = asArray(orderBy).flatMap((o) => Object.entries(o).filter(([, v]) => v !== undefined));
  if (specs.length === 0) return rows;
  return [...rows].sort((ra, rb) => {
    for (const [key, spec] of specs) {
      const c = compareByOrder(store, table, ra, rb, key, spec);
      if (c !== 0) return c;
    }
    return 0;
  });
}

function queryRows(store: Store, table: TableName, rows: AnyRecord[], args?: AnyRecord): AnyRecord[] {
  if (args?.distinct !== undefined || args?.cursor !== undefined) {
    throw new AdapterValidationError("`distinct` and `cursor` are not supported without DATABASE_URL.");
  }
  let out = rows.filter((r) => matchesWhere(store, table, r, args?.where));
  out = sortRows(store, table, out, args?.orderBy);
  if (typeof args?.skip === "number" && args.skip > 0) out = out.slice(args.skip);
  if (typeof args?.take === "number") out = args.take >= 0 ? out.slice(0, args.take) : out.slice(args.take);
  return out;
}

function computeCounts(store: Store, table: TableName, row: AnyRecord, spec: unknown): AnyRecord {
  const model = SCHEMA[table];
  const selection: AnyRecord =
    spec === true
      ? Object.fromEntries(Object.entries(model.relations).filter(([, r]) => r.kind === "many").map(([k]) => [k, true]))
      : (spec as AnyRecord)?.select ?? spec ?? {};
  const counts: AnyRecord = {};
  for (const [key, sub] of Object.entries(selection)) {
    if (!sub) continue;
    const rel = model.relations[key];
    if (!rel || rel.kind !== "many") {
      throw new AdapterValidationError(`_count.${key} is not a to-many relation on ${table}.`);
    }
    let children = resolveMany(store, row, rel);
    if (isPlainObject(sub) && sub.where) {
      children = children.filter((c) => matchesWhere(store, rel.table, c, sub.where));
    }
    counts[key] = children.length;
  }
  return counts;
}

function projectRelation(store: Store, row: AnyRecord, rel: Relation, spec: unknown): unknown {
  const nested = isPlainObject(spec) ? spec : undefined;
  if (rel.kind === "one") {
    const related = resolveOne(store, row, rel);
    return related ? projectRow(store, rel.table, related, nested) : null;
  }
  return queryRows(store, rel.table, resolveMany(store, row, rel), nested).map((r) =>
    projectRow(store, rel.table, r, nested)
  );
}

function projectRow(store: Store, table: TableName, row: AnyRecord, args?: AnyRecord): AnyRecord {
  const model = SCHEMA[table];

  if (args?.select) {
    const out: AnyRecord = {};
    for (const [key, spec] of Object.entries(args.select)) {
      if (!spec) continue;
      if (key === "_count") out._count = computeCounts(store, table, row, spec);
      else if (model.columns[key]) out[key] = cloneValue(row[key]);
      else if (model.relations[key]) out[key] = projectRelation(store, row, model.relations[key], spec);
      else throw new AdapterValidationError(`Unknown field \`${key}\` in select for ${table}.`);
    }
    return out;
  }

  const out = cloneRow(row);
  if (args?.include) {
    for (const [key, spec] of Object.entries(args.include)) {
      if (!spec) continue;
      if (key === "_count") out._count = computeCounts(store, table, row, spec);
      else if (model.relations[key]) out[key] = projectRelation(store, row, model.relations[key], spec);
      else throw new AdapterValidationError(`Unknown relation \`${key}\` in include for ${table}.`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// onDelete emulation (Cascade / SetNull), shared by both backends
// ---------------------------------------------------------------------------

interface DeleteEffects {
  /** Deleted rows, parents before children (re-insert order for rollback). */
  deleted: Array<{ table: TableName; row: AnyRecord }>;
  /** Columns set to NULL by ON DELETE SET NULL. */
  nulled: Array<{ table: TableName; id: string; column: string; previous: unknown }>;
}

function computeDeleteEffects(store: Store, table: TableName, ids: string[]): DeleteEffects {
  const effects: DeleteEffects = { deleted: [], nulled: [] };
  const seen = new Set<string>();
  const visit = (t: TableName, row: AnyRecord) => {
    const key = `${t}:${row.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    effects.deleted.push({ table: t, row: cloneRow(row) });
    for (const { table: child, rel } of INBOUND[t]) {
      for (const c of store[child]) {
        if (c[rel.foreignKey] !== row.id) continue;
        if (rel.onDelete === "Cascade") visit(child, c);
        else effects.nulled.push({ table: child, id: c.id, column: rel.foreignKey, previous: row.id });
      }
    }
  };
  for (const id of ids) {
    const row = store[table].find((r) => r.id === id);
    if (row) visit(table, row);
  }
  const deletedKeys = new Set(effects.deleted.map((d) => `${d.table}:${d.row.id}`));
  effects.nulled = effects.nulled.filter((n) => !deletedKeys.has(`${n.table}:${n.id}`));
  return effects;
}

function applyDeleteEffects(store: Store, effects: DeleteEffects) {
  const byTable = new Map<TableName, Set<string>>();
  for (const { table, row } of effects.deleted) {
    if (!byTable.has(table)) byTable.set(table, new Set());
    byTable.get(table)!.add(row.id);
  }
  for (const [table, ids] of byTable) store[table] = store[table].filter((r) => !ids.has(r.id));
  for (const n of effects.nulled) {
    const row = store[n.table].find((r) => r.id === n.id);
    if (row) row[n.column] = null;
  }
}

// ---------------------------------------------------------------------------
// Local JSON backend
// ---------------------------------------------------------------------------

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

const STORE_FILE_PATH = process.env.RIZLIFE_LOCAL_DB_PATH?.trim()
  ? path.resolve(process.env.RIZLIFE_LOCAL_DB_PATH.trim())
  : path.join(findMonorepoRoot(), ".rizlife-db.json");
const LOCK_FILE_PATH = `${STORE_FILE_PATH}.lock`;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Same starter rows as supabase/setup.sql (sections 5–8). */
function createInitialSeedData(): Store {
  const now = new Date();
  const build = (table: TableName, data: AnyRecord) => buildCreateRecord(table, data, now);
  return {
    SystemSetting: [build("SystemSetting", { id: "global" })],
    User: [
      build("User", {
        id: "usr_admin_01",
        firstName: "Clarisse",
        lastName: "Valdez",
        email: "admin@apc.edu.ph",
        passwordHash: "$2b$10$Cy7lPoCH/5hxqLN241wX7.0nAiIFq5aU0FqyIDxgMjmARFaNEOkQe",
        role: "ADMIN",
      }),
      build("User", {
        id: "usr_teacher_01",
        firstName: "April Anne",
        middleName: "G.",
        lastName: "Tuburan",
        email: "teacher@apc.edu.ph",
        passwordHash: "$2b$10$k2ee53CavLcz6KlRu2kug.9Tvcq7lXcHjJNr0L05IZGBvNabEj9Lu",
        role: "TEACHER",
      }),
      build("User", {
        id: "usr_student_vince",
        studentId: "2024-140101",
        firstName: "Vince Nelmar",
        middleName: "Pega",
        lastName: "Alobin",
        email: "vpalobin@student.apc.edu.ph",
        passwordHash: "$2b$10$N2qYNY8Prf2CFM4ZVkIK8OjpaDFbA.E6xLCCWystzp0L32dFcWp6i",
        role: "STUDENT",
        courseCode: "BSIT",
      }),
    ],
    Section: [
      build("Section", {
        id: "sec_bsit_t2",
        code: "BSIT241",
        name: "Life and Works of Rizal (BSIT241)",
        term: "Term 2 AY 2026-2027",
        teacherId: "usr_teacher_01",
      }),
    ],
    Enrollment: [
      build("Enrollment", { id: "enr_vince_bsit", studentId: "usr_student_vince", sectionId: "sec_bsit_t2" }),
    ],
    Quest: [],
    Submission: [],
    EmailDigestLog: [],
  };
}

function readStoreFile(): Store {
  if (!fs.existsSync(STORE_FILE_PATH)) return createInitialSeedData();

  let parsed: Partial<Record<TableName, AnyRecord[]>>;
  try {
    parsed = JSON.parse(fs.readFileSync(STORE_FILE_PATH, "utf-8"));
  } catch (err) {
    // Keep the unreadable file instead of silently overwriting it on the next write.
    const backup = `${STORE_FILE_PATH}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(STORE_FILE_PATH, backup);
    } catch {
      // ignore
    }
    console.error(`[RizLife DB] ${STORE_FILE_PATH} could not be parsed; moved to ${backup} and reseeded.`, err);
    return createInitialSeedData();
  }

  const seed = createInitialSeedData();
  const store = {} as Store;
  for (const table of TABLE_NAMES) {
    const rows = Array.isArray(parsed[table]) ? parsed[table]! : seed[table];
    store[table] = rows.map((r) => hydrateRow(table, r));
  }
  return store;
}

let localCache: Store | null = null;
let localSignature: string | null = null;

function fileSignature(): string {
  try {
    const st = fs.statSync(STORE_FILE_PATH);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return "missing";
  }
}

/** Re-reads the file when another process (e.g. a different portal) changed it. */
function loadLocalStore(): Store {
  const sig = fileSignature();
  if (!localCache || sig !== localSignature) {
    localCache = readStoreFile();
    localSignature = sig;
  }
  return localCache;
}

function writeStoreFile(store: Store) {
  const serialized: AnyRecord = {};
  for (const table of TABLE_NAMES) serialized[table] = store[table].map(serializeRow);
  const tmpPath = `${STORE_FILE_PATH}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(serialized, null, 2), "utf-8");
  fs.renameSync(tmpPath, STORE_FILE_PATH);
}

const sleepCell = new Int32Array(new SharedArrayBuffer(4));

function acquireLocalLock(): boolean {
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      fs.closeSync(fs.openSync(LOCK_FILE_PATH, "wx"));
      return true;
    } catch (err: any) {
      if (err?.code !== "EEXIST") return false;
      try {
        if (Date.now() - fs.statSync(LOCK_FILE_PATH).mtimeMs > 10_000) {
          fs.unlinkSync(LOCK_FILE_PATH); // stale lock from a crashed process
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) throw new Error(`[RizLife DB] Timed out waiting for ${LOCK_FILE_PATH}.`);
      Atomics.wait(sleepCell, 0, 0, 15);
    }
  }
}

/**
 * Runs a synchronous mutation against the latest file contents under a cross-process lock.
 * The file is only written if `fn` succeeds; on error the in-memory copy is discarded,
 * which gives statement-level atomicity like Postgres.
 */
function withLocalWrite<T>(fn: (store: Store) => T): T {
  const locked = acquireLocalLock();
  try {
    const store = loadLocalStore();
    let result: T;
    try {
      result = fn(store);
    } catch (err) {
      localCache = null;
      localSignature = null;
      throw err;
    }
    try {
      writeStoreFile(store);
    } catch (err) {
      localCache = null;
      localSignature = null;
      throw new Error(`[RizLife DB] Could not write ${STORE_FILE_PATH}: ${(err as Error).message}`);
    }
    localSignature = fileSignature();
    return result;
  } finally {
    if (locked) {
      try {
        fs.unlinkSync(LOCK_FILE_PATH);
      } catch {
        // ignore
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Supabase PostgREST backend
// ---------------------------------------------------------------------------

interface RemoteCreds {
  url: string;
  key: string;
}

function getSupabaseRestCredentials(): RemoteCreds | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

const SYNC_TTL_MS = 1200;
const RETRY_AFTER_FAILURE_MS = IS_PRODUCTION ? 0 : 15_000;
const MIRROR_WRITE_INTERVAL_MS = 30_000;
const PAGE_SIZE = 1000;
const ID_CHUNK = 300;

let remoteStatus: "unknown" | "ready" | "unavailable" = "unknown";
let remoteCache: Store | null = null;
let lastSyncAt = 0;
let lastFailureAt = 0;
let lastFailureNotice = "";
let lastMirrorWriteAt = 0;
let inflightSync: Promise<Store> | null = null;
/** Bumped on every committed remote write so an older in-flight pull can't overwrite it. */
let cacheGeneration = 0;

class RemoteError extends Error {
  status: number;
  permission: boolean;
  constructor(message: string, status: number, permission: boolean) {
    super(message);
    this.status = status;
    this.permission = permission;
  }
}

async function toRemoteError(res: Response, table: TableName, action: string): Promise<Error> {
  const body: AnyRecord | null = await res.json().catch(() => null);
  const pgCode: string | undefined = body?.code;
  const detail = body?.message || body?.details || res.statusText;

  if (pgCode === "23505") {
    const match = /Key \(([^)]+)\)=/.exec(body?.details ?? "");
    const fields = match ? match[1].split(",").map((f) => f.trim().replace(/^"|"$/g, "")) : [];
    return uniqueViolation(table, fields);
  }
  if (pgCode === "23503") {
    const match = /"([A-Za-z]+)_([A-Za-z]+)_fkey"/.exec(body?.message ?? "");
    return foreignKeyViolation(table, match?.[2] ?? "unknown");
  }
  if (pgCode === "23502") {
    return new AdapterKnownRequestError("P2011", `Null constraint violation on ${table}: ${detail}`, { modelName: table });
  }
  if (pgCode === "22P02" || pgCode === "22007" || pgCode === "22008" || pgCode === "23514") {
    return new AdapterValidationError(`Invalid value for ${table}: ${detail}`);
  }
  const permission = res.status === 401 || res.status === 403 || pgCode === "42501";
  return new RemoteError(
    `[RizLife Supabase] ${action} on ${table} failed (HTTP ${res.status}${pgCode ? `, ${pgCode}` : ""}): ${detail}`,
    res.status,
    permission
  );
}

async function remoteFetch(creds: RemoteCreds, table: TableName, action: string, query: string, init: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${creds.url}/rest/v1/${table}${query}`, {
      ...init,
      headers: { apikey: creds.key, ...(init.headers as AnyRecord) },
      cache: "no-store",
    });
  } catch (err) {
    throw new RemoteError(`[RizLife Supabase] ${action} on ${table} failed: ${(err as Error).message}`, 0, false);
  }
  if (!res.ok) throw await toRemoteError(res, table, action);
  return res;
}

/** Reads every row; PostgREST caps responses at `max-rows` (1000 on Supabase), so page through. */
async function fetchTable(creds: RemoteCreds, table: TableName): Promise<AnyRecord[]> {
  const rows: AnyRecord[] = [];
  for (;;) {
    const res = await remoteFetch(
      creds,
      table,
      "read",
      `?select=*&order=id.asc&offset=${rows.length}&limit=${PAGE_SIZE}`,
      { method: "GET", headers: { Prefer: "count=exact" } }
    );
    const page = (await res.json()) as AnyRecord[];
    rows.push(...page);
    const total = Number(/\/(\d+)$/.exec(res.headers.get("content-range") ?? "")?.[1]);
    if (page.length === 0) break;
    if (Number.isFinite(total) ? rows.length >= total : page.length < PAGE_SIZE) break;
  }
  return rows.map((r) => hydrateRow(table, r));
}

function idInFilter(ids: string[]): string {
  const list = ids.map((id) => `"${String(id).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
  return `id=in.${encodeURIComponent(`(${list})`)}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function remoteInsert(creds: RemoteCreds, table: TableName, record: AnyRecord): Promise<AnyRecord> {
  const res = await remoteFetch(creds, table, "insert", "", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(serializeRow(record)),
  });
  const [row] = (await res.json()) as AnyRecord[];
  return hydrateRow(table, row ?? record);
}

async function remotePatch(creds: RemoteCreds, table: TableName, ids: string[], patch: AnyRecord): Promise<AnyRecord[]> {
  const out: AnyRecord[] = [];
  for (const part of chunk(ids, ID_CHUNK)) {
    const res = await remoteFetch(creds, table, "update", `?${idInFilter(part)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(serializeRow(patch)),
    });
    out.push(...((await res.json()) as AnyRecord[]).map((r) => hydrateRow(table, r)));
  }
  return out;
}

async function remoteDelete(creds: RemoteCreds, table: TableName, ids: string[]): Promise<AnyRecord[]> {
  const out: AnyRecord[] = [];
  for (const part of chunk(ids, ID_CHUNK)) {
    const res = await remoteFetch(creds, table, "delete", `?${idInFilter(part)}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    out.push(...((await res.json()) as AnyRecord[]).map((r) => hydrateRow(table, r)));
  }
  return out;
}

function writeMirror(store: Store, force = false) {
  if (IS_PRODUCTION) return; // serverless filesystems are read-only; the mirror is a dev aid only
  if (!force && Date.now() - lastMirrorWriteAt < MIRROR_WRITE_INTERVAL_MS) return;
  try {
    writeStoreFile(store);
    lastMirrorWriteAt = Date.now();
    localCache = null;
    localSignature = null;
  } catch {
    // Best effort: the mirror is not authoritative while Supabase is reachable.
  }
}

async function pullRemote(creds: RemoteCreds): Promise<Store> {
  if (inflightSync) return inflightSync;
  const generationAtStart = cacheGeneration;
  inflightSync = (async () => {
    try {
      const entries = await Promise.all(TABLE_NAMES.map(async (t) => [t, await fetchTable(creds, t)] as const));
      const pulled = Object.fromEntries(entries) as Store;
      if (remoteCache && generationAtStart !== cacheGeneration) {
        // A write committed while this pull was running; the snapshot may predate it.
        lastSyncAt = 0;
        return remoteCache;
      }
      remoteCache = pulled;
      remoteStatus = "ready";
      lastSyncAt = Date.now();
      writeMirror(pulled);
      return pulled;
    } finally {
      inflightSync = null;
    }
  })();
  return inflightSync;
}

interface Ctx {
  store: Store;
  remote: RemoteCreds | null;
}

function fallbackToLocal(reason: string): Ctx {
  if (IS_PRODUCTION) {
    throw new Error(
      `${reason} Refusing to fall back to the local JSON mirror in production. ` +
        "Check SUPABASE_URL / SUPABASE_SECRET_KEY and run the GRANT statements in supabase/setup.sql, or set DATABASE_URL."
    );
  }
  if (lastFailureNotice !== reason) {
    lastFailureNotice = reason;
    console.warn(
      `${reason}\n[RizLife Supabase] Using the local mirror ${STORE_FILE_PATH}. Writes made now stay local and ` +
        "will be replaced by Supabase data once PostgREST is reachable (permission errors: run the GRANT block in supabase/setup.sql)."
    );
  }
  return { store: loadLocalStore(), remote: null };
}

async function getContext(forceRefresh = false): Promise<Ctx> {
  const creds = getSupabaseRestCredentials();
  if (!creds) return { store: loadLocalStore(), remote: null };

  const now = Date.now();
  if (remoteStatus === "unavailable" && now - lastFailureAt < RETRY_AFTER_FAILURE_MS) {
    return fallbackToLocal(lastFailureNotice || "[RizLife Supabase] PostgREST unavailable.");
  }
  if (!forceRefresh && remoteCache && remoteStatus === "ready" && now - lastSyncAt < SYNC_TTL_MS) {
    return { store: remoteCache, remote: creds };
  }
  try {
    const store = await pullRemote(creds);
    return { store, remote: creds };
  } catch (err) {
    remoteStatus = "unavailable";
    lastFailureAt = Date.now();
    return fallbackToLocal((err as Error).message);
  }
}

function currentStore(ctx: Ctx): Store {
  return ctx.remote ? remoteCache ?? ctx.store : localCache ?? ctx.store;
}

/** After a failed remote write we don't know what landed; force the next read to re-pull. */
async function guardRemote<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    lastSyncAt = 0;
    throw err;
  }
}

function upsertIntoStore(store: Store, table: TableName, rows: AnyRecord[]) {
  for (const row of rows) {
    const idx = store[table].findIndex((r) => r.id === row.id);
    if (idx === -1) store[table].push(row);
    else store[table][idx] = row;
  }
}

function commitRemote(apply: (store: Store) => void) {
  cacheGeneration += 1;
  if (remoteCache) {
    apply(remoteCache);
    writeMirror(remoteCache, true);
  }
}

// ---------------------------------------------------------------------------
// Backend-neutral write primitives
// ---------------------------------------------------------------------------

async function insertRow(ctx: Ctx, table: TableName, record: AnyRecord): Promise<AnyRecord> {
  if (ctx.remote) {
    const creds = ctx.remote;
    const row = await guardRemote(() => remoteInsert(creds, table, record));
    commitRemote((store) => upsertIntoStore(store, table, [row]));
    return row;
  }
  return withLocalWrite((store) => {
    assertConstraints(store, table, record);
    store[table].push(record);
    return record;
  });
}

async function patchRows(
  ctx: Ctx,
  table: TableName,
  ids: string[],
  patch: AnyRecord
): Promise<{ rows: AnyRecord[]; previous: AnyRecord[] }> {
  if (ctx.remote) {
    const creds = ctx.remote;
    const source = remoteCache ?? ctx.store;
    const previous = source[table].filter((r) => ids.includes(r.id)).map(cloneRow);
    const rows = await guardRemote(() => remotePatch(creds, table, ids, patch));
    commitRemote((store) => upsertIntoStore(store, table, rows));
    return { rows, previous };
  }
  return withLocalWrite((store) => {
    const rows: AnyRecord[] = [];
    const previous: AnyRecord[] = [];
    for (const id of ids) {
      const idx = store[table].findIndex((r) => r.id === id);
      if (idx === -1) continue;
      const next = { ...store[table][idx], ...patch };
      assertConstraints(store, table, next, id);
      previous.push(cloneRow(store[table][idx]));
      store[table][idx] = next;
      rows.push(next);
    }
    return { rows, previous };
  });
}

async function deleteRows(ctx: Ctx, table: TableName, ids: string[]): Promise<DeleteEffects> {
  if (ctx.remote) {
    const creds = ctx.remote;
    const removed = await guardRemote(() => remoteDelete(creds, table, ids));
    const removedIds = removed.map((r) => r.id);
    let effects: DeleteEffects = { deleted: removed.map((row) => ({ table, row })), nulled: [] };
    commitRemote((store) => {
      // Postgres already cascaded; mirror the same effects in the snapshot.
      effects = computeDeleteEffects(store, table, removedIds);
      for (const row of removed) {
        if (!effects.deleted.some((d) => d.table === table && d.row.id === row.id)) {
          effects.deleted.unshift({ table, row });
        }
      }
      applyDeleteEffects(store, effects);
    });
    return effects;
  }
  return withLocalWrite((store) => {
    const effects = computeDeleteEffects(store, table, ids);
    applyDeleteEffects(store, effects);
    return effects;
  });
}

// ---------------------------------------------------------------------------
// Interactive transactions: best-effort rollback via an undo log.
// PostgREST cannot hold a Postgres transaction open across requests, so on failure
// the completed steps are compensated in reverse order.
// ---------------------------------------------------------------------------

interface TxLog {
  undo: Array<() => Promise<void>>;
}

function recordUndo(tx: TxLog | null, step: () => Promise<void>) {
  if (tx) tx.undo.push(step);
}

function undoInsert(table: TableName, id: string) {
  return async () => {
    await deleteRows(await getContext(), table, [id]);
  };
}

function undoPatch(table: TableName, previous: AnyRecord[], fields: string[]) {
  return async () => {
    const ctx = await getContext();
    for (const prev of previous) {
      const restore: AnyRecord = {};
      for (const f of fields) restore[f] = prev[f];
      await patchRows(ctx, table, [prev.id], restore);
    }
  };
}

function undoDelete(effects: DeleteEffects) {
  return async () => {
    const ctx = await getContext();
    for (const { table, row } of effects.deleted) await insertRow(ctx, table, row);
    for (const n of effects.nulled) await patchRows(ctx, n.table, [n.id], { [n.column]: n.previous });
  };
}

// ---------------------------------------------------------------------------
// Model delegates
// ---------------------------------------------------------------------------

function createModelDelegate(table: TableName, tx: TxLog | null) {
  function findTarget(store: Store, where: AnyRecord | undefined) {
    if (!where) throw new AdapterValidationError(`Argument \`where\` is missing (${table}).`);
    return store[table].find((r) => matchesWhere(store, table, r, where)) ?? null;
  }

  /** Looks a unique record up, re-pulling once if the snapshot may be stale. */
  async function locate(where: AnyRecord | undefined): Promise<{ ctx: Ctx; target: AnyRecord | null }> {
    let ctx = await getContext();
    let target = findTarget(ctx.store, where);
    if (!target && ctx.remote) {
      ctx = await getContext(true);
      target = findTarget(ctx.store, where);
    }
    return { ctx, target };
  }

  async function doCreate(ctx: Ctx, data: unknown, args: AnyRecord) {
    const record = buildCreateRecord(table, data, new Date());
    const row = await insertRow(ctx, table, record);
    recordUndo(tx, undoInsert(table, row.id));
    return projectRow(currentStore(ctx), table, row, args);
  }

  async function doUpdate(ctx: Ctx, target: AnyRecord, data: unknown, args: AnyRecord) {
    const patch = buildUpdatePatch(table, data, new Date());
    if (Object.keys(patch).length === 0) return projectRow(ctx.store, table, target, args);
    const { rows, previous } = await patchRows(ctx, table, [target.id], patch);
    if (rows.length === 0) throw notFound(table, "update");
    recordUndo(tx, undoPatch(table, previous, Object.keys(patch)));
    return projectRow(currentStore(ctx), table, rows[0], args);
  }

  const delegate = {
    async findUnique(args?: AnyRecord) {
      const { store } = await getContext();
      const row = findTarget(store, args?.where);
      return row ? projectRow(store, table, row, args) : null;
    },

    async findUniqueOrThrow(args?: AnyRecord) {
      const found = await delegate.findUnique(args);
      if (!found) throw notFound(table, "findUniqueOrThrow");
      return found;
    },

    async findFirst(args?: AnyRecord) {
      const { store } = await getContext();
      const [row] = queryRows(store, table, store[table], { ...args, take: 1 });
      return row ? projectRow(store, table, row, args) : null;
    },

    async findFirstOrThrow(args?: AnyRecord) {
      const found = await delegate.findFirst(args);
      if (!found) throw notFound(table, "findFirstOrThrow");
      return found;
    },

    async findMany(args?: AnyRecord) {
      const { store } = await getContext();
      return queryRows(store, table, store[table], args).map((r) => projectRow(store, table, r, args));
    },

    async count(args?: AnyRecord) {
      const { store } = await getContext();
      return queryRows(store, table, store[table], { where: args?.where, skip: args?.skip, take: args?.take })
        .length;
    },

    async create(args: AnyRecord) {
      return doCreate(await getContext(), args?.data, args);
    },

    async update(args: AnyRecord) {
      const { ctx, target } = await locate(args?.where);
      if (!target) throw notFound(table, "update");
      return doUpdate(ctx, target, args.data, args);
    },

    async updateMany(args?: AnyRecord) {
      const ctx = await getContext(true);
      const targets = ctx.store[table].filter((r) => matchesWhere(ctx.store, table, r, args?.where));
      if (targets.length === 0) return { count: 0 };
      const patch = buildUpdatePatch(table, args?.data, new Date());
      if (Object.keys(patch).length === 0) return { count: targets.length };
      const { rows, previous } = await patchRows(ctx, table, targets.map((r) => r.id), patch);
      recordUndo(tx, undoPatch(table, previous, Object.keys(patch)));
      return { count: rows.length };
    },

    async upsert(args: AnyRecord) {
      const located = await locate(args?.where);
      let { ctx } = located;
      let target = located.target;
      if (!target) {
        try {
          return await doCreate(ctx, args.create, args);
        } catch (err) {
          // Another portal/instance created it after our snapshot: fall through to update.
          if (!(err instanceof AdapterKnownRequestError) || err.code !== "P2002" || !ctx.remote) throw err;
          ctx = await getContext(true);
          target = findTarget(ctx.store, args.where);
          if (!target) throw err;
        }
      }
      return doUpdate(ctx, target, args.update, args);
    },

    async delete(args: AnyRecord) {
      const { ctx, target } = await locate(args?.where);
      if (!target) throw notFound(table, "delete");
      const projected = projectRow(ctx.store, table, target, args); // relations resolved before the cascade
      const effects = await deleteRows(ctx, table, [target.id]);
      if (!effects.deleted.some((d) => d.table === table && d.row.id === target.id)) {
        throw notFound(table, "delete");
      }
      recordUndo(tx, undoDelete(effects));
      return projected;
    },

    async deleteMany(args?: AnyRecord) {
      const ctx = await getContext(true);
      const ids = ctx.store[table].filter((r) => matchesWhere(ctx.store, table, r, args?.where)).map((r) => r.id);
      if (ids.length === 0) return { count: 0 };
      const effects = await deleteRows(ctx, table, ids);
      recordUndo(tx, undoDelete(effects));
      return { count: effects.deleted.filter((d) => d.table === table).length };
    },
  };

  return delegate;
}

function buildClient(tx: TxLog | null): AnyRecord {
  const client: AnyRecord = {
    user: createModelDelegate("User", tx),
    section: createModelDelegate("Section", tx),
    enrollment: createModelDelegate("Enrollment", tx),
    quest: createModelDelegate("Quest", tx),
    submission: createModelDelegate("Submission", tx),
    emailDigestLog: createModelDelegate("EmailDigestLog", tx),
    systemSetting: createModelDelegate("SystemSetting", tx),

    async $transaction(arg: any) {
      if (typeof arg === "function") {
        if (tx) return arg(client); // nested: join the outer transaction
        const log: TxLog = { undo: [] };
        const txClient = buildClient(log);
        try {
          return await arg(txClient);
        } catch (err) {
          for (const step of log.undo.reverse()) {
            try {
              await step();
            } catch (undoErr) {
              console.error("[RizLife DB] Transaction rollback step failed:", undoErr);
            }
          }
          throw err;
        }
      }
      // Array form: the queries were already started by the caller, so they are
      // neither sequential nor atomic here. Prefer the callback form.
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    },

    async $connect() {},
    async $disconnect() {},
  };
  return client;
}

export function createSupabasePrismaClient() {
  return buildClient(null);
}
