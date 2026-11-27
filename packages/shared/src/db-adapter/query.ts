/** Query evaluation over a snapshot: where / orderBy / select / include / _count. */
import { COMPOUND_KEYS, SCHEMA } from "./schema";
import type { AnyRecord, ColumnSpec, Relation, Store, TableName } from "./schema";
import { AdapterValidationError } from "./errors";
import {
  asArray,
  cloneRow,
  cloneValue,
  compareScalar,
  isPlainObject,
  scalarEquals,
  toComparable,
} from "./values";

export function resolveOne(store: Store, row: AnyRecord, rel: Extract<Relation, { kind: "one" }>): AnyRecord | null {
  const fk = row[rel.foreignKey];
  if (fk === null || fk === undefined) return null;
  return store[rel.table].find((r) => r.id === fk) ?? null;
}

export function resolveMany(store: Store, row: AnyRecord, rel: Extract<Relation, { kind: "many" }>): AnyRecord[] {
  return store[rel.table].filter((r) => r[rel.foreignKey] === row.id);
}

export function matchesScalar(actual: unknown, cond: unknown, col: ColumnSpec): boolean {
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

export function matchesWhere(store: Store, table: TableName, row: AnyRecord, where?: AnyRecord): boolean {
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

export function compareForSort(
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

export function compareByOrder(store: Store, table: TableName, a: AnyRecord, b: AnyRecord, key: string, spec: unknown): number {
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

export function sortRows(store: Store, table: TableName, rows: AnyRecord[], orderBy?: AnyRecord | AnyRecord[]): AnyRecord[] {
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

export function queryRows(store: Store, table: TableName, rows: AnyRecord[], args?: AnyRecord): AnyRecord[] {
  if (args?.distinct !== undefined || args?.cursor !== undefined) {
    throw new AdapterValidationError("`distinct` and `cursor` are not supported without DATABASE_URL.");
  }
  let out = rows.filter((r) => matchesWhere(store, table, r, args?.where));
  out = sortRows(store, table, out, args?.orderBy);
  if (typeof args?.skip === "number" && args.skip > 0) out = out.slice(args.skip);
  if (typeof args?.take === "number") out = args.take >= 0 ? out.slice(0, args.take) : out.slice(args.take);
  return out;
}

export function computeCounts(store: Store, table: TableName, row: AnyRecord, spec: unknown): AnyRecord {
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

export function projectRelation(store: Store, row: AnyRecord, rel: Relation, spec: unknown): unknown {
  const nested = isPlainObject(spec) ? spec : undefined;
  if (rel.kind === "one") {
    const related = resolveOne(store, row, rel);
    return related ? projectRow(store, rel.table, related, nested) : null;
  }
  return queryRows(store, rel.table, resolveMany(store, row, rel), nested).map((r) =>
    projectRow(store, rel.table, r, nested)
  );
}

export function projectRow(store: Store, table: TableName, row: AnyRecord, args?: AnyRecord): AnyRecord {
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
