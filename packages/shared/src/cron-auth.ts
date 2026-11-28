/**
 * Authorization for scheduled endpoints (GET /api/cron/digest on the teacher portal).
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set on the
 * project. This fails closed: with no usable secret configured, every call is refused.
 */
import crypto from "node:crypto";

const MIN_SECRET_LENGTH = 16;
/** Values from .env.example that must never count as a real secret. */
const PLACEHOLDER_SECRETS = new Set(["replace-with-cron-secret"]);

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function checkCronAuthorization(
  authorizationHeader: string | null,
  secret: string | undefined = process.env.CRON_SECRET
): CronAuthResult {
  const expected = secret?.trim() ?? "";
  if (expected.length < MIN_SECRET_LENGTH || PLACEHOLDER_SECRETS.has(expected)) {
    return {
      ok: false,
      status: 503,
      error:
        "Cron is disabled: set CRON_SECRET (a random string of at least 16 characters) on this deployment.",
    };
  }
  const given = Buffer.from(authorizationHeader ?? "");
  const wanted = Buffer.from(`Bearer ${expected}`);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    return { ok: false, status: 401, error: "Unauthorized cron invocation" };
  }
  return { ok: true };
}
