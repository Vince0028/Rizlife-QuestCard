"use client";

import React, { useState } from "react";
import { AlertCircle, Building2, Lock, Mail } from "lucide-react";
import type { PortalKey } from "../types";
import { RizalCrestLogo } from "./RizalArt";
import { RizalMonumentWatermark } from "./RizalMonumentWatermark";

interface LoginCardProps {
  portal: PortalKey;
  portalTitle: string;
  portalSubtitle: string;
  defaultDemoEmail?: string;
  defaultDemoPassword?: string;
  microsoftSsoConfigured: boolean;
  initialError?: string | null;
}

export function LoginCard({
  portal,
  portalTitle,
  portalSubtitle,
  defaultDemoEmail = "",
  defaultDemoPassword = "",
  microsoftSsoConfigured,
  initialError,
}: LoginCardProps) {
  const [email, setEmail] = useState(defaultDemoEmail);
  const [password, setPassword] = useState(defaultDemoPassword);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mustChangePassword?: boolean;
      };
      if (!res.ok) {
        setError(
          data.error ||
            `Sign in failed (HTTP ${res.status}). Check your terminal logs and .env DATABASE_URL.`
        );
        setLoading(false);
        return;
      }
      if (data.mustChangePassword) {
        window.location.href = "/change-password";
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Network error while signing in. Please try again.");
      setLoading(false);
    }
  }

  const portalBadge =
    portal === "admin"
      ? "ADMIN CONSOLE"
      : portal === "teacher"
      ? "TEACHER LEDGER"
      : "STUDENT QUEST CARD";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-[#F7F1E2]">
      <div className="w-full max-w-4xl grid md:grid-cols-12 border-2 border-[#16192C] bg-[#FAF6EC] shadow-[10px_10px_0_rgba(22,25,44,0.14)]">
        {/* LEFT MIDNIGHT-INK HERITAGE COVER */}
        <div className="relative md:col-span-5 flex flex-col justify-between bg-[#16192C] p-6 sm:p-8 text-[#FAF6EC] border-b-2 md:border-b-0 md:border-r-2 border-[#C59B42] overflow-hidden">
          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-3">
              <RizalCrestLogo className="h-12 w-12 shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4AB50]">
                  Asia Pacific College
                </div>
                <div className="font-heritage text-xl font-extrabold tracking-[0.1em] text-[#FAF6EC]">
                  RIZLIFE
                </div>
              </div>
            </div>

            <div className="inline-block border border-[#C59B42] bg-[#1E223A] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4AB50]">
              {portalBadge}
            </div>

            <div className="pt-2">
              <h1 className="font-display text-3xl font-bold leading-tight text-[#FAF6EC]">
                {portalTitle}
              </h1>
              <p className="mt-3 text-xs leading-relaxed text-[#CFC3AE]">
                {portalSubtitle}
              </p>
            </div>
          </div>

          <RizalMonumentWatermark className="pointer-events-none absolute -bottom-2 right-3 h-40 w-auto opacity-25" />

          <div className="relative z-10 mt-8 border-t border-[#2E3456] pt-4 text-[11px] text-[#B8AC96]">
            {defaultDemoEmail && defaultDemoPassword && (
              <div className="border border-[#2E3456] bg-[#111424] px-3 py-2 font-mono text-[10px] text-[#D4AB50]">
                Demo: {defaultDemoEmail} / {defaultDemoPassword}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT ARCHIVAL SIGN-IN FOLIO */}
        <div className="md:col-span-7 flex flex-col justify-center p-6 sm:p-10 bg-[#FAF6EC]">
          <div className="mb-6 border-b border-[#D3C3A7] pb-4">
            <h2 className="font-display text-2xl font-bold text-[#16192C]">
              Sign In
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 border-l-4 border-[#9E2A2B] bg-[#FEE2E2] px-3.5 py-2.5 text-xs font-medium text-[#7F1D1D]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5E5246]">
                APC Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#5E5246]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    portal === "student"
                      ? "vpalobin@student.apc.edu.ph"
                      : "faculty@apc.edu.ph"
                  }
                  className="folio-input w-full py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#5E5246]">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#5E5246]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="folio-input w-full py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-heritage-primary w-full py-3 text-sm"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>

            {microsoftSsoConfigured && (
              <div className="pt-3 border-t border-[#D3C3A7]">
                <a
                  href="/api/auth/microsoft/login"
                  className="btn-heritage-paper w-full py-2.5 text-xs"
                >
                  <Building2 className="h-4 w-4 text-[#0E8F47]" />
                  Sign in with APC Microsoft Account
                </a>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
