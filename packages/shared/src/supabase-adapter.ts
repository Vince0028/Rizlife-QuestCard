/**
 * Prisma-compatible client used when DATABASE_URL is not set. The implementation lives
 * in ./db-adapter (schema mirror, query engine, local JSON and Supabase PostgREST
 * backends, transactions); this entry point is kept so db.ts and older imports work.
 */
export { createSupabasePrismaClient } from "./db-adapter/client";
