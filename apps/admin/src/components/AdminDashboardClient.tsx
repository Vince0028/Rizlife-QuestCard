"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  Edit3,
  Feather,
  KeyRound,
  Layers,
  Mail,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import {
  ConfirmDialog,
  LamparillaWreathWatermark,
  ModalDrawer,
  NoliFiliBooksWatermark,
  QuillInkwellWatermark,
  RizalMonumentWatermark,
  TeacherWorkspace,
  VintageShell,
  type WorkspaceSectionOption,
} from "@rizlife/shared/ui";
import type { RoleValue, SessionPayload } from "@rizlife/shared/types";

interface AdminUserRow {
  id: string;
  studentId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  role: RoleValue;
  courseCode: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  _count: { taughtSections: number; enrollments: number };
}

interface AdminSectionRow extends WorkspaceSectionOption {
  leaderboardVisible: boolean;
  digestThreshold: number;
  digestEnabled: boolean;
}

interface AdminOverviewResponse {
  metrics: {
    totalStudents: number;
    totalTeachers: number;
    totalAdmins: number;
    totalSections: number;
    totalQuests: number;
    stampedSubmissions: number;
    pendingSubmissions: number;
    digestsSent: number;
  };
  users: AdminUserRow[];
  sections: AdminSectionRow[];
  recentDigests: {
    id: string;
    sectionCode: string;
    teacherName: string;
    recipientEmail: string;
    submissionCount: number;
    triggerType: string;
    deliveryStatus: string;
    sentAt: string;
  }[];
  settings: {
    activeTerm: string;
    defaultDigestThreshold: number;
    digestCronSchedule: string;
    emailProvider: "preview" | "resend" | "smtp";
    emailFromAddress: string;
    allowedStudentDomain: string;
    allowedStaffDomain: string;
    microsoftSsoEnabled: boolean;
  };
  envStatus: {
    microsoftSsoConfigured: boolean;
    resendConfigured: boolean;
    smtpConfigured: boolean;
  };
}

type AdminTab = "overview" | "users" | "sections" | "settings" | "override";

