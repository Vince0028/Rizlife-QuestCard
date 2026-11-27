/** Errors shaped like Prisma's, so `err.code === "P2002"` checks keep working. */
import type { AnyRecord, TableName } from "./schema";

export const ADAPTER_VERSION = "rizlife-supabase-adapter";

export class AdapterKnownRequestError extends Error {
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

export class AdapterValidationError extends Error {
  clientVersion = ADAPTER_VERSION;
  constructor(message: string) {
    super(message);
    this.name = "PrismaClientValidationError";
  }
}

export function notFound(table: TableName, action: string) {
  return new AdapterKnownRequestError(
    "P2025",
    `An operation failed because it depends on one or more records that were required but not found. No ${table} record found for ${action}.`,
    { modelName: table, cause: `No record was found for ${action}.` }
  );
}

export function uniqueViolation(table: TableName, fields: string[]) {
  return new AdapterKnownRequestError(
    "P2002",
    `Unique constraint failed on the fields: (${fields.map((f) => `\`${f}\``).join(",")})`,
    { modelName: table, target: fields }
  );
}

export function foreignKeyViolation(table: TableName, field: string) {
  return new AdapterKnownRequestError(
    "P2003",
    `Foreign key constraint violated on the constraint: \`${table}_${field}_fkey\``,
    { modelName: table, field_name: `${table}_${field}_fkey` }
  );
}
