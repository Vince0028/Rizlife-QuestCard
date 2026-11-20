"use client";

import React, { useState } from "react";
import { KeyRound, LogOut, Menu, X } from "lucide-react";
import type { PortalKey } from "../types";
import {
  LamparillaWreathWatermark,
  LedgerScrollSvg,
  NoliFiliBooksWatermark,
  QuillInkwellWatermark,
  RizalCrestLogo,
  SunEmblemSvg,
  WaxSealSvg,
} from "./RizalArt";
import { RizalMonumentWatermark } from "./RizalMonumentWatermark";

export interface ShellNavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export interface ShellStatPlaque {
  label: string;
  value: string | number;
  icon: "sun" | "seal" | "scroll";
  tone?: "brass" | "emerald" | "crimson";
}

interface VintageShellProps {
  portal: PortalKey;
  portalLabel: string;
  userName: string;
  userSubtitle: string;
  onLogout: () => void;
  onChangePassword?: () => void;
  navItems?: ShellNavItem[];
  activeNavKey?: string;
  onSelectNav?: (key: string) => void;
  statPlaques?: ShellStatPlaque[];
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function VintageShell({
  portal,
  portalLabel,
  userName,
  userSubtitle,
  onLogout,
  onChangePassword,
  navItems = [],
  activeNavKey,
  onSelectNav,
  statPlaques = [],
  rightSlot,
  children,
}: VintageShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#16192C] text-[#FAF6EC] border-r-2 border-[#C59B42]">
      <div>
        {/* Brand Crest Header */}
        <div className="border-b border-[#2E3456] px-4 py-5">
          <div className="flex items-center gap-3">
            <RizalCrestLogo className="h-11 w-11 shrink-0" />
            <div>
              <div className="font-heritage text-xl font-extrabold tracking-[0.12em] text-[#D4AB50]">
                RIZLIFE
              </div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B8AC96]">
                APC QuestCard
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Plaques */}
        {navItems.length > 0 && (
          <nav className="space-y-2 px-3 py-4" aria-label="Portal Navigation">
            {navItems.map((item) => {
              const isActive = item.key === activeNavKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSelectNav?.(item.key);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider cursor-pointer ${
                    isActive ? "nav-plaque-active" : "nav-plaque-idle"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="shrink-0">{item.icon}</span>
                    <span className="font-heritage tracking-wide">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        isActive
                          ? "bg-[#16192C] text-[#FAF6EC]"
                          : "bg-[#D4AB50] text-[#16192C]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Bottom User Identity & Account Actions */}
      <div className="relative overflow-hidden border-t border-[#2E3456] bg-[#111424] p-3.5 space-y-3">
        {portal === "student" ? (
          <NoliFiliBooksWatermark className="absolute -right-2 -top-2 h-16 w-16 opacity-15" />
        ) : portal === "teacher" ? (
          <QuillInkwellWatermark className="absolute -right-2 -top-2 h-16 w-16 opacity-15" />
        ) : (
          <LamparillaWreathWatermark className="absolute -right-2 -top-2 h-16 w-16 opacity-15" />
        )}
        <div className="relative z-10">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#D4AB50]">
            {portalLabel}
          </div>
          <div className="mt-0.5 truncate text-xs font-bold text-[#FAF6EC]">
            {userName}
          </div>
          <div className="truncate font-mono text-[10px] text-[#A89E8A]">
            {userSubtitle}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {onChangePassword && (
            <button
              type="button"
              onClick={onChangePassword}
              className="inline-flex items-center justify-center gap-1 border border-[#2E3456] bg-[#1E223A] px-2 py-1.5 text-[11px] font-semibold text-[#E8DEC8] hover:border-[#C59B42] cursor-pointer"
            >
              <KeyRound className="h-3 w-3" />
              Password
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className={`inline-flex items-center justify-center gap-1 border border-[#C59B42]/70 bg-[#252A47] px-2 py-1.5 text-[11px] font-bold text-[#FAF6EC] hover:bg-[#32395E] cursor-pointer ${
              onChangePassword ? "" : "col-span-2"
            }`}
          >
            <LogOut className="h-3 w-3" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F7F1E2]">
      {/* Desktop Fixed Left Midnight-Ink Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#16192C]/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 h-full w-64">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-2 z-20 border border-[#C59B42] bg-[#16192C] p-1.5 text-[#FAF6EC]"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Ivory Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b-2 border-[#C6B393] bg-[#FAF6EC]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                  className="btn-heritage-ink px-2.5 py-2"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="lg:hidden font-heritage text-sm font-extrabold tracking-widest text-[#16192C]">
                  RIZLIFE
                </div>
                {rightSlot}
              </div>
            </div>

            {statPlaques.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5">
                {statPlaques.map((plaque) => (
                  <div
                    key={plaque.label}
                    className="stat-plaque flex items-center gap-2 px-3 py-1.5"
                  >
                    {plaque.icon === "sun" && <SunEmblemSvg className="h-5 w-5" />}
                    {plaque.icon === "seal" && <WaxSealSvg className="h-5 w-5" />}
                    {plaque.icon === "scroll" && (
                      <LedgerScrollSvg className="h-5 w-5" />
                    )}
                    <div className="leading-tight">
                      <div className="font-mono text-xs font-extrabold text-[#16192C]">
                        {plaque.value}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[#5E5246]">
                        {plaque.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-[#D3C3A7] bg-[#FAF6EC] py-3 text-center text-[11px] font-medium text-[#5E5246]">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4">
            <NoliFiliBooksWatermark className="h-5 w-6 opacity-75" />
            <span>
              RizLife QuestCard • Asia Pacific College • Life and Works of Rizal (R.A.
              1425)
            </span>
            <QuillInkwellWatermark className="h-5 w-5 opacity-75" />
            <RizalMonumentWatermark className="h-6 w-4 opacity-75" />
          </div>
        </footer>
      </div>
    </div>
  );
}
