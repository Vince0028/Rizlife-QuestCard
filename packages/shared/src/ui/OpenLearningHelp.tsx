"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

export function OpenLearningHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#B59A6C] bg-[#EFE6D2] text-xs text-[#16192C]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-bold cursor-pointer"
      >
        <span className="inline-flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-[#8A6923]" />
          How to copy your direct OpenLearning submission link
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-[#5E5246]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#5E5246]" />
        )}
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-[#C6B393] bg-[#FAF6EC] px-3 py-2.5 text-[11px] leading-relaxed text-[#4A4540]">
          <p>
            <strong>1. Activity / Gallery Post:</strong> Open your post on OpenLearning,
            find the post timestamp (e.g. <em>&ldquo;2 hours ago&rdquo;</em> or date),{" "}
            <strong>right-click the timestamp</strong>, and select{" "}
            <em>Copy Link Address</em>.
          </p>
          <p>
            <strong>2. Portfolio Share Link:</strong> Open your OpenLearning Profile →
            Portfolio → click <em>Share / Copy link</em> to grab your submission URL.
          </p>
          <p>
            <strong>3. External Output (Canva / Google Drive / YouTube):</strong> If your
            task uses an external file, set sharing to <em>Anyone with the link can view</em>{" "}
            and paste it here so your teacher can open it in one click.
          </p>
        </div>
      )}
    </div>
  );
}
