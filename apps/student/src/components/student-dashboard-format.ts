/** Pure formatting helpers for the student dashboard. */
import type { DeadlineStateKind } from "@rizlife/shared/deadline";

/** Text colour for a deadline line, by deadline state. */
export function deadlineToneClass(kind: DeadlineStateKind): string {
  if (kind === "OVERDUE") return "font-semibold text-[#A92B2C]";
  if (kind === "DUE_TODAY" || kind === "DUE_SOON") return "font-semibold text-[#92400E]";
  return "";
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return "Open";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Open";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
