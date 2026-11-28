/**
 * Issue random, expiring temporary passwords from the command line.
 *
 *   npm run accounts:temp-passwords -- --known-defaults          # dry run: who is affected
 *   npm run accounts:temp-passwords -- --known-defaults --apply  # rotate them
 *   npm run accounts:temp-passwords -- --emails admin@apc.edu.ph --apply   # first admin
 *   npm run accounts:temp-passwords -- --no-password --apply     # accounts created without one
 *
 * Selection (combine freely):
 *   --emails a@x,b@y   specific accounts
 *   --known-defaults   accounts still on a password published in this repo, or on the old
 *                      "RizLife@<last 6 of student ID>" formula (slow: bcrypt per account)
 *   --no-password      active accounts that have no password yet (e.g. from setup.sql)
 * Options:
 *   --apply            actually issue passwords (default is a dry run that changes nothing)
 *   --local            use the local JSON dev database instead of Supabase/Postgres
 *
 * Uses the repository-root .env (DATABASE_URL, or SUPABASE_URL + SUPABASE_SECRET_KEY).
 * New passwords go ONLY to a git-ignored CSV file, never to the console. Hand them out
 * privately, then delete the file. Each one forces a password change at first sign-in,
 * expires after 7 days, and ends the account's existing sessions.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

function usage(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    "Usage: npm run accounts:temp-passwords -- [--emails a@x,b@y] [--known-defaults] [--no-password] [--apply] [--local]"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const emailsArg = (() => {
  const i = args.indexOf("--emails");
  if (i === -1) return [];
  const value = args[i + 1];
  if (!value || value.startsWith("--")) usage("--emails needs a comma-separated list");
  return value.split(",");
})();
const apply = flag("--apply");
const local = flag("--local");
const knownDefaults = flag("--known-defaults");
const noPassword = flag("--no-password");
if (!emailsArg.length && !knownDefaults && !noPassword) usage("choose at least one selection flag");

const hasRemoteDb =
  Boolean(process.env.DATABASE_URL?.trim()) ||
  Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim());
if (local) {
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
} else {
  if (!hasRemoteDb) {
    usage("no database configured in .env (set DATABASE_URL or SUPABASE_URL + SUPABASE_SECRET_KEY, or pass --local)");
  }
  // Production mode makes the Supabase adapter fail loudly instead of silently falling
  // back to the local JSON file if the database can't be reached.
  (process.env as Record<string, string>).NODE_ENV = "production";
}

function csvEscape(v: string) {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function main() {
  // Imported after the environment above is settled: db.ts picks its backend on import.
  const { findRotationCandidates, issueTemporaryPasswords } = await import(
    "../packages/shared/src/account-rotation"
  );
  const { formatManilaDateTime } = await import("../packages/shared/src/deadline");

  const target = local ? "local JSON dev database" : process.env.DATABASE_URL ? "DATABASE_URL" : "Supabase (PostgREST)";
  console.log(`Database: ${target}`);
  if (knownDefaults) console.log("Checking every account against published default passwords (this takes a while)...");

  const { candidates, unknownEmails } = await findRotationCandidates({
    emails: emailsArg,
    knownDefaults,
    noPassword,
    onProgress: (done, total) => {
      if (done % 25 === 0 || done === total) process.stdout.write(`  checked ${done}/${total}\r`);
    },
  });
  if (knownDefaults) process.stdout.write("\n");
  for (const e of unknownEmails) console.warn(`  ! no account with email ${e}`);

  if (candidates.length === 0) {
    console.log("No matching accounts. Nothing to do.");
    return;
  }
  console.log(`\n${candidates.length} account(s) selected:`);
  for (const c of candidates) {
    console.log(`  ${c.role.padEnd(7)} ${c.email.padEnd(40)} ${c.lastName}, ${c.firstName}  [${c.reason}]`);
  }

  if (!apply) {
    console.log("\nDry run: nothing was changed. Re-run with --apply to issue temporary passwords.");
    return;
  }

  const issued = await issueTemporaryPasswords(candidates);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(ROOT, `temp-passwords-${stamp}.csv`);
  const lines = [
    "Role,Email,Last Name,First Name,Temporary Password,Expires (Philippine time)",
    ...issued.map((r) =>
      [r.role, r.email, r.lastName, r.firstName, r.temporaryPassword, formatManilaDateTime(r.expiresAt)]
        .map(csvEscape)
        .join(",")
    ),
  ];
  fs.writeFileSync(file, lines.join("\r\n") + "\r\n", { encoding: "utf-8", mode: 0o600 });

  console.log(`\nIssued ${issued.length} temporary password(s). Their old passwords and sessions no longer work.`);
  console.log(`Passwords saved to: ${file}`);
  console.log("Give each one privately to its owner, then DELETE that file. They expire in 7 days.");
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
