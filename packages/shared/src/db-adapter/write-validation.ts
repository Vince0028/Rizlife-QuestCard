/** Write-data validation: what Prisma's query engine + Postgres would reject. */
import { ENUMS, SCHEMA } from "./schema";
import type { AnyRecord, ColumnSpec, EnumName, Store, TableName } from "./schema";
import { AdapterValidationError, foreignKeyViolation, uniqueViolation } from "./errors";
import { generateId, isPlainObject, parseDate, scalarEquals } from "./values";

export function coerceValue(table: TableName, field: string, col: ColumnSpec, value: unknown): unknown {
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

export function normalizeWriteData(table: TableName, data: unknown): AnyRecord {
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

export function buildCreateRecord(table: TableName, data: unknown, now: Date): AnyRecord {
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
export function buildUpdatePatch(table: TableName, data: unknown, now: Date): AnyRecord {
  const patch = normalizeWriteData(table, data);
  if (Object.keys(patch).length === 0) return {};
  if (SCHEMA[table].hasUpdatedAt && !("updatedAt" in patch)) patch.updatedAt = new Date(now.getTime());
  return patch;
}

/** Unique (incl. primary key) and foreign-key checks for the local JSON backend. */
export function assertConstraints(store: Store, table: TableName, row: AnyRecord, ignoreId?: string) {
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
