/**
 * Local JSON backend: .rizlife-db.json at the monorepo root (or RIZLIFE_LOCAL_DB_PATH).
 * Used when no Supabase credentials are configured, as a dev-only fallback when
 * PostgREST is unreachable, and as the throwaway store for `npm run verify` / e2e.
 */
import fs from "node:fs";
import path from "node:path";
import { TABLE_NAMES } from "./schema";
import type { AnyRecord, Store, TableName } from "./schema";
import { hydrateRow, serializeRow } from "./values";
import { buildCreateRecord } from "./write-validation";

export function findMonorepoRoot(): string {
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

export const STORE_FILE_PATH = process.env.RIZLIFE_LOCAL_DB_PATH?.trim()
  ? path.resolve(process.env.RIZLIFE_LOCAL_DB_PATH.trim())
  : path.join(findMonorepoRoot(), ".rizlife-db.json");
export const LOCK_FILE_PATH = `${STORE_FILE_PATH}.lock`;
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Same starter rows as supabase/setup.sql (sections 5–8). */
export function createInitialSeedData(): Store {
  const now = new Date();
  const build = (table: TableName, data: AnyRecord) => buildCreateRecord(table, data, now);
  return {
    SystemSetting: [build("SystemSetting", { id: "global" })],
    User: [
      build("User", {
        id: "usr_admin_01",
        firstName: "RizLife",
        lastName: "Admin",
        email: "admin@apc.edu.ph",
        passwordHash: "$2b$10$Cy7lPoCH/5hxqLN241wX7.0nAiIFq5aU0FqyIDxgMjmARFaNEOkQe",
        role: "ADMIN",
      }),
      build("User", {
        id: "usr_teacher_01",
        firstName: "Maria Clara",
        lastName: "de los Santos",
        email: "teacher@apc.edu.ph",
        passwordHash: "$2b$10$k2ee53CavLcz6KlRu2kug.9Tvcq7lXcHjJNr0L05IZGBvNabEj9Lu",
        role: "TEACHER",
      }),
      build("User", {
        id: "usr_student_demo",
        studentId: "2099-000001",
        firstName: "Juan Miguel",
        middleName: "Reyes",
        lastName: "Dela Cruz",
        email: "jdelacruz@student.apc.edu.ph",
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
      build("Enrollment", { id: "enr_demo_bsit", studentId: "usr_student_demo", sectionId: "sec_bsit_t2" }),
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
export function loadLocalStore(): Store {
  const sig = fileSignature();
  if (!localCache || sig !== localSignature) {
    localCache = readStoreFile();
    localSignature = sig;
  }
  return localCache;
}

export function writeStoreFile(store: Store) {
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
export function withLocalWrite<T>(fn: (store: Store) => T): T {
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

/** Forget the cached copy so the next read re-reads the file (used after mirror writes). */
export function invalidateLocalStoreCache() {
  localCache = null;
  localSignature = null;
}

