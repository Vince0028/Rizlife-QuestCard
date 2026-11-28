import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export {
  KNOWN_DEFAULT_PASSWORDS,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  TEMP_PASSWORD_TTL_MS,
  isKnownDefaultPassword,
  legacyStudentDefaultPassword,
} from "./password-policy";

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

// No 0/O, 1/l/I: these get read aloud, copied by hand, or printed on slips.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Random one-time password, e.g. "Rzl-7kq4-m9xt-2hpw" (12 random chars, ~59 bits).
 * The fixed prefix makes it recognizable; the rest is crypto-random.
 */
export function generateTemporaryPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) group += TEMP_ALPHABET[crypto.randomInt(TEMP_ALPHABET.length)];
    groups.push(group);
  }
  return `Rzl-${groups.join("-")}`;
}
