"use client";

import React from "react";
import {
  AlarmClock,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Hourglass,
} from "lucide-react";
import type { DeadlineStateKind } from "../deadline";
import type { SubmissionStatusValue } from "../types";
import { SUBMISSION_STATUS_LABELS } from "../types";

export function StatusBadge({
  status,
  deadlineKind,
}: {
  status: SubmissionStatusValue;
  /** Student-side only: replaces "Not Started" with Overdue / Due Today / Due Soon. */
  deadlineKind?: DeadlineStateKind;
}) {
  if (status === "NOT_STARTED" && deadlineKind === "OVERDUE") {
    return (
      <span className="inline-flex items-center gap-1 border border-[#A92B2C] bg-[#FEE2E2] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#7F1D1D]">
        <AlertTriangle className="h-3 w-3" />
        Overdue
      </span>
    );
  }
  if (status === "NOT_STARTED" && deadlineKind === "DUE_TODAY") {
    return (
      <span className="inline-flex items-center gap-1 border border-[#D97706] bg-[#FEF3C7] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
        <AlarmClock className="h-3 w-3" />
        Due Today
      </span>
    );
  }
  if (status === "NOT_STARTED" && deadlineKind === "DUE_SOON") {
    return (
      <span className="inline-flex items-center gap-1 border border-[#D97706] bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#92400E]">
        <Hourglass className="h-3 w-3" />
        Due Soon
      </span>
    );
  }
  if (status === "STAMPED") {
    return (
      <span className="inline-flex items-center gap-1 border border-[#0E8F47] bg-[#DCFCE7] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#09592C]">
        <CheckCircle2 className="h-3 w-3" />
        {SUBMISSION_STATUS_LABELS[status]}
      </span>
    );
  }
  if (status === "PENDING_REVIEW") {
    return (
      <span className="inline-flex items-center gap-1 border border-[#B4843E] bg-[#FEF3C7] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#78350F]">
        <Clock className="h-3 w-3" />
        {SUBMISSION_STATUS_LABELS[status]}
      </span>
    );
  }
  if (status === "NEEDS_REVISION") {
    return (
      <span className="inline-flex items-center gap-1 border border-[#A92B2C] bg-[#FEE2E2] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#7F1D1D]">
        <AlertTriangle className="h-3 w-3" />
        {SUBMISSION_STATUS_LABELS[status]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 border border-[#B5A07D] bg-[#EFE6D2] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#4A4540]">
      <CircleDashed className="h-3 w-3" />
      {SUBMISSION_STATUS_LABELS[status]}
    </span>
  );
}
