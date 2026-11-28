/**
 * H1/H2/M5/L1/L10: no account enumeration at login, throttling + lockout, random
 * expiring temporary passwords everywhere, one password policy, the API
 * password-change gate, and the rotation-script core.
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../db";
import { PORTAL_COOKIES, signSessionToken } from "../auth";
import {
  KNOWN_DEFAULT_PASSWORDS,
  MIN_PASSWORD_LENGTH,
  generateTemporaryPassword,
  hashPassword,
  legacyStudentDefaultPassword,
} from "../password";
import {
  LOCKOUT_MS,
  MAX_FAILED_LOGINS,
  performChangePassword,
  performPortalLogin,
} from "../portal-auth";
import { createPortalMiddleware } from "../portal-middleware";
import { resetRateLimits } from "../rate-limit";
import {
  bulkImportStudentsForSection,
  createOrEnrollStudent,
  issueTemporaryPassword,
} from "../workspace-service";
import { createUserAsAdmin } from "../admin-service";
import { findRotationCandidates, issueTemporaryPasswords } from "../account-rotation";
import type { PortalKey, SessionPayload } from "../types";

const PW = "Hardened@2099";
let ipSeq = 0;
const freshIp = () => `10.99.0.${++ipSeq}`;

async function mkUser(id: string, role: "STUDENT" | "TEACHER" | "ADMIN", extra: object = {}) {
  return prisma.user.create({
    data: {
      id,
      firstName: "Hard",
      lastName: id,
      email: `${id}@${role === "STUDENT" ? "student." : ""}apc.edu.ph`,
      role,
      passwordHash: await hashPassword(PW),
      ...extra,
    },
  });
}

const login = (email: string, password: string, portal: PortalKey = "student", ip = freshIp()) =>
  performPortalLogin({ email, password }, portal, { ip });

export async function runAuthHardeningChecks() {
  resetRateLimits();

  // --- Random temporary passwords ---------------------------------------------------
  {
    const set = new Set(Array.from({ length: 200 }, generateTemporaryPassword));
    assert.equal(set.size, 200, "temporary passwords don't repeat");
    for (const p of set) {
      assert.ok(p.length >= MIN_PASSWORD_LENGTH);
      assert.match(p, /^Rzl-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    }
  }

  // --- M5: identical failures before the password is verified ---------------------
  {
    const active = await mkUser("ah_active", "STUDENT");
    const inactive = await mkUser("ah_inactive", "STUDENT", { isActive: false });
    const wrongPw = await login(active.email, "Nope@20990");
    const unknown = await login("ah.nobody@student.apc.edu.ph", PW);
    const disabled = await login(inactive.email, PW); // correct password, inactive account
    for (const r of [wrongPw, unknown, disabled]) {
      assert.equal(r.status, 401);
      assert.deepEqual(r.body, wrongPw.body, "unknown / inactive / wrong password look identical");
    }
    assert.equal((await login("ah_active@student.apc.edu.ph", PW, "teacher")).status, 403,
      "the wrong-portal message needs the correct password");
    const wrongPortalWrongPw = await login(active.email, "Nope@20990", "teacher");
    assert.deepEqual(wrongPortalWrongPw.body, wrongPw.body, "no role leak without the password");
  }

  // --- H2: lockout after repeated failures ------------------------------------------
  {
    const u = await mkUser("ah_lock", "TEACHER");
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      assert.equal((await login(u.email, `Wrong@${i}xxxx`, "teacher")).status, 401);
    }
    const locked = await login(u.email, PW, "teacher");
    assert.equal(locked.status, 429, "even the right password is refused while locked");
    const row = await prisma.user.findUnique({ where: { id: u.id } });
    assert.ok(row!.lockedUntil && row!.lockedUntil.getTime() > Date.now() + LOCKOUT_MS - 60_000);
    await prisma.user.update({ where: { id: u.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    assert.equal((await login(u.email, PW, "teacher")).status, 200, "unlocks after the lockout window");
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    assert.equal(after!.failedLoginCount, 0);
    assert.equal(after!.lockedUntil, null);
  }

  // --- H2: in-memory throttles (also for unknown emails) ---------------------------
  {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await login("ah.ghost@student.apc.edu.ph", "x", "student")).status;
    assert.equal(last, 429, "per-email throttle applies to unknown accounts too");
    const ip = freshIp();
    let ipLast = 0;
    for (let i = 0; i < 31; i++) ipLast = (await login(`ah.spray${i}@student.apc.edu.ph`, "x", "student", ip)).status;
    assert.equal(ipLast, 429, "per-IP throttle");
    resetRateLimits();
  }

  // --- H2: temporary passwords expire; issuing one ends sessions --------------------
  {
    const u = await mkUser("ah_expiry", "STUDENT");
    const { temporaryPassword, expiresAt } = await issueTemporaryPassword(u.id);
    assert.ok(new Date(expiresAt).getTime() > Date.now() + 6.9 * 24 * 3600 * 1000);
    assert.equal((await login(u.email, PW)).status, 401, "the old password stops working");
    const fresh = await login(u.email, temporaryPassword);
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.mustChangePassword, true);
    await prisma.user.update({ where: { id: u.id }, data: { tempPasswordExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await login(u.email, temporaryPassword);
    assert.equal(expired.status, 401);
    assert.match(String(expired.body.error), /temporary password has expired/);
  }

  // --- H2/L10: provisioning only ever hands out random temporary passwords ----------
  {
    const teacher = await mkUser("ah_teacher", "TEACHER");
    const section = await prisma.section.create({
      data: { code: "AHSEC", name: "AH", term: "T", teacherId: teacher.id },
    });
    const asTeacher: SessionPayload = {
      userId: teacher.id, email: teacher.email, role: "TEACHER", firstName: "Hard", lastName: "T",
      studentId: null, courseCode: null, mustChangePassword: false, portal: "teacher",
    };
    const created = await createOrEnrollStudent(
      { sectionId: section.id, studentId: "2099-940001", firstName: "New", lastName: "Kid",
        email: "ah.newkid@student.apc.edu.ph", defaultPassword: "Student@2026" },
      asTeacher
    );
    assert.ok(created.temporaryPassword, "a new account gets a temporary password");
    assert.notEqual(created.temporaryPassword, legacyStudentDefaultPassword("2099-940001"));
    assert.equal((await login("ah.newkid@student.apc.edu.ph", "Student@2026")).status, 401,
      "a teacher-supplied password is ignored");
    assert.equal((await login("ah.newkid@student.apc.edu.ph", created.temporaryPassword!)).body.mustChangePassword, true);
    const linked = await createOrEnrollStudent(
      { sectionId: section.id, studentId: "2099-940001", firstName: "New", lastName: "Kid",
        email: "ah.newkid@student.apc.edu.ph" },
      asTeacher
    );
    assert.equal(linked.temporaryPassword, null, "linking an existing account issues nothing");

    const csv = [
      "Student ID,Last Name,First Name,APC Email,Default Password",
      "2099-940002,Imp,One,ah.imp1@student.apc.edu.ph,Student@2026",
      "2099-940001,Kid,New,ah.newkid@student.apc.edu.ph,Student@2026",
    ].join("\r\n");
    const report = await bulkImportStudentsForSection({
      sectionId: section.id, fileBuffer: Buffer.from(csv), filename: "r.csv", user: asTeacher,
    });
    assert.equal(report.createdCount, 1);
    assert.equal(report.credentials.length, 1, "credentials only for accounts the import created");
    assert.equal(report.credentials[0].email, "ah.imp1@student.apc.edu.ph");
    assert.equal(report.credentials[0].rowNumber, 2);
    assert.equal((await login("ah.imp1@student.apc.edu.ph", "Student@2026")).status, 401,
      "the file's password column is ignored");
    assert.equal((await login("ah.imp1@student.apc.edu.ph", report.credentials[0].temporaryPassword)).status, 200);

    const adminMade = await createUserAsAdmin({
      role: "TEACHER", firstName: "Made", lastName: "ByAdmin", email: "ah.made@apc.edu.ph",
      password: "Teacher@RizLife2026",
    });
    assert.ok(adminMade.temporaryPassword);
    assert.equal((await login("ah.made@apc.edu.ph", "Teacher@RizLife2026", "teacher")).status, 401);
    assert.equal((await login("ah.made@apc.edu.ph", adminMade.temporaryPassword, "teacher")).status, 200);
  }

  // --- L10: one password policy for self-chosen passwords ----------------------------
  {
    const u = await mkUser("ah_policy", "STUDENT");
    const token = (await login(u.email, PW)).tokenToSet!;
    const tooShort = await performChangePassword(token, "student", {
      currentPassword: PW, newPassword: "Ab1@xyz", confirmPassword: "Ab1@xyz",
    });
    assert.equal(tooShort.status, 400, "7 characters is too short");
    for (const known of KNOWN_DEFAULT_PASSWORDS) {
      const r = await performChangePassword(token, "student", {
        currentPassword: PW, newPassword: known, confirmPassword: known,
      });
      assert.equal(r.status, 400, `${known} is refused as a new password`);
    }
    const ok = await performChangePassword(token, "student", {
      currentPassword: PW, newPassword: "Personal@2099", confirmPassword: "Personal@2099",
    });
    assert.equal(ok.status, 200);
  }

  // --- L1: the API is closed until a forced password change is done -----------------
  {
    const studentMw = createPortalMiddleware("student");
    const teacherMw = createPortalMiddleware("teacher", { publicPrefixes: ["/api/cron/"] });
    const tokenFor = (portal: PortalKey, role: SessionPayload["role"]) =>
      signSessionToken({
        userId: `ah_gate_${portal}`, email: "g@apc.edu.ph", role, firstName: "G", lastName: "G",
        studentId: null, courseCode: null, mustChangePassword: true, portal,
      });
    const req = (portal: PortalKey, path: string, token: string, method = "GET") =>
      new NextRequest(`http://localhost:3001${path}`, {
        method,
        headers: { cookie: `${PORTAL_COOKIES[portal]}=${token}`, origin: "http://localhost:3001" },
      });
    const st = await tokenFor("student", "STUDENT");
    const tt = await tokenFor("teacher", "TEACHER");
    for (const [mw, portal, token, path] of [
      [studentMw, "student", st, "/api/questcard"],
      [studentMw, "student", st, "/api/submissions"],
      [teacherMw, "teacher", tt, "/api/workspace/sections"],
    ] as const) {
      const res = await mw(req(portal, path, token, path === "/api/submissions" ? "POST" : "GET"));
      assert.equal(res.status, 403, `${path} is blocked before the password change`);
      assert.equal(((await res.json()) as { mustChangePassword?: boolean }).mustChangePassword, true);
    }
    const passes = (r: Response) => r.headers.get("x-middleware-next") === "1";
    assert.ok(passes(await studentMw(req("student", "/api/auth/change-password", st, "POST"))));
    assert.ok(passes(await studentMw(req("student", "/api/auth/logout", st, "POST"))));
    const page = await studentMw(req("student", "/dashboard", st));
    assert.ok(page.headers.get("location")?.endsWith("/change-password"));
  }

  // --- H1/H2: rotation script core --------------------------------------------------
  {
    const onDefault = await mkUser("ah_rot_default", "STUDENT", { passwordHash: await hashPassword("Student@2026") });
    const onLegacy = await mkUser("ah_rot_legacy", "STUDENT", {
      studentId: "2099-950777",
      passwordHash: await hashPassword(legacyStudentDefaultPassword("2099-950777")!),
    });
    const safe = await mkUser("ah_rot_safe", "STUDENT");
    const noPw = await mkUser("ah_rot_nopw", "TEACHER", { passwordHash: null });
    const stolen = (await login(onDefault.email, "Student@2026")).tokenToSet!;
    assert.ok(stolen);

    const { candidates, unknownEmails } = await findRotationCandidates({
      knownDefaults: true,
      noPassword: true,
      emails: [safe.email, "ah.missing@apc.edu.ph"],
    });
    const reasonOf = (id: string) => candidates.find((c) => c.id === id)?.reason;
    assert.equal(reasonOf(onDefault.id), "known-default");
    assert.equal(reasonOf(onLegacy.id), "legacy-formula");
    assert.equal(reasonOf(noPw.id), "no-password");
    assert.equal(reasonOf(safe.id), "requested");
    assert.deepEqual(unknownEmails, ["ah.missing@apc.edu.ph"]);
    assert.ok(candidates.some((c) => c.email === "admin@apc.edu.ph"), "the seeded demo admin is flagged");

    const onlyKnown = (await findRotationCandidates({ knownDefaults: true })).candidates;
    assert.ok(!onlyKnown.some((c) => c.id === safe.id), "accounts on a personal password are left alone");

    const issued = await issueTemporaryPasswords(candidates.filter((c) => [onDefault.id, onLegacy.id].includes(c.id)));
    assert.equal(issued.length, 2);
    assert.equal((await login(onDefault.email, "Student@2026")).status, 401, "the published password is dead");
    assert.equal((await login(onDefault.email, issued.find((i) => i.id === onDefault.id)!.temporaryPassword)).status, 200);
    const { getValidatedSession } = await import("../portal-auth");
    assert.equal(await getValidatedSession(stolen, "student"), null, "sessions on the old password end");
  }

  resetRateLimits();
}
