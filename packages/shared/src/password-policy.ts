/**
 * Password rules shared by server and browser code. No Node-only imports here:
 * validation.ts (bundled into client components) depends on this file.
 */

/** Minimum length for every password a person chooses (L10: one rule everywhere). */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Temporary passwords stop working after this long if they haven't been changed. */
export const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Passwords that were published in this repository (seed SQL, README, UI defaults).
 * They can never be chosen again, and the rotation script looks for accounts still on them.
 */
export const KNOWN_DEFAULT_PASSWORDS = [
  "Student@2026",
  "Teacher@RizLife2026",
  "Admin@RizLife2026",
  "RizLife@2026",
] as const;

/** The old, guessable formula ("RizLife@" + last 6 alphanumerics of the student ID). */
export function legacyStudentDefaultPassword(studentId: string | null | undefined): string | null {
  if (!studentId?.trim()) return null;
  const clean = studentId.replace(/[^a-zA-Z0-9]/g, "");
  return `RizLife@${clean.slice(-6) || "2026"}`;
}

export function isKnownDefaultPassword(plain: string, studentId?: string | null): boolean {
  const normalized = plain.trim().toLowerCase();
  return (
    KNOWN_DEFAULT_PASSWORDS.some((p) => p.toLowerCase() === normalized) ||
    legacyStudentDefaultPassword(studentId)?.toLowerCase() === normalized
  );
}
