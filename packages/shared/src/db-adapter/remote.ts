/**
 * Supabase PostgREST backend. Postgres is the source of truth: reads come from a
 * short-lived in-memory snapshot of every table (lazy columns excluded, see
 * LAZY_REMOTE_COLUMNS), and writes go to PostgREST first and are only applied to the
 * snapshot once Postgres accepts them.
 *
 * This suits small deployments and development. For production scale, set
 * DATABASE_URL (Supabase transaction pooler) so Prisma talks to Postgres directly.
 */
import { LAZY_REMOTE_COLUMNS, SCHEMA, TABLE_NAMES } from "./schema";
import type { AnyRecord, Store, TableName } from "./schema";
import {
  AdapterKnownRequestError,
  AdapterValidationError,
  foreignKeyViolation,
  uniqueViolation,
} from "./errors";
import { cloneRow, hydrateRow, serializeRow } from "./values";
import {
  IS_PRODUCTION,
  STORE_FILE_PATH,
  invalidateLocalStoreCache,
  loadLocalStore,
  writeStoreFile,
} from "./local-store";

export interface RemoteCreds {
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

/** Snapshot column list for a table: every schema column except the lazy ones. */
function snapshotColumns(table: TableName): string {
  const lazy = LAZY_REMOTE_COLUMNS[table] ?? [];
  return Object.keys(SCHEMA[table].columns)
    .filter((c) => !lazy.includes(c))
    .map((c) => `"${c}"`)
    .join(",");
}

/**
 * Reads every row (minus lazy columns); PostgREST caps responses at `max-rows`
 * (1000 on Supabase), so page through.
 */
async function fetchTable(creds: RemoteCreds, table: TableName): Promise<AnyRecord[]> {
  const select = encodeURIComponent(snapshotColumns(table));
  const rows: AnyRecord[] = [];
  for (;;) {
    const res = await remoteFetch(
      creds,
      table,
      "read",
      `?select=${select}&order=id.asc&offset=${rows.length}&limit=${PAGE_SIZE}`,
      { method: "GET", headers: { Prefer: "count=exact" } }
    );
    const page = (await res.json()) as AnyRecord[];
    rows.push(...page);
    const total = Number(/\/(\d+)$/.exec(res.headers.get("content-range") ?? "")?.[1]);
    if (page.length === 0) break;
    if (Number.isFinite(total) ? rows.length >= total : page.length < PAGE_SIZE) break;
  }
  return rows.map((r) => hydrateRow(table, r, true));
}

/** Loads `columns` for the given row ids: id -> { column: value }. */
export async function fetchLazyColumns(
  creds: RemoteCreds,
  table: TableName,
  ids: string[],
  columns: readonly string[]
): Promise<Map<string, AnyRecord>> {
  const out = new Map<string, AnyRecord>();
  const select = encodeURIComponent(["id", ...columns].map((c) => `"${c}"`).join(","));
  for (const part of chunk(ids, ID_CHUNK)) {
    const res = await remoteFetch(creds, table, "read", `?select=${select}&${idInFilter(part)}`, {
      method: "GET",
    });
    for (const raw of (await res.json()) as AnyRecord[]) {
      const values: AnyRecord = {};
      for (const c of columns) values[c] = raw[c];
      out.set(raw.id, values);
    }
  }
  return out;
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

export async function remoteInsert(creds: RemoteCreds, table: TableName, record: AnyRecord): Promise<AnyRecord> {
  const res = await remoteFetch(creds, table, "insert", "", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(serializeRow(record)),
  });
  const [row] = (await res.json()) as AnyRecord[];
  return hydrateRow(table, row ?? record);
}

export async function remotePatch(creds: RemoteCreds, table: TableName, ids: string[], patch: AnyRecord): Promise<AnyRecord[]> {
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

export async function remoteDelete(creds: RemoteCreds, table: TableName, ids: string[]): Promise<AnyRecord[]> {
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
    invalidateLocalStoreCache();
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

export interface Ctx {
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

export async function getContext(forceRefresh = false): Promise<Ctx> {
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

/** The freshest store after a write (the snapshot may have been replaced meanwhile). */
export function currentStore(ctx: Ctx): Store {
  return ctx.remote ? remoteCache ?? ctx.store : loadLocalStore();
}

/** Pre-write copy of rows from the remote snapshot (for undo logs). */
export function remoteSnapshotRows(ctx: Ctx, table: TableName, ids: string[]): AnyRecord[] {
  const source = remoteCache ?? ctx.store;
  return source[table].filter((r) => ids.includes(r.id)).map(cloneRow);
}

/** After a failed remote write we don't know what landed; force the next read to re-pull. */
export async function guardRemote<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    lastSyncAt = 0;
    throw err;
  }
}

export function upsertIntoStore(store: Store, table: TableName, rows: AnyRecord[]) {
  for (const row of rows) {
    const idx = store[table].findIndex((r) => r.id === row.id);
    if (idx === -1) store[table].push(row);
    else store[table][idx] = row;
  }
}

export function commitRemote(apply: (store: Store) => void) {
  cacheGeneration += 1;
  if (remoteCache) {
    apply(remoteCache);
    writeMirror(remoteCache, true);
  }
}
