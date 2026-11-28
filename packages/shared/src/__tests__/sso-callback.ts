/**
 * Microsoft Entra ID SSO checks: state/PKCE, tenant pinning, APC domain, account
 * linking (microsoftOid first, then case-insensitive email), and per-portal roles.
 * Microsoft's token + Graph endpoints are mocked; the DB is the throwaway local JSON
 * store configured by ./test-env.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../db";
import { verifySessionToken } from "../auth";
import { isMicrosoftSsoConfigured } from "../microsoft-sso";
import {
  MICROSOFT_SSO_STATE_COOKIES,
  performPortalLogin,
  getMicrosoftLoginRedirectUrl,
  isMicrosoftSsoEnabled,
  performMicrosoftCallback,
} from "../portal-auth";
import type { PortalKey } from "../types";
import { issueTemporaryPassword } from "../workspace-service";

const TENANT = "11111111-2222-3333-4444-555555555555";
const ORIGINS: Record<PortalKey, string> = {
  student: "http://localhost:3001",
  teacher: "http://localhost:3002",
  admin: "http://localhost:3003",
};

interface FakeMsUser {
  oid: string;
  mail: string;
  tid?: string;
}

const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");

/** code -> Microsoft user. Also records what the token endpoint received. */
const issuedCodes = new Map<string, FakeMsUser>();
let lastTokenRequest: URLSearchParams | null = null;

async function fakeMicrosoftFetch(input: unknown, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url === `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`) {
    const body = new URLSearchParams(String(init?.body));
    lastTokenRequest = body;
    const user = issuedCodes.get(body.get("code") ?? "");
    if (!user) return new Response("invalid_grant", { status: 400 });
    const idToken = `${b64url({ alg: "none" })}.${b64url({ tid: user.tid ?? TENANT, oid: user.oid })}.sig`;
    return Response.json({ access_token: `at:${body.get("code")}`, id_token: idToken });
  }
  if (url === "https://graph.microsoft.com/v1.0/me") {
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    const user = issuedCodes.get(auth.replace("Bearer at:", ""));
    if (!user) return new Response("unauthorized", { status: 401 });
    return Response.json({ id: user.oid, mail: user.mail, givenName: "Test", surname: "User" });
  }
  throw new Error(`Unexpected fetch in SSO test: ${url}`);
}

/** Simulates: click "Sign in with Microsoft" -> Microsoft redirects back with ?code&state. */
async function signIn(portal: PortalKey, msUser: FakeMsUser, tamper?: { state?: string | null; cookie?: string | undefined }) {
  const start = await getMicrosoftLoginRedirectUrl(ORIGINS[portal], portal);
  assert.ok(start.ok && start.url && start.stateCookie, "SSO login URL should be issued");
  const authorize = new URL(start.url);
  assert.equal(authorize.searchParams.get("redirect_uri"), `${ORIGINS[portal]}/api/auth/microsoft/callback`);
  assert.equal(start.stateCookie.name, MICROSOFT_SSO_STATE_COOKIES[portal]);

  const code = crypto.randomBytes(8).toString("hex");
  issuedCodes.set(code, msUser);
  const result = await performMicrosoftCallback({
    code,
    state: tamper && "state" in tamper ? tamper.state ?? null : authorize.searchParams.get("state"),
    stateCookieValue: tamper && "cookie" in tamper ? tamper.cookie : start.stateCookie.value,
    origin: ORIGINS[portal],
    portal,
  });
  assert.equal(result.clearStateCookie.name, MICROSOFT_SSO_STATE_COOKIES[portal]);
  assert.equal(result.clearStateCookie.options.maxAge, 0, "state cookie must be single-use");
  return { result, authorize, start };
}

const errorOf = (redirectPath: string) => new URL(redirectPath, "http://x").searchParams.get("error");

