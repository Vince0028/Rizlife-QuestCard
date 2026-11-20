"use client";

import React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import type { QuestCategoryValue, SubmissionStatusValue } from "../types";
import { QUEST_CATEGORY_LABELS } from "../types";

interface RizalStampCircleProps {
  taskNumber: number;
  title: string;
  category: QuestCategoryValue;
  status: SubmissionStatusValue;
  isOverdue?: boolean;
  showTitle?: boolean;
  justStamped?: boolean;
  justUnstamped?: boolean;
  selected?: boolean;
  onClick: () => void;
}

// Deterministic hand-stamped angles & offsets so each stamp lands uniquely like a real rubber stamp
const STAMP_VARIATIONS: { rotate: number; dx: number; dy: number }[] = [
  { rotate: -14, dx: -3, dy: -2 },
  { rotate: 11, dx: 3, dy: -1 },
  { rotate: -7, dx: -2, dy: 3 },
  { rotate: 16, dx: 2, dy: 2 },
  { rotate: -18, dx: 4, dy: -3 },
  { rotate: 8, dx: -3, dy: 2 },
  { rotate: -11, dx: 2, dy: -3 },
  { rotate: 14, dx: -4, dy: -1 },
  { rotate: -5, dx: 3, dy: 3 },
  { rotate: 19, dx: -2, dy: -2 },
  { rotate: -15, dx: -3, dy: 2 },
  { rotate: 9, dx: 4, dy: 1 },
];

