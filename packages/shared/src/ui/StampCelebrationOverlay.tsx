"use client";

import React from "react";
import { RizalPisoStampGraphic } from "./RizalStampCircle";

interface StampCelebrationOverlayProps {
  visible: boolean;
  taskNumber?: number;
  studentName?: string;
}

export function StampCelebrationOverlay({
  visible,
  taskNumber,
  studentName,
}: StampCelebrationOverlayProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="relative flex flex-col items-center">
        <span
          aria-hidden="true"
          className="animate-ink-burst absolute h-44 w-44 rounded-full border-4 border-[#0B8F41]"
        />
        <div className="animate-rubber-stamp relative flex h-40 w-40 flex-col items-center justify-center rounded-full border-4 border-[#FAF6EC] bg-[#0B8F41] text-[#FAF6EC] shadow-[0_14px_40px_rgba(11,143,65,0.5)] ring-4 ring-[#0B8F41]/40">
          <RizalPisoStampGraphic className="h-36 w-36" />
          {taskNumber !== undefined && (
            <span className="absolute -right-1 -top-1 border-2 border-[#FAF6EC] bg-[#16192C] px-2 py-0.5 font-mono text-xs font-bold text-[#D4AB50]">
              #{taskNumber}
            </span>
          )}
        </div>
        {studentName && (
          <div className="mt-3 border-2 border-[#C59B42] bg-[#16192C] px-4 py-1 text-xs font-bold text-[#FAF6EC] shadow-lg">
            {studentName}
          </div>
        )}
      </div>
    </div>
  );
}
