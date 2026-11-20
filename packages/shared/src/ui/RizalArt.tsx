"use client";

import React from "react";

export function RizalCrestLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="2"
        fill="#1E223A"
        stroke="#D4AB50"
        strokeWidth="2.5"
      />
      <rect
        x="7"
        y="7"
        width="50"
        height="50"
        fill="none"
        stroke="#D4AB50"
        strokeWidth="0.9"
        opacity="0.65"
      />
      {/* Philippine Sun Rays */}
      <circle cx="32" cy="24" r="6.5" fill="#D4AB50" />
      <g stroke="#D4AB50" strokeWidth="2" strokeLinecap="round">
        <line x1="32" y1="11" x2="32" y2="14.5" />
        <line x1="32" y1="33.5" x2="32" y2="37" />
        <line x1="19" y1="24" x2="22.5" y2="24" />
        <line x1="41.5" y1="24" x2="45" y2="24" />
        <line x1="22.8" y1="14.8" x2="25.3" y2="17.3" />
        <line x1="38.7" y1="30.7" x2="41.2" y2="33.2" />
        <line x1="41.2" y1="14.8" x2="38.7" y2="17.3" />
        <line x1="25.3" y1="30.7" x2="22.8" y2="33.2" />
      </g>
      {/* Open Folio & Quill */}
      <path
        d="M15 41 Q23 37 32 42 Q41 37 49 41 L49 50 Q41 46 32 51 Q23 46 15 50 Z"
        fill="#FAF6EC"
        stroke="#D4AB50"
        strokeWidth="1.2"
      />
      <line x1="32" y1="42" x2="32" y2="51" stroke="#8A6923" strokeWidth="1.2" />
      <path
        d="M27 45 L46 21 C41 23 34 29 29 39 Z"
        fill="#0DB852"
        stroke="#FAF6EC"
        strokeWidth="1"
      />
    </svg>
  );
}

export function SunEmblemSvg({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="5.5" fill="#D4AB50" stroke="#7C5C1C" strokeWidth="1.3" />
      <g stroke="#8A6923" strokeWidth="2" strokeLinecap="round">
        <line x1="16" y1="3" x2="16" y2="7" />
        <line x1="16" y1="25" x2="16" y2="29" />
        <line x1="3" y1="16" x2="7" y2="16" />
        <line x1="25" y1="16" x2="29" y2="16" />
        <line x1="6.8" y1="6.8" x2="9.6" y2="9.6" />
        <line x1="22.4" y1="22.4" x2="25.2" y2="25.2" />
        <line x1="25.2" y1="6.8" x2="22.4" y2="9.6" />
        <line x1="9.6" y1="22.4" x2="6.8" y2="25.2" />
      </g>
    </svg>
  );
}

