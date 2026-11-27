/**
 * Must be the FIRST import of the verify suite: `db.ts` picks its backend when it is
 * first imported. This forces the local JSON adapter onto a throwaway file so the
 * suite never touches a real database or the repo's .rizlife-db.json.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

for (const key of [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[key];
}

export const TEST_DB_PATH = path.join(
  os.tmpdir(),
  `rizlife-verify-${process.pid}-${Date.now()}.json`
);
process.env.RIZLIFE_LOCAL_DB_PATH = TEST_DB_PATH;

export function cleanupTestDb() {
  const dir = path.dirname(TEST_DB_PATH);
  const base = path.basename(TEST_DB_PATH);
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(base)) fs.rmSync(path.join(dir, file), { force: true });
  }
}
