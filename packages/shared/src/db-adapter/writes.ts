/** Backend-neutral write primitives: PostgREST when connected, else the local JSON file. */
import type { AnyRecord, TableName } from "./schema";
import { cloneRow, stripLazyColumns } from "./values";
import { assertConstraints } from "./write-validation";
import { applyDeleteEffects, computeDeleteEffects } from "./delete-effects";
import type { DeleteEffects } from "./delete-effects";
import { withLocalWrite } from "./local-store";
import {
  commitRemote,
  guardRemote,
  remoteDelete,
  remoteInsert,
  remotePatch,
  remoteSnapshotRows,
  upsertIntoStore,
} from "./remote";
import type { Ctx } from "./remote";

export async function insertRow(ctx: Ctx, table: TableName, record: AnyRecord): Promise<AnyRecord> {
  if (ctx.remote) {
    const creds = ctx.remote;
    const row = await guardRemote(() => remoteInsert(creds, table, record));
    commitRemote((store) => upsertIntoStore(store, table, [stripLazyColumns(table, row)]));
    return row; // full row (incl. lazy columns) for the caller
  }
  return withLocalWrite((store) => {
    assertConstraints(store, table, record);
    store[table].push(record);
    return record;
  });
}

export async function patchRows(
  ctx: Ctx,
  table: TableName,
  ids: string[],
  patch: AnyRecord
): Promise<{ rows: AnyRecord[]; previous: AnyRecord[] }> {
  if (ctx.remote) {
    const creds = ctx.remote;
    const previous = remoteSnapshotRows(ctx, table, ids);
    const rows = await guardRemote(() => remotePatch(creds, table, ids, patch));
    commitRemote((store) =>
      upsertIntoStore(store, table, rows.map((r) => stripLazyColumns(table, r)))
    );
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

export async function deleteRows(ctx: Ctx, table: TableName, ids: string[]): Promise<DeleteEffects> {
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
