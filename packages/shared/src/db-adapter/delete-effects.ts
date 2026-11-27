/** onDelete emulation (Cascade / SetNull), shared by both backends. */
import { INBOUND } from "./schema";
import type { AnyRecord, Store, TableName } from "./schema";
import { cloneRow } from "./values";

export interface DeleteEffects {
  /** Deleted rows, parents before children (re-insert order for rollback). */
  deleted: Array<{ table: TableName; row: AnyRecord }>;
  /** Columns set to NULL by ON DELETE SET NULL. */
  nulled: Array<{ table: TableName; id: string; column: string; previous: unknown }>;
}

export function computeDeleteEffects(store: Store, table: TableName, ids: string[]): DeleteEffects {
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

export function applyDeleteEffects(store: Store, effects: DeleteEffects) {
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
