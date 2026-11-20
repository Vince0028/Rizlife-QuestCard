"use client";

import React, { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";

interface ChangePasswordViewProps {
  userEmail: string;
  mustChangePassword: boolean;
}

export function ChangePasswordView({
  userEmail,
  mustChangePassword,
}: ChangePasswordViewProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to update password.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 900);
    } catch {
      setError("Network error updating password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F7F1E2]">
      <div className="w-full max-w-md border-2 border-[#16192C] bg-[#FAF6EC] shadow-[8px_8px_0_rgba(22,25,44,0.14)]">
        <div className="border-b-2 border-[#C59B42] bg-[#16192C] px-6 py-5 text-[#FAF6EC]">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-[#D4AB50]" />
            <h1 className="font-display text-xl font-bold">
              {mustChangePassword ? "Set Your New Password" : "Change Password"}
            </h1>
          </div>
          <p className="mt-1 text-xs text-[#CFC3AE]">
            Signed in as <span className="font-mono text-[#D4AB50]">{userEmail}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {mustChangePassword && (
            <div className="border-l-4 border-[#B4843E] bg-[#FEF3C7] px-3.5 py-2.5 text-xs text-[#78350F]">
              Your account uses a starter password. Please choose your own personal
              password (at least 8 characters) to continue.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 border-l-4 border-[#9E2A2B] bg-[#FEE2E2] px-3 py-2 text-xs text-[#7F1D1D]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 border-l-4 border-[#0E8F47] bg-[#DCFCE7] px-3 py-2 text-xs font-semibold text-[#14532D]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Password updated! Redirecting to your portal...
            </div>
          )}

          {!mustChangePassword && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#5E5246]">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="folio-input w-full px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#5E5246]">
              New Password (8+ characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="folio-input w-full px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#5E5246]">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="folio-input w-full px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="btn-heritage-primary w-full py-2.5 text-sm"
          >
            {loading ? "Saving..." : "Update Password"}
          </button>

          {!mustChangePassword && (
            <a
              href="/dashboard"
              className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-[#5E5246] hover:text-[#16192C]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </a>
          )}
        </form>
      </div>
    </div>
  );
}