export function RizalPisoStampGraphic({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      {/* Outer serrated coin / rubber-stamp ink rim */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="#FAF6EC"
        strokeWidth="2.5"
        strokeDasharray="5 2.2"
        opacity="0.92"
      />
      {/* Inner coin ring */}
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="#FAF6EC"
        strokeWidth="1.6"
        opacity="0.88"
      />

      {/* Left & Right Piso Stars */}
      <text
        x="15"
        y="53"
        fill="#FAF6EC"
        fontSize="8"
        fontWeight="bold"
        textAnchor="middle"
      >
        ★
      </text>
      <text
        x="85"
        y="53"
        fill="#FAF6EC"
        fontSize="8"
        fontWeight="bold"
        textAnchor="middle"
      >
        ★
      </text>

      {/* Top Stamp Label */}
      <text
        x="50"
        y="21"
        fill="#FAF6EC"
        fontSize="7.2"
        fontWeight="900"
        letterSpacing="1.6"
        textAnchor="middle"
        fontFamily="Cinzel, Georgia, serif"
      >
        JOSE RIZAL
      </text>

      {/* Iconic 1-Peso Coin Left-Facing Side Profile Bust of Dr. José Rizal */}
      <g fill="#FAF6EC">
        {/* Coiffed swept-back hair & crown */}
        <path d="M40 27 C45 23, 56 24, 61 30 C64 34, 65 41, 62 47 C60 44, 59 40, 56 38 C53 35, 48 34, 43 36 C41 33, 39 30, 40 27 Z" />
        {/* Signature side-part hair wave at forehead */}
        <path d="M38 32 C41 26, 49 25, 55 28 C51 30, 44 31, 39 35 Z" />
        {/* Head & facial profile (left-facing: forehead, nose bridge, mustache/lips, chin, jaw, ear) */}
        <path d="M41 33 C39 36, 39 39, 36 43 C34.8 44.5, 34.8 45.8, 36.8 46.5 C36.2 47.8, 35.8 49, 37.2 50 C36.4 51, 36.8 52.2, 38 53 C37.5 55.2, 39.2 57.2, 42.5 57.2 L46 57.2 L46 62 L56 62 L57 54 C60 52, 61.5 48, 61 44 C59 40, 56 34, 49 32 C45 31, 42 31.5, 41 33 Z" />
        {/* Ear & cheek relief cutout in emerald stamp ink */}
        <path
          d="M52 44 C54 44, 55 46, 54.5 49 C54 51, 52.2 51.5, 51.5 49.5 Z"
          fill="#0B8F41"
        />
        {/* Eye & brow relief line */}
        <path
          d="M40.5 40.5 L44.5 41.2 L42.5 42.8 Z"
          fill="#0B8F41"
        />
        {/* Subtle mustache accent */}
        <path
          d="M36.5 48.3 C38.5 48, 40.8 48.6, 41.8 49.6 C40 49.8, 37.8 49.5, 36.5 48.3 Z"
          fill="#0B8F41"
        />
        {/* High 1890s Wing Collar & Cravat */}
        <path d="M44 59 L57 59 L59 64 L42 64 Z" />
        {/* Overcoat Shoulders & Lapels (Piso bust base) */}
        <path d="M29 74 C31 66, 37 63, 43 62 L49 71 L55 62 C62 63, 68 67, 70 74 Z" />
        {/* Lapel V-notch detail */}
        <path
          d="M46 62 L49.5 69 L53 62 Z"
          fill="#0B8F41"
        />
      </g>

      {/* Bottom Stamp Ribbon Text */}
      <text
        x="50"
        y="84"
        fill="#FAF6EC"
        fontSize="6.8"
        fontWeight="900"
        letterSpacing="1.8"
        textAnchor="middle"
        fontFamily="Cinzel, Georgia, serif"
      >
        STAMPED
      </text>
    </svg>
  );
}

export function RizalStampCircle({
  taskNumber,
  title,
  category,
  status,
  isOverdue = false,
  showTitle = false,
  justStamped = false,
  justUnstamped = false,
  selected = false,
  onClick,
}: RizalStampCircleProps) {
  const isStamped = status === "STAMPED";
  const isPending = status === "PENDING_REVIEW";
  const isRevision = status === "NEEDS_REVISION";

  const unstartedBg =
    taskNumber % 2 === 1
      ? "bg-[#4F453F] text-[#FAF7F2]"
      : "bg-[#C7A582] text-[#FAF7F2]";

  // Deterministic organic hand-stamped offset & tilt per taskNumber
  const variation =
    STAMP_VARIATIONS[(taskNumber * 7 + 3) % STAMP_VARIATIONS.length];

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Task #${taskNumber}: ${title} (${QUEST_CATEGORY_LABELS[category]})`}
      className={`group relative flex flex-col items-center p-1.5 text-center transition-all cursor-pointer ${
        selected
          ? "bg-[#16192C]/10 ring-2 ring-[#16192C]"
          : "hover:bg-[#16192C]/5"
      }`}
    >
      <div className="relative flex h-16 w-16 sm:h-[70px] sm:w-[70px] items-center justify-center">
        {/* Faint underlying circle slot on the postcard */}
        <div
          className={`absolute inset-0 rounded-full ${
            isStamped
              ? "border border-dashed border-[#8C775B]/50 bg-[#E6DAC3]/55"
              : ""
          }`}
        />

        {justStamped && isStamped && (
          <span
            aria-hidden="true"
            className="animate-ink-burst pointer-events-none absolute inset-0 rounded-full border-4 border-[#0B8F41]"
          />
        )}

        {justUnstamped && !isStamped && (
          <>
            <span
              aria-hidden="true"
              className="animate-ink-burst pointer-events-none absolute inset-0 rounded-full border-3 border-dashed border-[#A92B2C]/70"
            />
            <div
              aria-hidden="true"
              style={{
                transform: `translate(${variation.dx}px, ${variation.dy}px) rotate(${variation.rotate}deg)`,
              }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
              <div className="animate-stamp-remove flex h-16 w-16 sm:h-[68px] sm:w-[68px] items-center justify-center rounded-full bg-[#0B8F41] text-[#FAF6EC] ring-2 ring-[#086B30]">
                <RizalPisoStampGraphic className="h-[62px] w-[62px] sm:h-[64px] sm:w-[64px]" />
              </div>
            </div>
          </>
        )}

        {isStamped ? (
          <div
            style={{
              transform: `translate(${variation.dx}px, ${variation.dy}px) rotate(${variation.rotate}deg)`,
            }}
            className="relative flex h-16 w-16 sm:h-[68px] sm:w-[68px] items-center justify-center"
          >
            <div
              className={`relative flex h-full w-full items-center justify-center rounded-full bg-[#0B8F41] text-[#FAF6EC] shadow-[2px_3px_0_rgba(22,25,44,0.22)] ring-2 ring-[#086B30] transition-transform group-hover:scale-105 ${
                justStamped ? "animate-rubber-stamp" : "animate-stamp-press"
              }`}
            >
              <RizalPisoStampGraphic className="h-[62px] w-[62px] sm:h-[64px] sm:w-[64px]" />
              <span
                style={{ transform: `rotate(${-variation.rotate}deg)` }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#FAF6EC] bg-[#16192C] font-mono text-[9px] font-bold text-[#D4AB50]"
              >
                {taskNumber}
              </span>
            </div>
          </div>
        ) : (
          <div
            className={`relative flex h-16 w-16 sm:h-[68px] sm:w-[68px] flex-col items-center justify-center rounded-full transition-transform group-hover:scale-105 ${
              justUnstamped ? "animate-stamp-cleared-pop " : ""
            }${
              isPending
                ? "animate-pending-pulse bg-[#D99B38] text-white shadow-[2px_3px_0_#9E7847] ring-2 ring-[#FEF3C7]"
                : isRevision
                ? "bg-[#C53030] text-white shadow-[2px_3px_0_#7F1D1D] ring-2 ring-[#FEE2E2]"
                : `${unstartedBg} shadow-[1px_2px_0_rgba(44,37,32,0.18)]`
            }`}
          >
            {isPending ? (
              <>
                <Clock className="h-4 w-4 opacity-95" />
                <span className="font-display text-lg font-bold leading-none mt-0.5">
                  {taskNumber}
                </span>
                <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wider">
                  CHECK
                </span>
              </>
            ) : isRevision ? (
              <>
                <AlertTriangle className="h-4 w-4 opacity-95" />
                <span className="font-display text-lg font-bold leading-none mt-0.5">
                  {taskNumber}
                </span>
                <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wider">
                  REVISE
                </span>
              </>
            ) : (
              <span className="font-display text-2xl font-bold tracking-tight">
                {taskNumber}
              </span>
            )}
          </div>
        )}

        {isOverdue && status === "NOT_STARTED" && (
          <span className="absolute -bottom-1 bg-[#FEE2E2] px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-[#B91C1C] border border-[#B91C1C]/30">
            Due
          </span>
        )}
      </div>

      {showTitle && (
        <div className="mt-1.5 w-full max-w-[92px]">
          <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-[#16192C]">
            {title}
          </div>
        </div>
      )}
    </button>
  );
}