export function AdminDashboardClient({ user }: { user: SessionPayload }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [overrideSectionId, setOverrideSectionId] = useState<string | null>(null);

  // User provisioning & filters
  const [roleFilter, setRoleFilter] = useState<"ALL" | RoleValue>("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [newRole, setNewRole] = useState<RoleValue>("TEACHER");
  const [newFirst, setNewFirst] = useState("");
  const [newMiddle, setNewMiddle] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newPassword, setNewPassword] = useState("Teacher@RizLife2026");
  const [assignSectionIds, setAssignSectionIds] = useState<string[]>([]);
  const [createUserBusy, setCreateUserBusy] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  // Reset password modal
  const [resetUser, setResetUser] = useState<AdminUserRow | null>(null);
  const [resetPwValue, setResetPwValue] = useState("RizLife@2026");

  // New section form
  const [secCode, setSecCode] = useState("");
  const [secName, setSecName] = useState("");
  const [secTerm, setSecTerm] = useState("Term 2 AY 2026-2027");
  const [secTeacherId, setSecTeacherId] = useState("");
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<
    AdminOverviewResponse["settings"] | null
  >(null);
  const [settingsBusy, setSettingsBusy] = useState(false);

  // Edit User & Edit Section drawers
  const [editUserTarget, setEditUserTarget] = useState<AdminUserRow | null>(null);
  const [editUserFirst, setEditUserFirst] = useState("");
  const [editUserMiddle, setEditUserMiddle] = useState("");
  const [editUserLast, setEditUserLast] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState<RoleValue>("TEACHER");
  const [editUserStudentId, setEditUserStudentId] = useState("");
  const [editUserCourse, setEditUserCourse] = useState("");

  const [editSecTarget, setEditSecTarget] = useState<AdminSectionRow | null>(null);
  const [editSecCode, setEditSecCode] = useState("");
  const [editSecName, setEditSecName] = useState("");
  const [editSecTerm, setEditSecTerm] = useState("");
  const [editSecTeacherId, setEditSecTeacherId] = useState("");
  const [editSecThreshold, setEditSecThreshold] = useState(20);

  // Centralized confirmation popup
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    highlightText?: string | null;
    confirmLabel: string;
    variant: "danger" | "warning" | "primary";
    onConfirm: () => Promise<void>;
  } | null>(null);

  const askConfirm = useCallback(
    (cfg: {
      title: string;
      description: string;
      highlightText?: string | null;
      confirmLabel: string;
      variant: "danger" | "warning" | "primary";
      onConfirm: () => Promise<void>;
    }) => {
      setConfirmState(cfg);
    },
    []
  );

  async function executeConfirm() {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.onConfirm();
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const showToast = useCallback((type: "ok" | "err", text: string) => {
    setBanner({ type, text });
    setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  }, []);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/overview");
      if (res.ok) {
        const json = (await res.json()) as AdminOverviewResponse;
        setData(json);
        setSettingsForm(json.settings);
        setSecTerm(json.settings.activeTerm);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const teachersList = useMemo(() => {
    if (!data) return [];
    return data.users.filter((u) => u.role === "TEACHER" || u.role === "ADMIN");
  }, [data]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = userSearch.trim().toLowerCase();
    return data.users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      return `${u.lastName} ${u.firstName} ${u.middleName ?? ""} ${u.email} ${
        u.studentId ?? ""
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [data, roleFilter, userSearch]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateUserBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: newRole,
          firstName: newFirst,
          middleName: newMiddle || null,
          lastName: newLast,
          email: newEmail,
          studentId: newRole === "STUDENT" ? newStudentId || null : null,
          courseCode: newRole === "STUDENT" ? newCourse || null : null,
          password: newPassword || undefined,
          mustChangePassword: true,
          assignSectionIds: newRole === "TEACHER" ? assignSectionIds : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast("err", json.error || "Failed to create account.");
        return;
      }
      showToast(
        "ok",
        `Created ${json.user.role} account ${json.user.email} (temporary password: ${json.temporaryPassword}).`
      );
      setNewFirst("");
      setNewMiddle("");
      setNewLast("");
      setNewEmail("");
      setNewStudentId("");
      setNewCourse("");
      setAssignSectionIds([]);
      setShowCreateUserModal(false);
      await loadOverview();
    } finally {
      setCreateUserBusy(false);
    }
  }

  function openEditUserDrawer(u: AdminUserRow) {
    setEditUserTarget(u);
    setEditUserFirst(u.firstName);
    setEditUserMiddle(u.middleName || "");
    setEditUserLast(u.lastName);
    setEditUserEmail(u.email);
    setEditUserRole(u.role);
    setEditUserStudentId(u.studentId || "");
    setEditUserCourse(u.courseCode || "");
    setResetPwValue("RizLife@2026");
  }

  function requestSaveUserEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUserTarget) return;
    askConfirm({
      title: "Save Account Changes?",
      description: `Confirm updating profile and role settings for ${editUserLast}, ${editUserFirst}.`,
      highlightText: `${editUserRole} • ${editUserEmail}`,
      confirmLabel: "Save Changes",
      variant: "primary",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/users/${editUserTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: editUserFirst,
            middleName: editUserMiddle || null,
            lastName: editUserLast,
            email: editUserEmail,
            role: editUserRole,
            studentId: editUserRole === "STUDENT" ? editUserStudentId || null : null,
            courseCode: editUserRole === "STUDENT" ? editUserCourse || null : null,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          showToast("err", json.error || "Could not update user.");
          return;
        }
        setEditUserTarget(null);
        await loadOverview();
        showToast("ok", `Updated account ${editUserEmail}.`);
      },
    });
  }

  function handleToggleUserActive(target: AdminUserRow) {
    const nextActive = !target.isActive;
    askConfirm({
      title: nextActive ? "Activate User Account?" : "Deactivate User Account?",
      description: nextActive
        ? `Allow ${target.lastName}, ${target.firstName} to sign in again.`
        : `Block ${target.lastName}, ${target.firstName} from signing in until reactivated.`,
      highlightText: `${target.role} • ${target.email}`,
      confirmLabel: nextActive ? "Yes, Activate" : "Yes, Deactivate",
      variant: "warning",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/users/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextActive }),
        });
        const json = await res.json();
        if (!res.ok) {
          showToast("err", json.error || "Could not update user.");
          return;
        }
        showToast(
          "ok",
          `${target.email} is now ${nextActive ? "Active" : "Deactivated"}.`
        );
        await loadOverview();
      },
    });
  }

  function handleDeleteUser(target: AdminUserRow) {
    askConfirm({
      title: "Permanently Delete Account?",
      description: `This permanently deletes ${target.lastName}, ${target.firstName}'s account and cannot be undone.`,
      highlightText: `${target.role} • ${target.email}`,
      confirmLabel: "Yes, Delete Account",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/users/${target.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok) {
          showToast("err", json.error || "Could not delete user.");
          return;
        }
        setEditUserTarget(null);
        showToast("ok", `Deleted ${target.email}.`);
        await loadOverview();
      },
    });
  }

  function handleResetUserPasswordFromEdit() {
    if (!editUserTarget) return;
    const target = editUserTarget;
    askConfirm({
      title: "Reset Account Password?",
      description: `Set temporary password for ${target.lastName}, ${target.firstName}. They will be forced to choose a new password on next sign in.`,
      highlightText: `${target.email}  →  ${resetPwValue}`,
      confirmLabel: "Yes, Reset Password",
      variant: "warning",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/users/${target.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: resetPwValue }),
        });
        const json = await res.json();
        if (!res.ok) {
          showToast("err", json.error || "Password reset failed.");
          return;
        }
        showToast("ok", `Temporary password reset for ${target.email}.`);
        setEditUserTarget(null);
        await loadOverview();
      },
    });
  }

  async function handleCreateSection(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/workspace/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: secCode,
        name: secName,
        term: secTerm,
        teacherId: secTeacherId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      showToast("err", json.error || "Failed to create section.");
      return;
    }
    showToast("ok", `Section ${json.section.code} created.`);
    setSecCode("");
    setSecName("");
    setShowCreateSectionModal(false);
    await loadOverview();
  }

  async function handleReassignTeacher(sectionId: string, teacherId: string) {
    const res = await fetch(`/api/workspace/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: teacherId || null }),
    });
    if (res.ok) {
      showToast(
        "ok",
        teacherId ? "Teacher assigned to section." : "Section set to Unassigned."
      );
      await loadOverview();
    }
  }

  function openEditSectionDrawer(sec: AdminSectionRow) {
    setEditSecTarget(sec);
    setEditSecCode(sec.code);
    setEditSecName(sec.name);
    setEditSecTerm(sec.term);
    setEditSecTeacherId(sec.teacherId ?? "");
    setEditSecThreshold(sec.digestThreshold);
  }

  function requestSaveSectionEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSecTarget) return;
    askConfirm({
      title: "Save Section Changes?",
      description: `Confirm updating section ${editSecTarget.code} details.`,
      highlightText: `${editSecCode.toUpperCase()} - ${editSecName} (${editSecTerm})`,
      confirmLabel: "Save Changes",
      variant: "primary",
      onConfirm: async () => {
        const res = await fetch(`/api/workspace/sections/${editSecTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: editSecCode,
            name: editSecName,
            term: editSecTerm,
            teacherId: editSecTeacherId || null,
            digestThreshold: Number(editSecThreshold),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          showToast("err", json.error || "Failed to update section.");
          return;
        }
        setEditSecTarget(null);
        await loadOverview();
        showToast("ok", `Updated section ${editSecCode.toUpperCase()}.`);
      },
    });
  }

  function handleDeleteSection(sec: AdminSectionRow) {
    askConfirm({
      title: `Delete Section ${sec.code}?`,
      description: `This permanently deletes section ${sec.code} (${sec.term}) along with its ${
        sec._count?.quests ?? 0
      } quests, ${sec._count?.enrollments ?? 0} student enrollments, and all submission logs.`,
      highlightText: `${sec.code} - ${sec.name} (${sec.term})`,
      confirmLabel: "Yes, Delete Section",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/sections/${sec.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setEditSecTarget(null);
          showToast("ok", `Deleted section ${sec.code}.`);
          await loadOverview();
        } else {
          showToast("err", "Failed to delete section.");
        }
      },
    });
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsForm) return;
    askConfirm({
      title: "Save Global System Settings?",
      description:
        "These settings control active academic term defaults, email delivery mode, and allowed APC domains across all portals.",
      highlightText: `${settingsForm.activeTerm} • Email Mode: ${settingsForm.emailProvider.toUpperCase()}`,
      confirmLabel: "Save Global Settings",
      variant: "primary",
      onConfirm: async () => {
        setSettingsBusy(true);
        try {
          const res = await fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settingsForm),
          });
          const json = await res.json();
          if (!res.ok) {
            showToast("err", json.error || "Failed to save system settings.");
          } else {
            showToast("ok", "Global RizLife system settings updated.");
            await loadOverview();
          }
        } finally {
          setSettingsBusy(false);
        }
      },
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <VintageShell
      portal="admin"
      portalLabel="Admin Console"
      userName={`${user.firstName} ${user.lastName}`}
      userSubtitle={user.email}
      onLogout={handleLogout}
      onChangePassword={() => {
        window.location.href = "/change-password";
      }}
      navItems={[
        {
          key: "overview",
          label: "Overview",
          icon: <Activity className="h-4 w-4" />,
        },
        {
          key: "users",
          label: "Teachers & Users",
          icon: <Users className="h-4 w-4" />,
          badge: data?.users.length,
        },
        {
          key: "sections",
          label: "Sections & Terms",
          icon: <Layers className="h-4 w-4" />,
          badge: data?.sections.length,
        },
        {
          key: "settings",
          label: "Global & Email",
          icon: <Settings className="h-4 w-4" />,
        },
        {
          key: "override",
          label: "Teacher Override",
          icon: <Wrench className="h-4 w-4" />,
        },
      ]}
      activeNavKey={tab}
      onSelectNav={(k) => {
        setTab(k as AdminTab);
        void loadOverview();
      }}
      statPlaques={
        data
          ? [
              {
                label: "Students",
                value: data.metrics.totalStudents,
                icon: "sun",
              },
              {
                label: "Teachers",
                value: data.metrics.totalTeachers,
                icon: "seal",
              },
              {
                label: "Sections",
                value: data.metrics.totalSections,
                icon: "scroll",
              },
            ]
          : []
      }
      rightSlot={
        <button
          type="button"
          onClick={() => void loadOverview()}
          className="btn-heritage-paper px-3 py-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
        {banner && (
          <div
            className={`flex items-center justify-between border-l-4 px-4 py-3 text-sm font-semibold ${
              banner.type === "ok"
                ? "border-[#0E8F47] bg-[#DCFCE7] text-[#14532D]"
                : "border-[#A92B2C] bg-[#FEE2E2] text-[#7F1D1D]"
            }`}
          >
            <span>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: SYSTEM OVERVIEW */}
        {data && tab === "overview" && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Total Students",
                  value: data.metrics.totalStudents,
                  tone: "ink",
                },
                {
                  label: "Faculty Teachers",
                  value: data.metrics.totalTeachers,
                  tone: "green",
                },
                {
                  label: "Active Sections",
                  value: data.metrics.totalSections,
                  tone: "brass",
                },
                { label: "Total Quests", value: data.metrics.totalQuests, tone: "ink" },
                {
                  label: "Quests Stamped",
                  value: data.metrics.stampedSubmissions,
                  tone: "green",
                },
                {
                  label: "Waiting Check",
                  value: data.metrics.pendingSubmissions,
                  tone: "brass",
                },
                {
                  label: "Digests Sent",
                  value: data.metrics.digestsSent,
                  tone: "ink",
                },
                {
                  label: "Admin Accounts",
                  value: data.metrics.totalAdmins,
                  tone: "ink",
                },
              ].map((m) => (
                <div key={m.label} className="folio-panel p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#5E5246]">
                    {m.label}
                  </div>
                  <div
                    className={`mt-1 font-mono text-3xl font-extrabold ${
                      m.tone === "green"
                        ? "text-[#0E8F47]"
                        : m.tone === "brass"
                        ? "text-[#8A6923]"
                        : "text-[#16192C]"
                    }`}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="folio-panel relative overflow-hidden p-5">
                <RizalMonumentWatermark className="absolute -bottom-2 right-3 h-28 w-auto opacity-25" />
                <div className="flex items-center gap-2.5">
                  <LamparillaWreathWatermark className="h-8 w-8" />
                  <h2 className="font-display text-lg font-bold text-[#16192C]">
                    Active Term &amp; Integrations
                  </h2>
                </div>
                <div className="mt-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border border-[#C6B393] bg-white px-3.5 py-2.5">
                    <span className="text-[#5E5246]">Active Academic Term</span>
                    <span className="font-bold text-[#16192C]">
                      {data.settings.activeTerm}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border border-[#C6B393] bg-white px-3.5 py-2.5">
                    <span className="text-[#5E5246]">Email Transport Mode</span>
                    <span className="font-mono font-bold uppercase text-[#0E8F47]">
                      {data.settings.emailProvider}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border border-[#C6B393] bg-white px-3.5 py-2.5">
                    <span className="text-[#5E5246]">APC Microsoft Entra ID SSO</span>
                    <span
                      className={`border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        data.envStatus.microsoftSsoConfigured
                          ? "border-[#0E8F47] bg-[#DCFCE7] text-[#09592C]"
                          : "border-[#D4AB50] bg-[#FEF3C7] text-[#78350F]"
                      }`}
                    >
                      {data.envStatus.microsoftSsoConfigured
                        ? "Connected"
                        : "Awaiting IT Tenant Keys"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="folio-panel relative overflow-hidden p-5">
                <div className="flex items-center gap-2.5">
                  <QuillInkwellWatermark className="h-8 w-8" />
                  <h2 className="font-display text-lg font-bold text-[#16192C]">
                    Recent Email Digest Dispatches
                  </h2>
                </div>
                {data.recentDigests.length === 0 ? (
                  <p className="mt-3 text-xs text-[#5E5246]">
                    No batched digests have been triggered yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {data.recentDigests.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between border border-[#C6B393] bg-white px-3 py-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#16192C]">
                            {d.sectionCode} • {d.teacherName}
                          </div>
                          <div className="text-[11px] text-[#5E5246]">
                            {d.submissionCount} requests batched ({d.triggerType})
                          </div>
                        </div>
                        <span className="border border-[#C6B393] bg-[#EFE6D2] px-2 py-0.5 font-mono text-[10px] font-bold">
                          {d.deliveryStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEACHERS & USERS */}
        {data && tab === "users" && (
          <div className="folio-panel p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <QuillInkwellWatermark className="h-8 w-8" />
                <h2 className="font-display text-lg font-bold text-[#16192C]">
                  All Provisioned Accounts
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter by name, ID, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="folio-input px-3 py-1.5 text-xs"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as "ALL" | RoleValue)}
                  className="folio-input px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="ALL">All Roles</option>
                  <option value="TEACHER">Teachers</option>
                  <option value="ADMIN">Admins</option>
                  <option value="STUDENT">Students</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadOverview()}
                  className="btn-heritage-paper px-3 py-1.5 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(true)}
                  className="btn-heritage-primary px-3.5 py-1.5 text-xs"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Create Account
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#C6B393] bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-[#C6B393] bg-[#EFE6D2]">
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Last Name</th>
                    <th className="px-3 py-2.5">First Name</th>
                    <th className="px-3 py-2.5">Middle Name</th>
                    <th className="px-3 py-2.5">Student ID / Course</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-[#EFE6D2]">
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-bold ${
                            u.role === "ADMIN"
                              ? "border-[#16192C] bg-[#16192C] text-[#D4AB50]"
                              : u.role === "TEACHER"
                              ? "border-[#0E8F47] bg-[#DCFCE7] text-[#09592C]"
                              : "border-[#C6B393] bg-[#EFE6D2] text-[#4A4540]"
                          }`}
                        >
                          {u.role === "ADMIN" && <Shield className="h-2.5 w-2.5" />}
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-bold text-[#16192C]">
                        {u.lastName}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#16192C]">
                        {u.firstName}
                      </td>
                      <td className="px-3 py-2 text-[#5E5246]">
                        {u.middleName || "-"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[#5E5246]">
                        {u.studentId
                          ? `${u.studentId} • ${u.courseCode || "APC"}`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{u.email}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleToggleUserActive(u)}
                          className={`border px-2 py-0.5 font-mono text-[10px] font-bold cursor-pointer ${
                            u.isActive
                              ? "border-[#0E8F47] bg-[#DCFCE7] text-[#09592C]"
                              : "border-[#A92B2C] bg-[#FEE2E2] text-[#7F1D1D]"
                          }`}
                        >
                          {u.isActive ? "ACTIVE" : "INACTIVE"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openEditUserDrawer(u)}
                          className="btn-heritage-paper px-3 py-1 text-[11px]"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SECTIONS & TERMS */}
        {data && tab === "sections" && (
          <div className="folio-panel p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <NoliFiliBooksWatermark className="h-8 w-10" />
                <h2 className="font-display text-lg font-bold text-[#16192C]">
                  College-Wide Sections
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadOverview()}
                  className="btn-heritage-paper px-3 py-1.5 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateSectionModal(true)}
                  className="btn-heritage-primary px-3.5 py-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Section
                </button>
              </div>
            </div>
            <div className="space-y-2.5">
              {data.sections.map((sec) => (
                <div
                  key={sec.id}
                  className="flex flex-col gap-3 border border-[#C6B393] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-[#16192C] bg-[#16192C] px-2 py-0.5 font-mono text-xs font-bold text-[#D4AB50]">
                        {sec.code}
                      </span>
                      <span className="font-bold text-[#16192C]">{sec.name}</span>
                      <span className="text-xs text-[#5E5246]">({sec.term})</span>
                      {!sec.teacherId && (
                        <span className="border border-[#D4AB50] bg-[#FEF3C7] px-2 py-0.5 font-mono text-[10px] font-bold text-[#78350F]">
                          NEEDS TEACHER
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-[#5E5246]">
                      {sec._count?.enrollments ?? 0} students •{" "}
                      {sec._count?.quests ?? 0} quests • Rankings:{" "}
                      <strong>{sec.leaderboardVisible ? "VISIBLE" : "HIDDEN"}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[#16192C]">
                      {sec.teacher
                        ? `Prof. ${sec.teacher.firstName} ${sec.teacher.lastName}`
                        : "Unassigned"}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditSectionDrawer(sec)}
                      title="Edit Section"
                      className="btn-heritage-paper px-3 py-1.5 text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: GLOBAL SYSTEM & EMAIL SETTINGS */}
        {data && settingsForm && tab === "settings" && (
          <div className="max-w-xl">
            <form onSubmit={handleSaveSettings} className="folio-panel p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <LamparillaWreathWatermark className="h-8 w-8" />
                <h2 className="font-display text-lg font-bold text-[#16192C]">
                  Academic Term &amp; Batch Email Settings
                </h2>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Active Term
                </label>
                <input
                  required
                  value={settingsForm.activeTerm}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, activeTerm: e.target.value })
                  }
                  className="folio-input w-full px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Students Needed Before Sending 1 Combined Email
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={settingsForm.defaultDigestThreshold}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      defaultDigestThreshold: Number(e.target.value),
                    })
                  }
                  className="folio-input w-full px-3 py-2 font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Email Mode
                </label>
                <select
                  value={settingsForm.emailProvider}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      emailProvider: e.target.value as "preview" | "resend" | "smtp",
                    })
                  }
                  className="folio-input w-full px-3 py-2 text-xs font-bold"
                >
                  <option value="preview">
                    Preview Mode (No SMTP needed)
                  </option>
                  <option value="resend">Resend API</option>
                  <option value="smtp">SMTP / Outlook Relay</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={settingsBusy}
                className="btn-heritage-primary px-4 py-2.5 text-xs"
              >
                {settingsBusy ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>
        )}

        {/* TAB 5: FULL TEACHER OVERRIDE WORKSPACE */}
        {data && tab === "override" && (
          <TeacherWorkspace
            apiBase="/api/workspace"
            initialSections={data.sections}
            initialSectionId={overrideSectionId}
            isAdminOverride={true}
            teachersForAssign={teachersList}
            onSectionsChanged={() => void loadOverview()}
          />
        )}
      </div>

      {/* CREATE TEACHER / USER MODAL */}
      <ModalDrawer
        open={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        title="Create Teacher / User Account"
      >
        <form onSubmit={handleCreateUser} className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Account Role
            </label>
            <select
              value={newRole}
              onChange={(e) => {
                const role = e.target.value as RoleValue;
                setNewRole(role);
                setNewPassword(
                  role === "TEACHER"
                    ? "Teacher@RizLife2026"
                    : role === "ADMIN"
                    ? "Admin@RizLife2026"
                    : "Student@2026"
                );
              }}
              className="folio-input w-full px-3 py-2 text-xs font-bold"
            >
              <option value="TEACHER">Teacher (Faculty)</option>
              <option value="ADMIN">Administrator</option>
              <option value="STUDENT">Student</option>
            </select>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Last Name
              </label>
              <input
                required
                placeholder="Last Name"
                value={newLast}
                onChange={(e) => setNewLast(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                First Name
              </label>
              <input
                required
                placeholder="First Name"
                value={newFirst}
                onChange={(e) => setNewFirst(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Middle Name
              </label>
              <input
                placeholder="Middle Name (optional)"
                value={newMiddle}
                onChange={(e) => setNewMiddle(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              APC Email
            </label>
            <input
              required
              type="email"
              placeholder={
                newRole === "STUDENT"
                  ? "student@student.apc.edu.ph"
                  : "faculty@apc.edu.ph"
              }
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="folio-input w-full px-3 py-2 text-xs"
            />
          </div>

          {newRole === "STUDENT" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                placeholder="Student ID (2024-140...)"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                className="folio-input px-3 py-2 text-xs"
              />
              <input
                placeholder="Course Code (BSIT)"
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                className="folio-input px-3 py-2 text-xs"
              />
            </div>
          )}

          {newRole === "TEACHER" && data && data.sections.length > 0 && (
            <div className="folio-tonal p-2.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Assign to Sections (Optional)
              </div>
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {data.sections.map((sec) => {
                  const checked = assignSectionIds.includes(sec.id);
                  return (
                    <label
                      key={sec.id}
                      className="flex items-center justify-between gap-2 border border-[#D3C3A7] bg-white px-2 py-1 text-[11px] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#16192C]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setAssignSectionIds((prev) =>
                              checked
                                ? prev.filter((id) => id !== sec.id)
                                : [...prev, sec.id]
                            )
                          }
                          className="accent-[#0E8F47]"
                        />
                        {sec.code} ({sec.term})
                      </span>
                      <span
                        className={`text-[10px] ${
                          sec.teacherId
                            ? "text-[#5E5246]"
                            : "font-bold text-[#8A6923]"
                        }`}
                      >
                        {sec.teacherId ? "Has teacher" : "Unassigned"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Temporary Default Password
            </label>
            <input
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="folio-input w-full px-3 py-2 font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={createUserBusy}
            className="btn-heritage-primary w-full py-2.5 text-xs"
          >
            {createUserBusy ? "Creating..." : `Provision ${newRole} Account`}
          </button>
        </form>
      </ModalDrawer>

      {/* CREATE SECTION MODAL */}
      <ModalDrawer
        open={showCreateSectionModal}
        onClose={() => setShowCreateSectionModal(false)}
        title="Create Section"
      >
        <form onSubmit={handleCreateSection} className="space-y-3">
          <input
            required
            placeholder="Section Code (e.g. IT243)"
            value={secCode}
            onChange={(e) => setSecCode(e.target.value)}
            className="folio-input w-full px-3 py-2 text-xs"
          />
          <input
            required
            placeholder="Section Name (Life and Works of Rizal)"
            value={secName}
            onChange={(e) => setSecName(e.target.value)}
            className="folio-input w-full px-3 py-2 text-xs"
          />
          <input
            required
            value={secTerm}
            onChange={(e) => setSecTerm(e.target.value)}
            className="folio-input w-full px-3 py-2 text-xs"
          />
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Teacher Assignment
            </label>
            <select
              value={secTeacherId}
              onChange={(e) => setSecTeacherId(e.target.value)}
              className="folio-input w-full px-3 py-2 text-xs"
            >
              <option value="">- Unassigned (Assign Teacher Later) -</option>
              {teachersList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.lastName}, {t.firstName} ({t.email})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn-heritage-primary w-full py-2.5 text-xs"
          >
            Create Section
          </button>
        </form>
      </ModalDrawer>

      {/* EDIT USER ACCOUNT MODAL */}
      <ModalDrawer
        open={Boolean(editUserTarget)}
        onClose={() => setEditUserTarget(null)}
        subtitle={editUserTarget?.email}
        title="Edit Account Details"
      >
        {editUserTarget && (
          <form onSubmit={requestSaveUserEdit} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Role
              </label>
              <select
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value as RoleValue)}
                className="folio-input w-full px-3 py-2 text-xs font-bold"
              >
                <option value="TEACHER">Teacher (Faculty)</option>
                <option value="ADMIN">Administrator</option>
                <option value="STUDENT">Student</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Last Name
                </label>
                <input
                  required
                  value={editUserLast}
                  onChange={(e) => setEditUserLast(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  First Name
                </label>
                <input
                  required
                  value={editUserFirst}
                  onChange={(e) => setEditUserFirst(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Middle Name
                </label>
                <input
                  value={editUserMiddle}
                  onChange={(e) => setEditUserMiddle(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                APC Email
              </label>
              <input
                required
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            {editUserRole === "STUDENT" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                    Student ID
                  </label>
                  <input
                    value={editUserStudentId}
                    onChange={(e) => setEditUserStudentId(e.target.value)}
                    className="folio-input w-full px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                    Course Code
                  </label>
                  <input
                    value={editUserCourse}
                    onChange={(e) => setEditUserCourse(e.target.value)}
                    className="folio-input w-full px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}
            <button type="submit" className="btn-heritage-primary w-full py-2.5 text-sm">
              Save Account Changes
            </button>

            <div className="space-y-2.5 border-t border-[#C6B393] pt-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Reset Temporary Password
              </label>
              <div className="flex gap-2">
                <input
                  minLength={6}
                  value={resetPwValue}
                  onChange={(e) => setResetPwValue(e.target.value)}
                  className="folio-input flex-1 px-3 py-2 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleResetUserPasswordFromEdit}
                  className="btn-heritage-ink px-3 py-2 text-xs"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset PW
                </button>
              </div>
            </div>

            {editUserTarget.id !== user.userId && (
              <div className="border-t border-[#C6B393] pt-4">
                <button
                  type="button"
                  onClick={() => handleDeleteUser(editUserTarget)}
                  className="btn-heritage-danger w-full py-2.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Account Permanently
                </button>
              </div>
            )}
          </form>
        )}
      </ModalDrawer>

      {/* EDIT SECTION MODAL */}
      <ModalDrawer
        open={Boolean(editSecTarget)}
        onClose={() => setEditSecTarget(null)}
        subtitle={editSecTarget?.code}
        title="Edit Section"
      >
        {editSecTarget && (
          <form onSubmit={requestSaveSectionEdit} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Section Code
              </label>
              <input
                required
                value={editSecCode}
                onChange={(e) => setEditSecCode(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Section Name
              </label>
              <input
                required
                value={editSecName}
                onChange={(e) => setEditSecName(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Academic Term
              </label>
              <input
                required
                value={editSecTerm}
                onChange={(e) => setEditSecTerm(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Assigned Teacher
              </label>
              <select
                value={editSecTeacherId}
                onChange={(e) => setEditSecTeacherId(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              >
                <option value="">- Unassigned (Assign Later) -</option>
                {teachersList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.lastName}, {t.firstName} ({t.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Email Summary Batch Threshold
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={editSecThreshold}
                onChange={(e) => setEditSecThreshold(Number(e.target.value))}
                className="folio-input w-full px-3 py-2 font-mono text-xs"
              />
            </div>
            <button type="submit" className="btn-heritage-primary w-full py-2.5 text-sm">
              Save Section Changes
            </button>

            <div className="border-t border-[#C6B393] pt-4">
              <button
                type="button"
                onClick={() => handleDeleteSection(editSecTarget)}
                className="btn-heritage-danger w-full py-2.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Section Permanently
              </button>
            </div>
          </form>
        )}
      </ModalDrawer>

      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        onConfirm={executeConfirm}
        busy={confirmBusy}
        title={confirmState?.title || ""}
        description={confirmState?.description || ""}
        highlightText={confirmState?.highlightText}
        confirmLabel={confirmState?.confirmLabel || "Confirm"}
        variant={confirmState?.variant || "primary"}
      />
    </VintageShell>
  );
}
