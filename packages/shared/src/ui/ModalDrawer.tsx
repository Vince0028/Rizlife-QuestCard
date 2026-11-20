"use client";

import React from "react";
import { X } from "lucide-react";

interface ModalDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function ModalDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: ModalDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#16192C]/55 backdrop-blur-[1px]">
      <div className="fixed inset-0" aria-hidden="true" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l-2 border-[#16192C] bg-[#FAF6EC] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#C59B42] bg-[#16192C] px-5 py-4 text-[#FAF6EC]">
          <div>
            {subtitle && (
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4AB50]">
                {subtitle}
              </div>
            )}
            <h2 className="font-display text-lg font-bold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="border border-[#2E3456] bg-[#1E223A] p-1.5 text-[#E8DEC8] transition hover:border-[#C59B42] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
