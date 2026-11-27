/**
 * Interactive transactions: best-effort rollback via an undo log.
 * PostgREST cannot hold a Postgres transaction open across requests, so on failure the
 * completed steps are compensated in reverse order. This is NOT atomic: other readers
 * can observe intermediate states. Use DATABASE_URL where that matters.
 *
 * Known limit: undoing a remote delete re-inserts cascaded rows from the snapshot, which
 * lacks lazy columns (EmailDigestLog.htmlPreview). No current transaction deletes a
 * Section or User (the only paths that cascade to digest logs).
 */
import type { AnyRecord, TableName } from "./schema";
import type { DeleteEffects } from "./delete-effects";
import { getContext } from "./remote";
import { deleteRows, insertRow, patchRows } from "./writes";

export interface TxLog {
  undo: Array<() => Promise<void>>;
}

export function recordUndo(tx: TxLog | null, step: () => Promise<void>) {
  if (tx) tx.undo.push(step);
}

export function undoInsert(table: TableName, id: string) {
  return async () => {
    await deleteRows(await getContext(), table, [id]);
  };
}

export function undoPatch(table: TableName, previous: AnyRecord[], fields: string[]) {
  return async () => {
    const ctx = await getContext();
    for (const prev of previous) {
      const restore: AnyRecord = {};
      for (const f of fields) restore[f] = prev[f];
      await patchRows(ctx, table, [prev.id], restore);
    }
  };
}

export function undoDelete(effects: DeleteEffects) {
  return async () => {
    const ctx = await getContext();
    for (const { table, row } of effects.deleted) await insertRow(ctx, table, row);
    for (const n of effects.nulled) await patchRows(ctx, n.table, [n.id], { [n.column]: n.previous });
  };
}
