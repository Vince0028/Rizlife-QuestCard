"use client";

import React, { useState } from "react";
import { Copy, Download, KeyRound } from "lucide-react";
import { ModalDrawer } from "./ModalDrawer";
import { formatManilaDateTime } from "../deadline";

export interface IssuedCredential {
  name: string;
  email: string;
  temporaryPassword: string;
  expiresAt: string;
}

function toCsv(rows: IssuedCredential[]): string {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [
    "Name,Email,Temporary Password,Expires (Philippine time)",
    ...rows.map((r) =>
      [r.name, r.email, r.temporaryPassword, formatManilaDateTime(r.expiresAt)].map(esc).join(",")
    ),
  ].join("\r\n");
}

/**
 * Shows newly issued temporary passwords exactly once. They are not stored anywhere
 * readable, so closing this dialog is the last chance to copy or download them.
 */
export function TemporaryPasswordDialog({
  credentials,
  onClose,
  title = "Temporary Password",
}: {
  credentials: IssuedCredential[] | null;
  onClose: () => void;
  title?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const open = Boolean(credentials && credentials.length > 0);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
    } catch {
      // Clipboard blocked: the value is visible and selectable anyway.
    }
  }

  function download() {
    if (!credentials) return;
    const blob = new Blob([toCsv(credentials)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rizlife-temporary-passwords-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ModalDrawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={credentials && credentials.length > 1 ? `${credentials.length} accounts` : undefined}
    >
      {credentials && (
        <div className="space-y-3">
          <div
            role="alert"
            className="border-l-4 border-[#D97706] bg-[#FEF3C7] px-3.5 py-2.5 text-xs text-[#78350F]"
          >
            <div className="font-bold">This is the only time these passwords are shown.</div>
            Copy or download them now and give each one privately to its owner. Each works
            once: the student must choose their own password at first sign-in, and an unused
            temporary password expires after 7 days.
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {credentials.map((c) => (
              <div
                key={c.email}
                className="flex flex-wrap items-center justify-between gap-2 border border-[#C6B393] bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[#16192C]">{c.name}</div>
                  <div className="truncate text-[11px] text-[#5E5246]">{c.email}</div>
                  <div className="text-[10px] text-[#5E5246]">
                    Expires {formatManilaDateTime(c.expiresAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <code className="select-all border border-[#B59A6C] bg-[#EFE6D2] px-2 py-1 font-mono text-xs font-bold text-[#16192C]">
                    {c.temporaryPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copy(c.temporaryPassword)}
                    className="btn-heritage-paper px-2 py-1 text-[11px]"
                    aria-label={`Copy password for ${c.email}`}
                  >
                    <Copy className="h-3 w-3" />
                    {copied === c.temporaryPassword ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={download} className="btn-heritage-paper px-3 py-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </button>
            <button type="button" onClick={onClose} className="btn-heritage-primary px-4 py-2 text-xs">
              <KeyRound className="h-3.5 w-3.5" />
              I&apos;ve saved them
            </button>
          </div>
        </div>
      )}
    </ModalDrawer>
  );
}
