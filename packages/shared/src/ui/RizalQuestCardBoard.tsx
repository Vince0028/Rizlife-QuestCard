"use client";

import React, { useState } from "react";
import { LayoutGrid, RefreshCw, Type } from "lucide-react";
import { getQuestDeadlineState } from "../deadline";
import type { QuestCategoryValue, SubmissionStatusValue } from "../types";
import { RizalMonumentWatermark } from "./RizalMonumentWatermark";
import { RizalStampCircle } from "./RizalStampCircle";

export interface QuestCardBoardItem {
  id: string;
  taskNumber: number;
  title: string;
  category: QuestCategoryValue;
  deadline: string | null;
}

interface RizalQuestCardBoardProps {
  studentName: string;
  studentNumber?: string | null;
  courseCode?: string | null;
  sectionCode: string;
  term: string;
  quests: QuestCardBoardItem[];
  statusByQuestId: Map<string, SubmissionStatusValue>;
  justStampedQuestId?: string | null;
  justUnstampedQuestId?: string | null;
  selectedQuestId?: string | null;
  defaultShowTitles?: boolean;
  onSelectQuest: (quest: QuestCardBoardItem) => void;
  actionHint?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Vintage Carte Postale & Handwritten Cursive Rizal Manuscript Border Collage
 * Recreates the Canva Quest Card background border (postcards, cursive letters, green stamps, postmarks).
 */
function CanvaVintageCollageBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Top-Left Handwritten Manuscript Scrap */}
      <div className="absolute -left-4 -top-3 h-28 w-72 -rotate-3 border border-[#B89F78] bg-[#F7EEDB] p-3 opacity-90 shadow-xs">
        <svg viewBox="0 0 240 70" className="h-full w-full text-[#3D3127]">
          <path
            d="M6 16 C22 6, 32 24, 48 14 C64 4, 72 22, 92 13 C112 4, 128 22, 148 12 C168 3, 184 20, 212 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M10 34 C30 24, 46 40, 68 29 C88 19, 108 37, 134 28 C154 20, 178 36, 220 27"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M4 52 C26 43, 45 58, 72 47 C96 38, 114 54, 145 45"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </div>

      {/* Top-Center Cursive Note Scrap */}
      <div className="absolute left-[26%] -top-4 h-24 w-64 rotate-6 border border-[#B89F78] bg-[#F3E7CE] p-2.5 opacity-90 shadow-xs">
        <div className="font-mono text-[8px] font-bold tracking-[0.2em] text-[#4E4136]">
          CORRESPONDANCE • 1892
        </div>
        <svg viewBox="0 0 200 50" className="mt-1 h-12 w-full text-[#3B2E25]">
          <path
            d="M4 12 C18 3, 30 19, 46 11 C64 3, 76 18, 95 10 C115 2, 136 18, 162 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M8 28 C25 18, 44 33, 66 24 C86 15, 110 31, 142 22 C160 15, 178 29, 194 21"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
          />
        </svg>
      </div>

      {/* Top-Right CARTE POSTALE & Green Vintage Postage Stamp */}
      <div className="absolute -right-3 -top-2 h-32 w-96 rotate-2 border border-[#B89F78] bg-[#FBF3E2] p-3.5 opacity-95 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-heritage text-xs font-extrabold tracking-[0.25em] text-[#2C2520]">
              CARTE POSTALE
            </div>
            <div className="mt-0.5 text-[7px] italic text-[#5E5043]">
              La correspondance au recto n&apos;etant pas acceptee par tous les pays etrangers
            </div>
            <div className="mt-2 font-mono text-[7.5px] font-bold tracking-[0.18em] text-[#3B2E25]">
              CORRESPONDANCE
            </div>
          </div>
          {/* Green Perforated Vintage Postage Stamp */}
          <div className="mr-3 flex h-12 w-10 flex-col items-center justify-center border-2 border-dashed border-[#FAF3E3] bg-[#2F6B3C] p-1 text-[#FAF3E3] shadow-2xs">
            <div className="text-[6px] font-bold uppercase tracking-tighter">FILIPINAS</div>
            <div className="my-0.5 h-5 w-5 rounded-full border border-[#FAF3E3]/70 bg-[#1F4B28]" />
            <div className="font-mono text-[6px] font-bold">5c</div>
          </div>
        </div>
      </div>

      {/* Left Edge Vertical Cursive Scrap */}
      <div className="absolute -left-5 top-1/3 h-64 w-24 -rotate-6 border border-[#B89F78] bg-[#F5E9D0] p-2 opacity-90">
        <svg viewBox="0 0 70 200" className="h-full w-full text-[#3D3127]">
          <path
            d="M12 10 C28 24, 8 42, 24 58 C40 74, 12 96, 28 116 C44 136, 14 158, 30 182"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M36 16 C52 34, 28 54, 46 72 C60 88, 34 112, 50 134 C62 152, 36 172, 52 190"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />
        </svg>
      </div>

      {/* Right Edge Vertical Cursive Scrap */}
      <div className="absolute -right-5 top-1/4 h-72 w-24 rotate-3 border border-[#B89F78] bg-[#F6ECDA] p-2 opacity-90">
        <svg viewBox="0 0 70 220" className="h-full w-full text-[#3D3127]">
          <path
            d="M18 12 C34 28, 12 46, 28 66 C44 86, 16 108, 32 130 C48 150, 18 174, 34 198"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M42 20 C58 38, 34 58, 50 78 C64 96, 38 120, 54 142 C66 162, 40 184, 56 206"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
          />
        </svg>
      </div>

      {/* Bottom-Left Vintage Stamp & Postmark Scrap */}
      <div className="absolute -bottom-3 -left-3 h-28 w-80 rotate-2 border border-[#B89F78] bg-[#F8EFE0] p-3 opacity-95">
        <div className="flex items-end justify-between">
          <div className="flex h-12 w-10 flex-col items-center justify-center border-2 border-dashed border-[#FAF3E3] bg-[#2F6B3C] p-1 text-[#FAF3E3]">
            <div className="text-[6px] font-bold">POSTES</div>
            <div className="my-0.5 h-4 w-4 rounded-full border border-[#FAF3E3]/80" />
            <div className="font-mono text-[6px]">10c</div>
          </div>
          <div className="font-mono text-[8px] font-bold tracking-[0.2em] text-[#4E4136]">
            CORRESPONDANCE • MANILA
          </div>
        </div>
      </div>

      {/* Bottom-Center & Right Handwritten Collage Scraps */}
      <div className="absolute -bottom-4 left-[34%] h-24 w-72 -rotate-2 border border-[#B89F78] bg-[#F3E6CC] p-3 opacity-90">
        <svg viewBox="0 0 220 50" className="h-full w-full text-[#3D3127]">
          <path
            d="M6 18 C24 8, 42 26, 62 15 C84 5, 102 24, 126 14 C148 5, 172 22, 206 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M12 36 C32 25, 54 41, 78 31 C102 21, 124 37, 154 27 C176 19, 194 33, 214 25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
          />
        </svg>
      </div>

      {/* Diagonal Archival Grid Lines (matching Canva overlay grid) */}
      <svg
        viewBox="0 0 1000 620"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-20"
      >
        <line x1="0" y1="220" x2="260" y2="0" stroke="#7A6852" strokeWidth="1" />
        <line x1="0" y1="540" x2="640" y2="0" stroke="#7A6852" strokeWidth="1" />
        <line x1="220" y1="620" x2="960" y2="0" stroke="#7A6852" strokeWidth="1" />
        <line x1="620" y1="620" x2="1000" y2="290" stroke="#7A6852" strokeWidth="1" />
        <line x1="720" y1="0" x2="1000" y2="240" stroke="#7A6852" strokeWidth="1" />
        <line x1="320" y1="0" x2="1000" y2="580" stroke="#7A6852" strokeWidth="1" />
        <line x1="0" y1="80" x2="640" y2="620" stroke="#7A6852" strokeWidth="1" />
        <line x1="0" y1="390" x2="280" y2="620" stroke="#7A6852" strokeWidth="1" />
      </svg>
    </div>
  );
}