export function WaxSealSvg({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="#0E8F47" stroke="#074421" strokeWidth="1.5" />
      <circle
        cx="16"
        cy="16"
        r="8.8"
        fill="none"
        stroke="#FAF6EC"
        strokeWidth="1"
        strokeDasharray="2 1.5"
      />
      <path
        d="M11 16.5 L14.5 20 L21.5 12"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function LedgerScrollSvg({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect
        x="6"
        y="4"
        width="20"
        height="24"
        rx="1.5"
        fill="#FAF6EC"
        stroke="#8A6923"
        strokeWidth="1.6"
      />
      <line x1="10" y1="11" x2="22" y2="11" stroke="#16192C" strokeWidth="1.6" />
      <line x1="10" y1="16" x2="22" y2="16" stroke="#8A6923" strokeWidth="1.6" />
      <line x1="10" y1="21" x2="18" y2="21" stroke="#8A6923" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Stacked 19th-Century Volumes (Noli Me Tangere & El Filibusterismo) with Quill & Bookmark
 * Used logically on Task Lists, Quest Builders, and Reading/Task Prompts.
 */
export function NoliFiliBooksWatermark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 96"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      {/* Bottom Volume: El Filibusterismo */}
      <rect
        x="14"
        y="62"
        width="88"
        height="18"
        rx="2"
        fill="#7C5C38"
        stroke="#4F3B22"
        strokeWidth="1.5"
      />
      <rect x="20" y="65" width="78" height="12" fill="#FAF3E3" />
      <line x1="22" y1="69" x2="96" y2="69" stroke="#C6B393" strokeWidth="1" />
      <line x1="22" y1="73" x2="96" y2="73" stroke="#C6B393" strokeWidth="1" />
      {/* Gold Bookmark Ribbon */}
      <polygon points="40,77 48,77 48,90 44,86 40,90" fill="#C59B42" />

      {/* Upper Volume: Noli Me Tangere */}
      <rect
        x="22"
        y="44"
        width="82"
        height="18"
        rx="2"
        fill="#4F453F"
        stroke="#2C2520"
        strokeWidth="1.5"
      />
      <rect x="28" y="47" width="72" height="12" fill="#FAF3E3" />
      <line x1="30" y1="51" x2="98" y2="51" stroke="#C6B393" strokeWidth="1" />
      <line x1="30" y1="55" x2="98" y2="55" stroke="#C6B393" strokeWidth="1" />
      {/* Spine Gold Bands */}
      <rect x="24" y="44" width="3" height="18" fill="#C59B42" />
      <rect x="16" y="62" width="3" height="18" fill="#C59B42" />

      {/* Open Manuscript & Feather Quill Resting on Top */}
      <path
        d="M32 44 C38 35, 50 35, 58 42 C66 35, 78 35, 84 44 Z"
        fill="#FAF6EC"
        stroke="#8C775B"
        strokeWidth="1.3"
      />
      {/* Feather Quill */}
      <path
        d="M48 42 C58 28, 74 14, 96 6 C88 18, 77 30, 62 37 Z"
        fill="#C59B42"
        stroke="#5E4719"
        strokeWidth="1.2"
      />
      <path
        d="M44 45 L96 6"
        stroke="#4F3B22"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 19th-Century Brass Inkwell & Feather Quill Pen
 * Used logically on Check Student Work, Student Rosters, and Faculty/Account Ledgers.
 */
export function QuillInkwellWatermark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 110 110"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      {/* Rolled Correspondence Scroll at Base */}
      <rect
        x="10"
        y="78"
        width="68"
        height="14"
        rx="7"
        fill="#EFE4CE"
        stroke="#8C775B"
        strokeWidth="1.4"
      />
      <circle cx="17" cy="85" r="4" fill="#C6B393" stroke="#8C775B" strokeWidth="1" />

      {/* Vintage Glass & Brass Inkwell */}
      <rect
        x="38"
        y="50"
        width="24"
        height="7"
        rx="1"
        fill="#C59B42"
        stroke="#6B5119"
        strokeWidth="1.3"
      />
      <path
        d="M34 57 L66 57 L72 86 L28 86 Z"
        fill="#3B332E"
        stroke="#16192C"
        strokeWidth="1.5"
      />
      <path d="M38 62 L62 62 L66 81 L34 81 Z" fill="#524740" opacity="0.7" />
      <rect x="25" y="85" width="50" height="5" rx="1" fill="#C59B42" stroke="#6B5119" strokeWidth="1.2" />

      {/* Feather Quill Dipping into Inkwell */}
      <path
        d="M52 52 C60 32, 74 16, 95 7 C92 22, 82 36, 68 44 L63 40 L60 47 Z"
        fill="#FAF6EC"
        stroke="#7C684E"
        strokeWidth="1.4"
      />
      <path
        d="M58 45 C67 30, 79 18, 95 7 C86 22, 74 35, 62 45 Z"
        fill="#D4AB50"
        opacity="0.75"
      />
      <path
        d="M49 56 C58 38, 74 20, 95 7"
        stroke="#4F3B22"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Rizal's "La Lamparilla" (Mi Último Adiós Alcohol Lamp & Laurel Wreath)
 * Used logically on Rankings / Leaderboards, Academic Milestones, and System Overview.
 */
export function LamparillaWreathWatermark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 110 110"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      {/* Left & Right Laurel Branches */}
      <path
        d="M52 94 C28 90, 16 70, 20 44"
        fill="none"
        stroke="#8A6923"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M58 94 C82 90, 94 70, 90 44"
        fill="none"
        stroke="#8A6923"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Laurel Leaves */}
      <g fill="#C59B42" opacity="0.85">
        <ellipse cx="22" cy="76" rx="6" ry="3" transform="rotate(-35 22 76)" />
        <ellipse cx="18" cy="62" rx="6" ry="3" transform="rotate(-15 18 62)" />
        <ellipse cx="20" cy="48" rx="6" ry="3" transform="rotate(15 20 48)" />
        <ellipse cx="88" cy="76" rx="6" ry="3" transform="rotate(35 88 76)" />
        <ellipse cx="92" cy="62" rx="6" ry="3" transform="rotate(15 92 62)" />
        <ellipse cx="90" cy="48" rx="6" ry="3" transform="rotate(-15 90 48)" />
      </g>

      {/* Glowing Flame of Knowledge (Mi Último Adiós) */}
      <path
        d="M55 14 C61 23, 63 31, 55 37 C47 31, 49 23, 55 14 Z"
        fill="#D4AB50"
        stroke="#8A6923"
        strokeWidth="1.2"
      />
      <path
        d="M55 21 C58 26, 59 31, 55 35 C51 31, 52 26, 55 21 Z"
        fill="#FAF6EC"
      />

      {/* Alcohol Lamp (La Lamparilla) Body & Pedestal */}
      <rect x="51" y="37" width="8" height="5" fill="#7C5C1C" />
      <ellipse
        cx="55"
        cy="54"
        rx="18"
        ry="12"
        fill="#DFC99B"
        stroke="#6B5119"
        strokeWidth="1.5"
      />
      <path
        d="M47 65 L63 65 L60 80 L50 80 Z"
        fill="#C59B42"
        stroke="#6B5119"
        strokeWidth="1.3"
      />
      <rect
        x="41"
        y="80"
        width="28"
        height="6"
        rx="1.5"
        fill="#8A6923"
        stroke="#4F3B22"
        strokeWidth="1.2"
      />
    </svg>
  );
}
