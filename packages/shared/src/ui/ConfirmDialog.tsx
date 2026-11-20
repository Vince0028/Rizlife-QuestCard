"use client";

import React, { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  highlightText?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  highlightText,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  busy = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const topRule =
    variant === "danger"
      ? "bg-[#A92B2C]"
      : variant === "warning"
      ? "bg-[#D4AB50]"
      : "bg-[#0E8F47]";

  const iconBg =
    variant === "danger"
      ? "bg-[#FEE2E2] text-[#A92B2C] border-[#A92B2C]"
      : variant === "warning"
      ? "bg-[#FEF3C7] text-[#8A6923] border-[#D4AB50]"
      : "bg-[#DCFCE7] text-[#0E8F47] border-[#0E8F47]";

  const confirmBtn =
    variant === "danger"
      ? "btn-heritage-danger"
      : variant === "warning"
      ? "btn-heritage-brass"
      : "btn-heritage-primary";

  const Icon =
    variant === "danger"
      ? Trash2
      : variant === "warning"
      ? AlertTriangle
      : CheckCircle2;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#16192C]/60 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="relative z-10 w-full max-w-md border-2 border-[#16192C] bg-[#FAF6EC] shadow-[8px_8px_0_rgba(22,25,44,0.22)]">
        <div className={`h-1.5 w-full ${topRule}`} />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center border-[1.5px] ${iconBg}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#16192C]">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#5E5246]">
                  {description}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              aria-label="Close confirmation dialog"
              className="border border-[#C6B393] bg-white p-1 text-[#5E5246] hover:bg-[#EFE6D2] disabled:opacity-40 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {highlightText && (
            <div className="mt-4 border border-[#C6B393] bg-[#EFE6D2] px-3.5 py-2.5 font-mono text-xs font-semibold text-[#16192C] break-all">
              {highlightText}
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="btn-heritage-paper px-4 py-2 text-xs"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`${confirmBtn} px-4 py-2 text-xs`}
            >
              {busy ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
