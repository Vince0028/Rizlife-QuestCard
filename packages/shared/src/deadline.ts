import type { SubmissionStatusValue } from "./types";

/**
 * Quest deadline state, shared by the student To-Do List, the overdue banner, and the
 * Quest Card. Calendar days are counted in Asia/Manila so "today" is the same on every
 * device and server (APC is in the Philippines).
 */

export const QUEST_DEADLINE_TIME_ZONE = "Asia/Manila";
export const DEFAULT_DUE_SOON_DAYS = 3;

export type DeadlineStateKind =
  | "CLEARED"
  | "NO_DEADLINE"
  | "OVERDUE"
  | "DUE_TODAY"
  | "DUE_SOON"
  | "UPCOMING";

export interface QuestDeadlineState {
  kind: DeadlineStateKind;
  deadline: Date | null;
  /** Manila calendar days since the deadline (OVERDUE only; 0 = earlier today). */
  daysOverdue?: number;
  /** Manila calendar days until the deadline (DUE_TODAY / DUE_SOON / UPCOMING). */
  daysLeft?: number;
  /** Short state label: "Overdue", "Due today", "Due tomorrow", "Due in N days". */
  label: string;
  /** Full sentence with date + time, e.g. "Was due Nov 20, 2026, 11:59 PM · 3 days ago". */
  detail: string;
  /** Compact form for chips, e.g. "was due Nov 20, 11:59 PM". */
  shortDetail: string;
  /** Relative phrase, e.g. "3 days ago", "earlier today", "tomorrow"; null when not applicable. */
  relative: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: QUEST_DEADLINE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: QUEST_DEADLINE_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: QUEST_DEADLINE_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: QUEST_DEADLINE_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

function parseDeadline(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Day index (days since epoch) of the Manila calendar date containing `d`. */
function manilaDayIndex(d: Date): number {
  const parts = dayKeyFormatter.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Math.round(Date.UTC(get("year"), get("month") - 1, get("day")) / DAY_MS);
}

/** "Nov 20, 2026, 11:59 PM" in Manila time; "No deadline" when missing/invalid. */
export function formatQuestDeadline(
  value: string | Date | null | undefined,
  { includeYear = true }: { includeYear?: boolean } = {}
): string {
  const d = parseDeadline(value);
  if (!d) return "No deadline";
  return (includeYear ? dateTimeFormatter : shortDateTimeFormatter).format(d);
}

/**
 * Server-side formatting must never depend on the host's timezone (Vercel runs in UTC).
 * These mirror `toLocaleDateString("en-PH")` / `toLocaleString("en-PH")` but always in
 * Asia/Manila. Missing or invalid values give "".
 */
export function formatManilaDate(value: string | Date | null | undefined): string {
  const d = parseDeadline(value);
  return d ? d.toLocaleDateString("en-PH", { timeZone: QUEST_DEADLINE_TIME_ZONE }) : "";
}

export function formatManilaDateTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = parseDeadline(value);
  return d
    ? d.toLocaleString("en-PH", { ...options, timeZone: QUEST_DEADLINE_TIME_ZONE })
    : "";
}

/** "11:59 PM" in Manila time. */
export function formatQuestDeadlineTime(value: string | Date | null | undefined): string {
  const d = parseDeadline(value);
  return d ? timeFormatter.format(d) : "";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function getQuestDeadlineState(
  deadlineValue: string | Date | null | undefined,
  status: SubmissionStatusValue,
  now: Date = new Date(),
  { soonDays = DEFAULT_DUE_SOON_DAYS }: { soonDays?: number } = {}
): QuestDeadlineState {
  const deadline = parseDeadline(deadlineValue);

  if (status === "STAMPED" || status === "PENDING_REVIEW") {
    return {
      kind: "CLEARED",
      deadline,
      label: "Submitted",
      detail: deadline ? `Due ${formatQuestDeadline(deadline)}` : "No deadline",
      shortDetail: deadline
        ? `due ${formatQuestDeadline(deadline, { includeYear: false })}`
        : "no deadline",
      relative: null,
    };
  }

  if (!deadline) {
    return {
      kind: "NO_DEADLINE",
      deadline: null,
      label: "No deadline",
      detail: "No deadline",
      shortDetail: "no deadline",
      relative: null,
    };
  }

  const full = formatQuestDeadline(deadline);
  const short = formatQuestDeadline(deadline, { includeYear: false });
  const time = formatQuestDeadlineTime(deadline);
  const dayDiff = manilaDayIndex(deadline) - manilaDayIndex(now);

  if (deadline.getTime() < now.getTime()) {
    const daysOverdue = Math.max(0, -dayDiff);
    const relative =
      daysOverdue === 0
        ? "earlier today"
        : daysOverdue === 1
        ? "yesterday"
        : `${plural(daysOverdue, "day")} ago`;
    return {
      kind: "OVERDUE",
      deadline,
      daysOverdue,
      label: "Overdue",
      detail: `Was due ${full} · ${relative}`,
      shortDetail:
        daysOverdue === 0 ? `was due today, ${time}` : `was due ${short}`,
      relative,
    };
  }

  if (dayDiff <= 0) {
    return {
      kind: "DUE_TODAY",
      deadline,
      daysLeft: 0,
      label: "Due today",
      detail: `Due today at ${time}`,
      shortDetail: `due today, ${time}`,
      relative: "today",
    };
  }

  const relative = dayDiff === 1 ? "tomorrow" : `in ${plural(dayDiff, "day")}`;
  const label = dayDiff === 1 ? "Due tomorrow" : `Due in ${plural(dayDiff, "day")}`;
  return {
    kind: dayDiff <= soonDays ? "DUE_SOON" : "UPCOMING",
    deadline,
    daysLeft: dayDiff,
    label,
    detail: dayDiff <= soonDays ? `Due ${full} · ${relative}` : `Due ${full}`,
    shortDetail: dayDiff === 1 ? `due tomorrow, ${time}` : `due ${short}`,
    relative,
  };
}
