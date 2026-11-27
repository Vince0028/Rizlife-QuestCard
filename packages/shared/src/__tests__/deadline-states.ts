/**
 * Quest deadline state checks (Overdue / Due today / Due soon), all with a fixed `now`.
 * Calendar days are Asia/Manila (UTC+8), so the UTC/Manila day boundary is covered too.
 */
import assert from "node:assert/strict";
import { formatQuestDeadline, getQuestDeadlineState } from "../deadline";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export function runDeadlineStateChecks() {
  // 2026-11-27 16:00 in Manila.
  const now = new Date("2026-11-27T08:00:00.000Z");
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
  const state = (deadline: string | null, status = "NOT_STARTED" as const) =>
    getQuestDeadlineState(deadline, status, now);

  // Overdue
  const justPast = state(at(-1 * MIN));
  assert.equal(justPast.kind, "OVERDUE", "1 min past deadline is overdue");
  assert.equal(justPast.daysOverdue, 0);
  assert.equal(justPast.label, "Overdue");

  const threeDaysAgo = state(at(-3 * DAY));
  assert.equal(threeDaysAgo.kind, "OVERDUE");
  assert.equal(threeDaysAgo.daysOverdue, 3);
  assert.ok(threeDaysAgo.detail.startsWith("Was due Nov 24, 2026"), threeDaysAgo.detail);
  assert.ok(threeDaysAgo.detail.endsWith("3 days ago"), threeDaysAgo.detail);

  // Manila midnight boundary: due 23:59 on the 26th (Manila), now 00:01 on the 27th.
  const yesterday = getQuestDeadlineState(
    "2026-11-26T15:59:00.000Z",
    "NOT_STARTED",
    new Date("2026-11-26T16:01:00.000Z")
  );
  assert.equal(yesterday.kind, "OVERDUE");
  assert.equal(yesterday.daysOverdue, 1, "Manila calendar day already rolled over");
  assert.equal(yesterday.relative, "yesterday");

  // Due today: 23:59 Manila on the 27th (15:59Z, still the 27th in UTC as well).
  const today = state("2026-11-27T15:59:00.000Z");
  assert.equal(today.kind, "DUE_TODAY");
  assert.equal(today.daysLeft, 0);
  assert.equal(today.label, "Due today");
  assert.ok(today.detail.startsWith("Due today at 11:59"), today.detail);

  // 00:30 Manila on the 28th is still Nov 27 in UTC, but it is "tomorrow" in Manila.
  const tomorrow = state("2026-11-27T16:30:00.000Z");
  assert.equal(tomorrow.kind, "DUE_SOON", "UTC+8 boundary: not due today");
  assert.equal(tomorrow.daysLeft, 1);
  assert.equal(tomorrow.label, "Due tomorrow");

  const inTwoDays = state(at(2 * DAY));
  assert.equal(inTwoDays.kind, "DUE_SOON");
  assert.equal(inTwoDays.label, "Due in 2 days");

  assert.equal(state(at(3 * DAY)).kind, "DUE_SOON", "3 days away is still due soon");
  assert.equal(state(at(4 * DAY)).kind, "UPCOMING");
  const later = state(at(10 * DAY));
  assert.equal(later.kind, "UPCOMING");
  assert.equal(later.daysLeft, 10);
  assert.equal(
    getQuestDeadlineState(at(4 * DAY), "NOT_STARTED", now, { soonDays: 5 }).kind,
    "DUE_SOON",
    "soonDays is configurable"
  );

  // No / invalid deadline
  assert.equal(state(null).kind, "NO_DEADLINE");
  assert.equal(state("not-a-date").kind, "NO_DEADLINE");

  // Submitted work clears the deadline; a revision request does not.
  const past = at(-2 * DAY);
  assert.equal(getQuestDeadlineState(past, "STAMPED", now).kind, "CLEARED");
  assert.equal(getQuestDeadlineState(past, "PENDING_REVIEW", now).kind, "CLEARED");
  assert.equal(getQuestDeadlineState(null, "STAMPED", now).kind, "CLEARED");
  assert.equal(getQuestDeadlineState(past, "NEEDS_REVISION", now).kind, "OVERDUE");

  // Formatting is in Manila time, with the time of day included.
  const formatted = formatQuestDeadline("2026-11-27T15:59:00.000Z").replace(/\s/g, " ");
  assert.ok(formatted.includes("Nov 27, 2026"), formatted);
  assert.ok(formatted.includes("11:59"), formatted);
  assert.ok(/PM/i.test(formatted), formatted);
  assert.equal(formatQuestDeadline(null), "No deadline");
}