export function RizalQuestCardBoard({
  studentName,
  studentNumber,
  courseCode,
  sectionCode,
  term,
  quests,
  statusByQuestId,
  justStampedQuestId = null,
  justUnstampedQuestId = null,
  selectedQuestId = null,
  defaultShowTitles = false,
  onSelectQuest,
  onRefresh,
  refreshing = false,
}: RizalQuestCardBoardProps) {
  const [showTitles, setShowTitles] = useState(defaultShowTitles);
  const nowMs = Date.now();

  return (
    <div className="rizal-canva-board relative overflow-hidden border-2 border-[#16192C] bg-[#DFCFAF] p-4 sm:p-7 shadow-[8px_8px_0_rgba(22,25,44,0.16)]">
      {/* Outer Vintage Postcard & Handwritten Letters Collage Border */}
      <CanvaVintageCollageBackdrop />

      {/* Torn-Edge Antique Linen Parchment Interior Sheet */}
      <div className="rizal-torn-parchment relative z-10 px-4 py-6 sm:px-10 sm:py-8">
        {/* Top Row: View Density Toggle + Refresh */}
        <div className="mb-1 flex items-center justify-end gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="btn-heritage-paper px-2.5 py-1 text-[11px]"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
          <div className="inline-flex border border-[#16192C] bg-[#FAF6EC]">
            <button
              type="button"
              onClick={() => setShowTitles(false)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                !showTitles
                  ? "bg-[#16192C] text-[#FAF6EC]"
                  : "text-[#5E5246] hover:bg-[#EFE6D2]"
              }`}
            >
              <LayoutGrid className="h-3 w-3" />
              Stamps
            </button>
            <button
              type="button"
              onClick={() => setShowTitles(true)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                showTitles
                  ? "bg-[#16192C] text-[#FAF6EC]"
                  : "text-[#5E5246] hover:bg-[#EFE6D2]"
              }`}
            >
              <Type className="h-3 w-3" />
              Titles
            </button>
          </div>
        </div>

        {/* Centered Heritage Header (Matching Canva Typography) */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-heritage text-sm font-bold uppercase tracking-[0.22em] text-[#3E352F] sm:text-base">
            Life and Works of Rizal
          </div>
          <h2 className="mt-1 font-heritage text-4xl font-extrabold tracking-[0.06em] text-[#352E29] sm:text-6xl">
            QUEST CARD
          </h2>
        </div>

        {/* Circular Stamp Matrix */}
        {quests.length === 0 ? (
          <div className="relative z-10 mx-auto my-10 max-w-md border border-dashed border-[#B59A6C] bg-[#FAF6EC] p-6 text-center text-xs text-[#5E5246]">
            No quest tasks have been published in section <strong>{sectionCode}</strong>{" "}
            yet.
          </div>
        ) : (
          <div
            className={`relative z-10 mx-auto mt-7 grid gap-2.5 sm:gap-3.5 ${
              showTitles
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                : "max-w-4xl grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10"
            }`}
          >
            {quests.map((q) => {
              const status = statusByQuestId.get(q.id) ?? "NOT_STARTED";
              const isOverdue =
                getQuestDeadlineState(q.deadline, status, new Date(nowMs)).kind ===
                "OVERDUE";
              return (
                <RizalStampCircle
                  key={q.id}
                  taskNumber={q.taskNumber}
                  title={q.title}
                  category={q.category}
                  status={status}
                  isOverdue={isOverdue}
                  showTitle={showTitles}
                  justStamped={justStampedQuestId === q.id}
                  justUnstamped={justUnstampedQuestId === q.id}
                  selected={selectedQuestId === q.id}
                  onClick={() => onSelectQuest(q)}
                />
              );
            })}
          </div>
        )}

        {/* Stamp Legend */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-[#594D42]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#0B8F41]" /> Stamped / Completed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#D99B38]" /> Waiting to Check
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#C53030]" /> Needs Revision
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#4F453F]" />
            <span className="h-3 w-3 -ml-2 rounded-full bg-[#C7A582]" /> Not Started
          </span>
        </div>

        {/* Bottom Student Name & Prominent Luneta Monument Watermark (matching Canva layout) */}
        <div className="relative z-10 mt-6 flex flex-col justify-between gap-4 border-t border-[#C6B393]/80 pt-4 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-heritage text-base font-bold uppercase tracking-wider text-[#3E352F] sm:text-lg">
                Student Name:
              </span>
              <span className="font-sans text-lg font-extrabold text-[#16192C] sm:text-xl">
                {studentName}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-heritage text-sm font-bold uppercase tracking-wider text-[#4A4039] sm:text-base">
                {term}
              </span>
              <span className="font-mono text-xs text-[#5E5246]">
                {studentNumber ? `ID: ${studentNumber}` : ""}{" "}
                {courseCode && courseCode !== sectionCode ? `• ${courseCode}` : ""} •{" "}
                {sectionCode}
              </span>
            </div>
          </div>

          <RizalMonumentWatermark className="h-32 w-auto sm:h-40 sm:-mb-4 sm:-mr-2 drop-shadow-xs" />
        </div>
      </div>
    </div>
  );
}
