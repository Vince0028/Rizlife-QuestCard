/**
 * H3: sessions are re-checked against the database, so deactivating, deleting, demoting
 * or resetting a user's password ends their existing sessions immediately.
 * M1: the cron endpoint's authorization fails closed.
 */
import assert from "node:assert/strict";
import { prisma } from "../db";
import { signSessionToken, verifySessionToken } from "../auth";
import { hashPassword } from "../password";
import {
  createSessionEndedHandler,
  getValidatedSession,
  performChangePassword,
  performPortalLogin,
} from "../portal-auth";
import { deleteUserAsAdmin, updateUserAsAdmin } from "../admin-service";
import { resetManagedUserPassword } from "../workspace-service";
import { checkCronAuthorization } from "../cron-auth";
import type { PortalKey, SessionPayload } from "../types";

const PASSWORD = "Session@2099";

async function mkUser(id: string, role: "STUDENT" | "TEACHER" | "ADMIN", extra: object = {}) {
  return prisma.user.create({
    data: {
      id,
      firstName: "Sess",
      lastName: id,
      email: `${id}@${role === "STUDENT" ? "student." : ""}apc.edu.ph`,
      role,
      passwordHash: await hashPassword(PASSWORD),
      ...extra,
    },
  });
}

async function login(email: string, portal: PortalKey, password = PASSWORD) {
  const res = await performPortalLogin({ email, password }, portal);
  assert.equal(res.status, 200, `login ${email}: ${JSON.stringify(res.body)}`);
  return res.tokenToSet!;
}

function adminActor(userId: string): SessionPayload {
  return {
    userId, email: `${userId}@apc.edu.ph`, role: "ADMIN", firstName: "A", lastName: "B",
    studentId: null, courseCode: null, mustChangePassword: false, portal: "admin",
  };
}

