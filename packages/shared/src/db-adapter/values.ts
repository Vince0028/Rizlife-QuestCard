import crypto from "node:crypto";
import { ENUMS, LAZY_REMOTE_COLUMNS, SCHEMA } from "./schema";
import type { AnyRecord, ColumnSpec, EnumName, TableName } from "./schema";

export const HAS_TZ = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Parses timestamps the way Prisma reads TIMESTAMP(3) columns: as UTC.
 * PostgREST returns `timestamp without time zone` with no offset ("2026-11-26T08:00:00.123"),
 * which `new Date()` would otherwise interpret in the server's local time zone.
 */
export function parseDate(value: unknown): Date | null {
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

export function isPlainObject(v: unknown): v is AnyRecord {
  return v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);
}

export function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

export function cloneValue(v: unknown) {
  return v instanceof Date ? new Date(v.getTime()) : v;
}

export function cloneRow(row: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(row)) out[k] = cloneValue(v);
  return out;
}


/**
 * Keeps only schema columns, fills missing ones with null, and turns timestamps into Dates.
 * With `lazyAbsent`, lazy columns missing from `raw` stay absent (= "not loaded").
 */
export function hydrateRow(table: TableName, raw: AnyRecord, lazyAbsent = false): AnyRecord {
  const lazy = lazyAbsent ? LAZY_REMOTE_COLUMNS[table] ?? [] : [];
  const out: AnyRecord = {};
  for (const [name, col] of Object.entries(SCHEMA[table].columns)) {
    const v = raw[name];
    if (v === undefined && lazy.includes(name)) continue;
    out[name] = col.type === "DateTime" ? parseDate(v) : v === undefined ? null : v;
  }
  return out;
}

/** Copy of `row` without its lazy columns (what the remote snapshot stores). */
export function stripLazyColumns(table: TableName, row: AnyRecord): AnyRecord {
  const lazy = LAZY_REMOTE_COLUMNS[table];
  if (!lazy) return row;
  const out = { ...row };
  for (const c of lazy) delete out[c];
  return out;
}

export function serializeRow(row: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

export function toComparable(v: unknown, col?: ColumnSpec): unknown {
  if (v === null || v === undefined) return null;
  if (col?.type === "DateTime" || v instanceof Date) return parseDate(v)?.getTime() ?? null;
  return v;
}

export function scalarEquals(a: unknown, b: unknown, col?: ColumnSpec): boolean {
  return toComparable(a, col) === toComparable(b, col);
}

/** Compares two non-null comparables. Strings compare by code point (Postgres "C" collation). */
export function compareScalar(a: any, b: any, col?: ColumnSpec): number {
  if (col && col.type in ENUMS) {
    const order = ENUMS[col.type as EnumName] as readonly string[];
    return order.indexOf(a) - order.indexOf(b);
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function generateId(): string {
  // Same shape as Prisma's cuid(): 25 chars starting with "c".
  return `c${crypto.randomBytes(12).toString("hex")}`;
}
