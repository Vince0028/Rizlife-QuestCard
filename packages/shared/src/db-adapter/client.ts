/**
 * Prisma-compatible client used when DATABASE_URL is not set: model delegates
 * (findMany, update, upsert, ...) plus $transaction, over the Supabase PostgREST
 * backend (remote.ts) or the local JSON file (local-store.ts).
 */
import { LAZY_REMOTE_COLUMNS } from "./schema";
import type { AnyRecord, Store, TableName } from "./schema";
import { AdapterKnownRequestError, AdapterValidationError, notFound } from "./errors";
import { matchesWhere, projectRow, queryRows } from "./query";
import { buildCreateRecord, buildUpdatePatch } from "./write-validation";
import { currentStore, fetchLazyColumns, getContext } from "./remote";
import type { Ctx } from "./remote";
import { deleteRows, insertRow, patchRows } from "./writes";
import { recordUndo, undoDelete, undoInsert, undoPatch } from "./transactions";
import type { TxLog } from "./transactions";

/**
 * Fills lazy columns (LAZY_REMOTE_COLUMNS) that the snapshot doesn't hold into the
 * projected results, with one PostgREST read for just these rows. `rows[i]` is the
 * snapshot row behind `projected[i]`. Top-level only: a lazy column reached through a
 * nested include/select stays unloaded (no query does that today).
 */
async function withLazyColumns(
  ctx: Ctx,
  table: TableName,
  rows: AnyRecord[],
  projected: AnyRecord[],
  args?: AnyRecord
): Promise<AnyRecord[]> {
  const lazy = LAZY_REMOTE_COLUMNS[table];
  if (!ctx.remote || !lazy || rows.length === 0) return projected;
  const wanted = args?.select ? lazy.filter((c) => args.select[c]) : [...lazy];
  if (wanted.length === 0) return projected;
  const missing = rows.filter((r) => wanted.some((c) => !(c in r))).map((r) => r.id as string);
  if (missing.length === 0) return projected;
  const loaded = await fetchLazyColumns(ctx.remote, table, missing, wanted);
  return projected.map((p, i) => {
    const values = loaded.get(rows[i].id);
    return values ? { ...p, ...values } : p;
  });
}

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
      const ctx = await getContext();
      const row = findTarget(ctx.store, args?.where);
      if (!row) return null;
      const [out] = await withLazyColumns(ctx, table, [row], [projectRow(ctx.store, table, row, args)], args);
      return out;
    },

    async findUniqueOrThrow(args?: AnyRecord) {
      const found = await delegate.findUnique(args);
      if (!found) throw notFound(table, "findUniqueOrThrow");
      return found;
    },

    async findFirst(args?: AnyRecord) {
      const ctx = await getContext();
      const [row] = queryRows(ctx.store, table, ctx.store[table], { ...args, take: 1 });
      if (!row) return null;
      const [out] = await withLazyColumns(ctx, table, [row], [projectRow(ctx.store, table, row, args)], args);
      return out;
    },

    async findFirstOrThrow(args?: AnyRecord) {
      const found = await delegate.findFirst(args);
      if (!found) throw notFound(table, "findFirstOrThrow");
      return found;
    },

    async findMany(args?: AnyRecord) {
      const ctx = await getContext();
      const rows = queryRows(ctx.store, table, ctx.store[table], args);
      const projected = rows.map((r) => projectRow(ctx.store, table, r, args));
      return withLazyColumns(ctx, table, rows, projected, args);
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
