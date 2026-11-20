"use client";

import React from "react";

export function RizalMonumentWatermark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 210"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      {/* Tall Obelisk Shaft (Left & Right Bevel Faces) */}
      <polygon
        points="70,8 59,46 55,134 70,134"
        fill="#CFC5B4"
        stroke="#9E907C"
        strokeWidth="0.8"
      />
      <polygon
        points="70,8 81,46 85,134 70,134"
        fill="#BDB19D"
        stroke="#9E907C"
        strokeWidth="0.8"
      />

      {/* Obelisk Pyramidion Cap Seam */}
      <line x1="59" y1="46" x2="81" y2="46" stroke="#9E907C" strokeWidth="0.8" />
      <line x1="57" y1="88" x2="83" y2="88" stroke="#9E907C" strokeWidth="0.6" opacity="0.6" />
      <line x1="56" y1="112" x2="84" y2="112" stroke="#9E907C" strokeWidth="0.6" opacity="0.6" />

      {/* Golden Top Star & Sunburst on Pyramidion */}
      <circle cx="70" cy="27" r="3.2" fill="#C59B42" />
      <g stroke="#C59B42" strokeWidth="1">
        <line x1="70" y1="21" x2="70" y2="33" />
        <line x1="64" y1="27" x2="76" y2="27" />
        <line x1="66" y1="23" x2="74" y2="31" />
        <line x1="74" y1="23" x2="66" y2="31" />
      </g>

      {/* Sculpted Stone Backing Behind Statue */}
      <path
        d="M47 134 C47 114, 56 105, 70 105 C84 105, 93 114, 93 134 Z"
        fill="#B6A893"
        stroke="#968772"
        strokeWidth="0.8"
      />

      {/* Upper Molded Pedestal */}
      <rect
        x="43"
        y="134"
        width="54"
        height="14"
        fill="#C8BDA9"
        stroke="#968772"
        strokeWidth="0.9"
      />
      <rect
        x="38"
        y="148"
        width="64"
        height="16"
        fill="#BEB19B"
        stroke="#968772"
        strokeWidth="0.9"
      />

      {/* Stepped Granite Base */}
      <polygon
        points="28,164 112,164 118,180 22,180"
        fill="#C8BDA9"
        stroke="#968772"
        strokeWidth="0.9"
      />
      <rect
        x="16"
        y="180"
        width="108"
        height="12"
        fill="#B5A790"
        stroke="#8C7D67"
        strokeWidth="0.9"
      />
      <rect
        x="8"
        y="192"
        width="124"
        height="12"
        fill="#A6977F"
        stroke="#8C7D67"
        strokeWidth="0.9"
      />

      {/* Golden-Bronze Standing Statue of Dr. José Rizal in Center */}
      <g fill="#C59B42" stroke="#8A6923" strokeWidth="0.6">
        {/* Head */}
        <circle cx="70" cy="111" r="4.2" />
        {/* Overcoat Torso & Shoulders */}
        <path d="M63 117 C63 115.5, 77 115.5, 77 117 L78 136 L62 136 Z" />
        {/* Lower Coat & Legs */}
        <rect x="65" y="136" width="4.2" height="14" />
        <rect x="70.8" y="136" width="4.2" height="14" />
        {/* Statue Plinth */}
        <rect x="61" y="150" width="18" height="4" fill="#9E7929" />
      </g>
    </svg>
  );
}
