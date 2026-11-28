/** Pure formatting helpers for the teacher/admin workspace UI. */

export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDeliveryLabel(status: string): string {
  if (status === "SENT") return "Sent to Outlook";
  if (status === "PREVIEW_ONLY") return "Saved Email Preview";
  return "Delivery Failed";
}

export function formatTriggerLabel(trigger: string): string {
  if (trigger === "THRESHOLD") return "Auto-sent at batch threshold";
  if (trigger === "SCHEDULED") return "Daily scheduled digest";
  return "Sent manually by teacher";
}
