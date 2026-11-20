"use client";

import React, { useState } from "react";
import {
  ClipboardCheck,
  FileSpreadsheet,
  Layers,
  Stamp,
  Trophy,
  Users,
} from "lucide-react";
import {
  TeacherWorkspace,
  VintageShell,
  type WorkspaceSectionOption,
  type WorkspaceSummaryStats,
  type WorkspaceTab,
} from "@rizlife/shared/ui";
import type { SessionPayload } from "@rizlife/shared/types";

export function TeacherDashboardClient({
  user,
  initialSections,
  initialSectionId,
  initialTab,
}: {
  user: SessionPayload;
  initialSections: WorkspaceSectionOption[];
  initialSectionId: string | null;
  initialTab: string | null;
}) {
  const validTabs: WorkspaceTab[] = [
    "queue",
    "stampcard",
    "quests",
    "roster",
    "tracker",
    "leaderboard",
  ];
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    validTabs.includes(initialTab as WorkspaceTab)
      ? (initialTab as WorkspaceTab)
      : "queue"
  );
  const [summary, setSummary] = useState<WorkspaceSummaryStats | null>(null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <VintageShell
      portal="teacher"
      portalLabel="Teacher Portal"
      userName={`Prof. ${user.firstName} ${user.lastName}`}
      userSubtitle={user.email}
      onLogout={handleLogout}
      onChangePassword={() => {
        window.location.href = "/change-password";
      }}
      navItems={[
        {
          key: "queue",
          label: "Check Work",
          icon: <ClipboardCheck className="h-4 w-4" />,
          badge: summary?.pendingCount,
        },
        {
          key: "stampcard",
          label: "Stamp Card",
          icon: <Stamp className="h-4 w-4" />,
        },
        {
          key: "quests",
          label: "Manage Tasks",
          icon: <Layers className="h-4 w-4" />,
          badge: summary?.questsCount,
        },
        {
          key: "roster",
          label: "My Students",
          icon: <Users className="h-4 w-4" />,
          badge: summary?.studentsCount,
        },
        {
          key: "tracker",
          label: "Excel Tracker",
          icon: <FileSpreadsheet className="h-4 w-4" />,
        },
        {
          key: "leaderboard",
          label: "Rankings",
          icon: <Trophy className="h-4 w-4" />,
        },
      ]}
      activeNavKey={activeTab}
      onSelectNav={(k) => setActiveTab(k as WorkspaceTab)}
      statPlaques={
        summary
          ? [
              {
                label: "Students",
                value: summary.studentsCount,
                icon: "sun",
              },
              {
                label: "Tasks",
                value: summary.questsCount,
                icon: "scroll",
              },
              {
                label: "Waiting Check",
                value: summary.pendingCount,
                icon: "seal",
              },
            ]
          : []
      }
      rightSlot={
        summary ? (
          <span className="border border-[#16192C] bg-[#16192C] px-2.5 py-1 font-mono text-xs font-bold text-[#D4AB50]">
            Section {summary.sectionCode}
          </span>
        ) : null
      }
    >
      <TeacherWorkspace
        apiBase="/api/workspace"
        initialSections={initialSections}
        initialSectionId={initialSectionId}
        initialTab={activeTab}
        externalTab={activeTab}
        onTabChange={setActiveTab}
        onSummaryChange={setSummary}
        isAdminOverride={user.role === "ADMIN"}
      />
    </VintageShell>
  );
}
