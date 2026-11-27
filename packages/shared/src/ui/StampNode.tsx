"use client";

import React from "react";
import { Feather, Clock, AlertTriangle } from "lucide-react";
import type { QuestCategoryValue, SubmissionStatusValue } from "../types";
import { QUEST_CATEGORY_LABELS } from "../types";

interface StampNodeProps {
  taskNumber: number;
  title: string;
  category: QuestCategoryValue;
  status: SubmissionStatusValue;
  isOverdue?: boolean;
  onClick: () => void;
}

export function StampNode({
  taskNumber,
  title,
  category,
  status,
  isOverdue = false,
  onClick,
}: StampNodeProps) {
  const isStamped = status === "STAMPED";
  const isPending = status === "PENDING_REVIEW";
  const isRevision = status === "NEEDS_REVISION";

  const cardRingClass = isStamped
    ? "border-[#15803D]/50 bg-[#DCFCE7]/45 hover:border-[#15803D]"
    : isPending
    ? "border-[#B4843E]/60 bg-[#FEF3C7]/45 hover:border-[#B4843E]"
    : isRevision
    ? "border-[#B91C1C]/50 bg-[#FEE2E2]/45 hover:border-[#B91C1C]"
    : "border-[#D8CBB8] bg-[#FAF7F2] hover:border-[#2C2520]/50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center rounded-xl border p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${cardRingClass}`}
    >
      {isOverdue && !isStamped && !isPending && (
        <span className="absolute right-1.5 top-1.5 rounded-sm bg-[#FEE2E2] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#B91C1C]">
          Overdue
        </span>
      )}

      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-105 ${
          isStamped
            ? "animate-stamp-press border-[#15803D] bg-[#15803D] text-white shadow-sm ring-2 ring-[#15803D]/25 ring-offset-2 ring-offset-[#FAF7F2]"
            : isPending
            ? "border-dashed border-[#B4843E] bg-[#FEF3C7] text-[#92400E]"
            : isRevision
            ? "border-dashed border-[#B91C1C] bg-[#FEE2E2] text-[#B91C1C]"
            : "border-dashed border-[#4A4540]/40 bg-[#F4EFE6] text-[#4A4540]"
        }`}
      >
        {isStamped ? (
          <div className="flex flex-col items-center">
            <Feather className="h-5 w-5" />
            <span className="mt-0.5 font-mono text-[10px] font-bold">
              #{taskNumber}
            </span>
          </div>
        ) : isPending ? (
          <div className="flex flex-col items-center">
            <Clock className="h-4 w-4" />
            <span className="mt-0.5 font-mono text-[11px] font-bold">
              {taskNumber}
            </span>
          </div>
        ) : isRevision ? (
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-4 w-4" />
            <span className="mt-0.5 font-mono text-[11px] font-bold">
              {taskNumber}
            </span>
          </div>
        ) : (
          <span className="font-display text-lg font-bold">{taskNumber}</span>
        )}
      </div>

      <span className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-[#2C2520]">
        {title}
      </span>
      <span className="mt-1 text-[10px] font-medium text-[#6B5E53]">
        {QUEST_CATEGORY_LABELS[category]}
      </span>
    </button>
  );
}
