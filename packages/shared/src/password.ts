import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export function generateDefaultPassword(studentId?: string | null): string {
  if (studentId && studentId.trim().length > 0) {
    const clean = studentId.replace(/[^a-zA-Z0-9]/g, "");
    return `RizLife@${clean.slice(-6) || "2026"}`;
  }
  return "RizLife@2026";
}
