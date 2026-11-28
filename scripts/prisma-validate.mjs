// `prisma validate` resolves env("DATABASE_URL") even though validation never connects,
// so it fails in the default Supabase/local-JSON setup where DATABASE_URL is unset.
// Supply a placeholder in that case (cross-platform, unlike `VAR=x cmd`).
import { spawnSync } from "node:child_process";

const env = { ...process.env };
if (!env.DATABASE_URL?.trim()) {
  env.DATABASE_URL = "postgresql://validate:validate@localhost:5432/validate";
}

const result = spawnSync(
  "npx",
  ["prisma", "validate", "--schema=packages/shared/prisma/schema.prisma"],
  { stdio: "inherit", env, shell: process.platform === "win32" }
);
process.exit(result.status ?? 1);
