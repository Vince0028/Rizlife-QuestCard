/**
 * Playwright smoke tests against the three *built* portals (`npm run build` first).
 *
 * Each run gets a fresh local JSON database (seeded with the fictional demo accounts),
 * and every external backend is blanked out, so a developer's .env can never point the
 * tests at a real Supabase/Postgres database.
 */
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Set once in the main process; workers inherit it (they never touch the file anyway).
process.env.E2E_DB_PATH ??= path.join(os.tmpdir(), `rizlife-e2e-${Date.now()}.json`);

const serverEnv = {
  RIZLIFE_LOCAL_DB_PATH: process.env.E2E_DB_PATH,
  JWT_SECRET: "e2e-only-jwt-secret-not-for-production-0123456789",
  // Empty values beat the repo-root .env (dotenv never overrides existing variables).
  DATABASE_URL: "",
  SUPABASE_URL: "",
  SUPABASE_SECRET_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  AZURE_AD_CLIENT_ID: "",
  AZURE_AD_CLIENT_SECRET: "",
  AZURE_AD_TENANT_ID: "",
  RESEND_API_KEY: "",
  SMTP_HOST: "",
  NEXT_PUBLIC_STUDENT_PORTAL_URL: "http://localhost:3001",
  NEXT_PUBLIC_TEACHER_PORTAL_URL: "http://localhost:3002",
  NEXT_PUBLIC_ADMIN_PORTAL_URL: "http://localhost:3003",
};

const portal = (workspace: string, port: number) => ({
  command: `npm run start --workspace=${workspace}`,
  url: `http://localhost:${port}/login`,
  env: serverEnv,
  reuseExistingServer: false,
  timeout: 120_000,
  stdout: "ignore" as const,
  stderr: "pipe" as const,
});

export default defineConfig({
  testDir: "./e2e",
  // The portals share one JSON database, so keep the flow deterministic.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    portal("@rizlife/student", 3001),
    portal("@rizlife/teacher", 3002),
    portal("@rizlife/admin", 3003),
  ],
});
