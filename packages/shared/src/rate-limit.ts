/**
 * In-memory sliding-window limiter for sign-in attempts.
 *
 * Best effort: each serverless instance keeps its own counters, so a determined
 * attacker spread across instances gets more tries. The per-account lockout stored in
 * the database (User.failedLoginCount / lockedUntil) is the cross-instance backstop.
 */
interface Window {
  hits: number[];
}

const windows = new Map<string, Window>();
let lastSweep = Date.now();

function sweep(now: number, maxWindowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of windows) {
    w.hits = w.hits.filter((t) => now - t < maxWindowMs);
    if (w.hits.length === 0) windows.delete(key);
  }
}

/**
 * Records one attempt for `key` and reports whether it's within `limit` attempts per
 * `windowMs`. Attempts over the limit are still recorded, so hammering keeps it closed.
 */
export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now, windowMs);
  const w = windows.get(key) ?? { hits: [] };
  w.hits = w.hits.filter((t) => now - t < windowMs);
  w.hits.push(now);
  windows.set(key, w);
  return w.hits.length <= limit;
}

/** Test helper: forget every counter. */
export function resetRateLimits() {
  windows.clear();
}