export async function runMicrosoftSsoChecks() {
  const savedEnv = {
    id: process.env.AZURE_AD_CLIENT_ID,
    secret: process.env.AZURE_AD_CLIENT_SECRET,
    tenant: process.env.AZURE_AD_TENANT_ID,
  };
  const savedFetch = globalThis.fetch;
  process.env.AZURE_AD_CLIENT_ID = "client-id";
  process.env.AZURE_AD_CLIENT_SECRET = "client-secret";
  process.env.AZURE_AD_TENANT_ID = TENANT;
  globalThis.fetch = fakeMicrosoftFetch as typeof fetch;
  // Negative cases log on purpose; keep verify output readable.
  const savedLog = { warn: console.warn, error: console.error };
  console.warn = () => {};
  console.error = () => {};

  const savedSetting = await prisma.systemSetting.findUnique({ where: { id: "global" } });
  await prisma.systemSetting.upsert({
    where: { id: "global" },
    update: { microsoftSsoEnabled: true },
    create: { id: "global", microsoftSsoEnabled: true },
  });

  try {
    // Admin switch: with SSO configured but turned off, no sign-in starts or completes.
    {
      await prisma.systemSetting.update({ where: { id: "global" }, data: { microsoftSsoEnabled: false } });
      const blocked = await getMicrosoftLoginRedirectUrl(ORIGINS.student, "student");
      assert.equal(blocked.ok, false);
      assert.equal(blocked.error, "sso_disabled");
      assert.equal(await isMicrosoftSsoEnabled(), false);
      await prisma.systemSetting.update({ where: { id: "global" }, data: { microsoftSsoEnabled: true } });
      assert.equal(await isMicrosoftSsoEnabled(), true);

      // A sign-in started while enabled is refused at the callback once switched off.
      const start = await getMicrosoftLoginRedirectUrl(ORIGINS.student, "student");
      await prisma.systemSetting.update({ where: { id: "global" }, data: { microsoftSsoEnabled: false } });
      const late = await performMicrosoftCallback({
        code: "irrelevant",
        state: new URL(start.url!).searchParams.get("state"),
        stateCookieValue: start.stateCookie!.value,
        origin: ORIGINS.student,
        portal: "student",
      });
      assert.equal(errorOf(late.redirectPath), "sso_disabled");
      await prisma.systemSetting.update({ where: { id: "global" }, data: { microsoftSsoEnabled: true } });
    }

    const student = await prisma.user.create({
      data: { firstName: "Sso", lastName: "Student", email: "sso.student@student.apc.edu.ph", role: "STUDENT", studentId: "2099-990001" },
    });
    const teacher = await prisma.user.create({
      data: { firstName: "Sso", lastName: "Teacher", email: "sso.teacher@apc.edu.ph", role: "TEACHER" },
    });
    const admin = await prisma.user.create({
      data: { firstName: "Sso", lastName: "Admin", email: "sso.admin@apc.edu.ph", role: "ADMIN" },
    });
    await prisma.user.create({
      data: { firstName: "Gone", lastName: "Away", email: "sso.inactive@apc.edu.ph", role: "TEACHER", isActive: false },
    });

    // PKCE: the verifier sent to the token endpoint matches the challenge in the authorize URL.
    {
      const { result, authorize } = await signIn("student", { oid: "oid-student", mail: "SSO.Student@student.apc.edu.ph" });
      assert.equal(result.ok, true, "student signs in via case-insensitive APC email");
      assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
      const verifier = lastTokenRequest!.get("code_verifier")!;
      assert.equal(
        crypto.createHash("sha256").update(verifier).digest("base64url"),
        authorize.searchParams.get("code_challenge")
      );
      const linked = await prisma.user.findUnique({ where: { id: student.id } });
      assert.equal(linked!.microsoftOid, "oid-student", "first SSO login links microsoftOid");

      const session = await verifySessionToken(result.tokenToSet, "student");
      assert.equal(session?.userId, student.id);
      assert.equal(await verifySessionToken(result.tokenToSet, "teacher"), null, "SSO session is portal-scoped");
      assert.equal(result.cookieName, "rizlife_student_session");
    }

    // Linked microsoftOid wins even when Entra now reports a different (APC) mailbox.
    {
      const { result } = await signIn("student", { oid: "oid-student", mail: "renamed@student.apc.edu.ph" });
      assert.equal(result.ok, true);
      assert.equal((await verifySessionToken(result.tokenToSet, "student"))?.userId, student.id);
    }

    // A different Microsoft identity presenting the same email cannot take over a linked account.
    {
      const { result } = await signIn("student", { oid: "oid-imposter", mail: "sso.student@student.apc.edu.ph" });
      assert.equal(errorOf(result.redirectPath), "sso_account_conflict");
      assert.equal(result.tokenToSet, undefined);
    }

    // Per-portal role enforcement (identical rules to password login).
    const roleCases: Array<[PortalKey, FakeMsUser, boolean]> = [
      ["teacher", { oid: "oid-teacher", mail: "sso.teacher@apc.edu.ph" }, true],
      ["admin", { oid: "oid-teacher", mail: "sso.teacher@apc.edu.ph" }, false],
      ["student", { oid: "oid-teacher", mail: "sso.teacher@apc.edu.ph" }, false],
      ["admin", { oid: "oid-admin", mail: "sso.admin@apc.edu.ph" }, true],
      ["teacher", { oid: "oid-admin", mail: "sso.admin@apc.edu.ph" }, true], // admin override access
      ["student", { oid: "oid-admin", mail: "sso.admin@apc.edu.ph" }, false],
      ["teacher", { oid: "oid-student", mail: "sso.student@student.apc.edu.ph" }, false],
      ["admin", { oid: "oid-student", mail: "sso.student@student.apc.edu.ph" }, false],
    ];
    for (const [portal, msUser, allowed] of roleCases) {
      const { result } = await signIn(portal, msUser);
      assert.equal(result.ok, allowed, `${msUser.mail} on ${portal} portal should be ${allowed ? "allowed" : "refused"}`);
      if (allowed) {
        assert.ok(await verifySessionToken(result.tokenToSet, portal));
        assert.equal(result.redirectPath, "/dashboard");
      } else {
        assert.equal(errorOf(result.redirectPath), "unauthorized");
        assert.equal(result.tokenToSet, undefined);
      }
    }
    assert.equal(
      (await prisma.user.findUnique({ where: { id: teacher.id } }))!.microsoftOid,
      "oid-teacher"
    );
    assert.equal((await prisma.user.findUnique({ where: { id: admin.id } }))!.microsoftOid, "oid-admin");

    // A role-refused login must not link the Microsoft account.
    {
      const fresh = await prisma.user.create({
        data: { firstName: "Not", lastName: "Linked", email: "not.linked@student.apc.edu.ph", role: "STUDENT", studentId: "2099-990002" },
      });
      const { result } = await signIn("admin", { oid: "oid-not-linked", mail: "not.linked@student.apc.edu.ph" });
      assert.equal(errorOf(result.redirectPath), "unauthorized");
      assert.equal((await prisma.user.findUnique({ where: { id: fresh.id } }))!.microsoftOid, null);
    }

    // Unknown / inactive accounts, foreign domains, foreign tenants.
    assert.equal(errorOf((await signIn("teacher", { oid: "oid-x", mail: "nobody@apc.edu.ph" })).result.redirectPath), "sso_account_not_provisioned");
    assert.equal(errorOf((await signIn("teacher", { oid: "oid-y", mail: "sso.inactive@apc.edu.ph" })).result.redirectPath), "sso_account_not_provisioned");
    assert.equal(errorOf((await signIn("admin", { oid: "oid-z", mail: "sso.admin@apc.edu.ph.evil.com" })).result.redirectPath), "sso_domain_not_allowed");
    assert.equal(errorOf((await signIn("admin", { oid: "oid-z", mail: "sso.admin@gmail.com" })).result.redirectPath), "sso_domain_not_allowed");
    assert.equal(
      errorOf((await signIn("admin", { oid: "oid-admin", mail: "sso.admin@apc.edu.ph", tid: "99999999-0000-0000-0000-000000000000" })).result.redirectPath),
      "sso_failed",
      "tokens from another Entra tenant are rejected"
    );

    // state / CSRF protection
    {
      const before = lastTokenRequest;
      const noCookie = await signIn("student", { oid: "oid-student", mail: "sso.student@student.apc.edu.ph" }, { cookie: undefined });
      assert.equal(errorOf(noCookie.result.redirectPath), "sso_state_mismatch");
      const forged = await signIn("student", { oid: "oid-student", mail: "sso.student@student.apc.edu.ph" }, { state: "student:attacker" });
      assert.equal(errorOf(forged.result.redirectPath), "sso_state_mismatch");
      const teacherStart = await getMicrosoftLoginRedirectUrl(ORIGINS.teacher, "teacher");
      const crossPortal = await signIn(
        "student",
        { oid: "oid-student", mail: "sso.student@student.apc.edu.ph" },
        { state: new URL(teacherStart.url!).searchParams.get("state"), cookie: teacherStart.stateCookie!.value }
      );
      assert.equal(errorOf(crossPortal.result.redirectPath), "sso_state_mismatch", "a teacher-portal state is not valid on the student portal");
      assert.equal(lastTokenRequest, before, "no code exchange happens when state is invalid");
    }

    // Microsoft-side cancel, missing code
    for (const portal of ["student", "teacher", "admin"] as PortalKey[]) {
      const cancelled = await performMicrosoftCallback({ code: null, state: null, providerError: "access_denied", stateCookieValue: undefined, origin: ORIGINS[portal], portal });
      assert.equal(errorOf(cancelled.redirectPath), "sso_cancelled");
      const missing = await performMicrosoftCallback({ code: null, state: null, stateCookieValue: undefined, origin: ORIGINS[portal], portal });
      assert.equal(errorOf(missing.redirectPath), "sso_missing_code");
    }

    // H2: signing in with Microsoft retires an unused temporary password.
    {
      const pending = await prisma.user.create({
        data: { firstName: "Temp", lastName: "Pending", email: "sso.pending@student.apc.edu.ph", role: "STUDENT", studentId: "2099-990077" },
      });
      const { temporaryPassword } = await issueTemporaryPassword(pending.id);
      const { result } = await signIn("student", { oid: "oid-pending", mail: "sso.pending@student.apc.edu.ph" });
      assert.equal(result.ok, true);
      const after = await prisma.user.findUnique({ where: { id: pending.id } });
      assert.equal(after!.passwordHash, null, "temporary password removed");
      assert.equal(after!.mustChangePassword, false);
      assert.equal(after!.tempPasswordExpiresAt, null);
      const viaPassword = await performPortalLogin(
        { email: "sso.pending@student.apc.edu.ph", password: temporaryPassword },
        "student",
        { ip: "10.98.0.1" }
      );
      assert.equal(viaPassword.status, 401, "the retired temporary password no longer signs in");
    }

    // Multi-tenant authorities are refused (email linking would allow account takeover).
    process.env.AZURE_AD_TENANT_ID = "common";
    assert.equal(isMicrosoftSsoConfigured(), false);
    assert.equal((await getMicrosoftLoginRedirectUrl(ORIGINS.student, "student")).ok, false);
  } finally {
    await prisma.systemSetting.update({
      where: { id: "global" },
      data: { microsoftSsoEnabled: savedSetting?.microsoftSsoEnabled ?? false },
    });
    globalThis.fetch = savedFetch;
    console.warn = savedLog.warn;
    console.error = savedLog.error;
    for (const [key, value] of [
      ["AZURE_AD_CLIENT_ID", savedEnv.id],
      ["AZURE_AD_CLIENT_SECRET", savedEnv.secret],
      ["AZURE_AD_TENANT_ID", savedEnv.tenant],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
