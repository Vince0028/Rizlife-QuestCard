/**
 * Finding and fixing accounts whose password anyone could know (used by
 * scripts/temp-passwords.ts). Tested in __tests__/auth-hardening.ts.
 */
import { prisma } from "./db";
import {
  KNOWN_DEFAULT_PASSWORDS,
  legacyStudentDefaultPassword,
  verifyPassword,
} from "./password";
import { issueTemporaryPassword } from "./workspace-service";

export interface RotationCandidate {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  reason: "known-default" | "legacy-formula" | "no-password" | "requested";
}

export async function findRotationCandidates(selection: {
  emails?: string[];
  knownDefaults?: boolean;
  noPassword?: boolean;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ candidates: RotationCandidate[]; unknownEmails: string[] }> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      studentId: true,
      passwordHash: true,
      isActive: true,
    },
    orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
  const found = new Map<string, RotationCandidate>();
  const pick = (u: (typeof users)[number], reason: RotationCandidate["reason"]) => {
    if (!found.has(u.id)) {
      found.set(u.id, {
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
        reason,
      });
    }
  };

  const wanted = (selection.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const unknownEmails = wanted.filter((e) => !byEmail.has(e));
  for (const e of wanted) {
    const u = byEmail.get(e);
    if (u) pick(u, "requested");
  }

  if (selection.noPassword) {
    for (const u of users) if (u.isActive && !u.passwordHash) pick(u, "no-password");
  }

  if (selection.knownDefaults) {
    let done = 0;
    for (const u of users) {
      done += 1;
      selection.onProgress?.(done, users.length);
      if (!u.passwordHash) continue;
      let reason: RotationCandidate["reason"] | null = null;
      for (const pw of KNOWN_DEFAULT_PASSWORDS) {
        if (await verifyPassword(pw, u.passwordHash)) {
          reason = "known-default";
          break;
        }
      }
      const legacy = legacyStudentDefaultPassword(u.studentId);
      if (!reason && legacy && (await verifyPassword(legacy, u.passwordHash))) {
        reason = "legacy-formula";
      }
      if (reason) pick(u, reason);
    }
  }

  return { candidates: [...found.values()], unknownEmails };
}

/** Issues a random temporary password to each candidate (also ends their sessions). */
export async function issueTemporaryPasswords(candidates: RotationCandidate[]) {
  const issued: (RotationCandidate & { temporaryPassword: string; expiresAt: string })[] = [];
  for (const c of candidates) {
    issued.push({ ...c, ...(await issueTemporaryPassword(c.id)) });
  }
  return issued;
}