export async function runSessionRevocationChecks() {
  const admin = await mkUser("sr_admin", "ADMIN");
  const asAdmin = adminActor(admin.id);
  const valid = async (token: string, portal: PortalKey) =>
    (await getValidatedSession(token, portal)) !== null;

  // Deactivation ends the session, and reactivation does not bring the old one back.
  {
    const u = await mkUser("sr_teacher_deact", "TEACHER");
    const token = await login(u.email, "teacher");
    assert.ok(await valid(token, "teacher"), "fresh login is valid");
    await updateUserAsAdmin({ userId: u.id, rawBody: { isActive: false }, actor: asAdmin });
    assert.equal(await valid(token, "teacher"), false, "deactivated user's session is rejected");
    assert.ok(await verifySessionToken(token, "teacher"), "(the signature alone would still pass)");
    await updateUserAsAdmin({ userId: u.id, rawBody: { isActive: true }, actor: asAdmin });
    assert.equal(await valid(token, "teacher"), false, "reactivation doesn't revive old sessions");
    assert.ok(await valid(await login(u.email, "teacher"), "teacher"), "a new login works");
  }

  // Role change: a demoted admin loses the admin and teacher-override sessions at once.
  {
    const u = await mkUser("sr_admin_demote", "ADMIN");
    const adminToken = await login(u.email, "admin");
    const teacherToken = await login(u.email, "teacher");
    await updateUserAsAdmin({ userId: u.id, rawBody: { role: "TEACHER" }, actor: asAdmin });
    assert.equal(await valid(adminToken, "admin"), false, "demoted admin loses the admin portal");
    assert.equal(await valid(teacherToken, "teacher"), false, "and the old teacher-portal session");
  }

  // Role drift without a version bump (e.g. a direct DB edit) is still caught.
  {
    const u = await mkUser("sr_role_drift", "ADMIN");
    const token = await login(u.email, "admin");
    await prisma.user.update({ where: { id: u.id }, data: { role: "TEACHER" } });
    assert.equal(await valid(token, "admin"), false, "role mismatch is rejected");
  }

  // Deletion.
  {
    const u = await mkUser("sr_student_del", "STUDENT");
    const token = await login(u.email, "student");
    await deleteUserAsAdmin({ userId: u.id, actor: asAdmin });
    assert.equal(await valid(token, "student"), false, "deleted user's session is rejected");
  }

  // Admin/teacher password reset: old sessions end, and an old session can't be used
  // to set a new password (mustChangePassword would skip the current-password check).
  {
    const u = await mkUser("sr_student_reset", "STUDENT");
    const stolen = await login(u.email, "student");
    await resetManagedUserPassword({ targetUserId: u.id, newPassword: "Temp@2099x", actor: asAdmin });
    assert.equal(await valid(stolen, "student"), false, "reset ends existing sessions");
    const hijack = await performChangePassword(stolen, "student", {
      newPassword: "Attacker@2099", confirmPassword: "Attacker@2099",
    });
    assert.equal(hijack.status, 401, "a pre-reset session can't change the password");

    // The student signs in with the temporary password and changes it.
    const tempSession = await login(u.email, "student", "Temp@2099x");
    const otherDevice = await login(u.email, "student", "Temp@2099x");
    const changed = await performChangePassword(tempSession, "student", {
      newPassword: "Mine@20990", confirmPassword: "Mine@20990",
    });
    assert.equal(changed.status, 200);
    assert.ok(await valid(changed.tokenToSet!, "student"), "the browser that changed it stays signed in");
    assert.equal(await valid(tempSession, "student"), false, "its old token is replaced");
    assert.equal(await valid(otherDevice, "student"), false, "other devices are signed out");
  }

  // Tokens issued before this change (no `sv` claim) stay valid until something revokes them.
  {
    const u = await mkUser("sr_legacy", "TEACHER");
    const legacy = await signSessionToken({
      userId: u.id, email: u.email, role: "TEACHER", firstName: "Sess", lastName: u.id,
      studentId: null, courseCode: null, mustChangePassword: false, portal: "teacher",
    });
    assert.ok(await valid(legacy, "teacher"), "pre-existing sessions keep working after deploy");
  }

  // SSO sessions aren't blocked by a pending temporary password; password sessions are.
  {
    const u = await mkUser("sr_sso", "STUDENT", { mustChangePassword: true });
    const base = {
      userId: u.id, email: u.email, role: "STUDENT" as const, firstName: "Sess", lastName: u.id,
      studentId: null, courseCode: null, mustChangePassword: false, portal: "student" as const,
      sessionVersion: 0,
    };
    const sso = await getValidatedSession(await signSessionToken({ ...base, authMethod: "sso" }), "student");
    assert.ok(sso, "SSO session valid despite a pending temp password");
    assert.equal(sso!.mustChangePassword, false);
    assert.equal(
      await getValidatedSession(await signSessionToken({ ...base, authMethod: "password" }), "student"),
      null,
      "a password session that skipped the forced change is rejected"
    );
  }

  // The session-ended route clears the cookie and lands on the login page.
  {
    const res = await createSessionEndedHandler("teacher")(
      new Request("http://localhost:3002/api/auth/session-ended")
    );
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "http://localhost:3002/login?error=session_expired");
    assert.match(res.headers.get("set-cookie") ?? "", /rizlife_teacher_session=;.*Max-Age=0/i);
  }

  // M1: cron authorization fails closed.
  {
    const good = "0123456789abcdef0123456789abcdef";
    assert.deepEqual(checkCronAuthorization(`Bearer ${good}`, good), { ok: true });
    for (const secret of [undefined, "", "   ", "short", "replace-with-cron-secret"]) {
      const r = checkCronAuthorization(`Bearer ${secret ?? ""}`, secret);
      assert.equal(r.ok, false, `secret ${JSON.stringify(secret)} must not open the endpoint`);
      assert.equal(!r.ok && r.status, 503);
    }
    for (const header of [null, "", good, `Bearer ${good}x`, `bearer ${good}`, `Bearer ${good.slice(1)}`]) {
      const r = checkCronAuthorization(header, good);
      assert.equal(!r.ok && r.status, 401, `header ${JSON.stringify(header)} is rejected`);
    }
  }
}
