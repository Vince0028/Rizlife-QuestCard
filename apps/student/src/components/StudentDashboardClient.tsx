"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Feather,
  LayoutGrid,
  ListChecks,
  RefreshCw,
  Send,
  Trophy,
} from "lucide-react";
import {
  ConfirmDialog,
  LamparillaWreathWatermark,
  ModalDrawer,
  NoliFiliBooksWatermark,
  RizalQuestCardBoard,
  StatusBadge,
  VintageShell,
} from "@rizlife/shared/ui";
import { validateSubmissionUrl } from "@rizlife/shared/validation";
import {
  formatQuestDeadline,
  getQuestDeadlineState,
  type DeadlineStateKind,
  type QuestDeadlineState,
} from "@rizlife/shared/deadline";
import { QUEST_CATEGORY_LABELS, type SessionPayload } from "@rizlife/shared/types";
import type {
  StudentQuest,
  StudentSubmission,
  QuestCardApiResponse,
  ListFilter,
} from "./student-dashboard-types";
import { deadlineToneClass, formatShortDate } from "./student-dashboard-format";

const MAX_BANNER_CHIPS = 5;

export function StudentDashboardClient({
  initialUser,
}: {
  initialUser: SessionPayload;
}) {
  const [data, setData] = useState<QuestCardApiResponse | null>(null);
  const [sectionId, setSectionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"card" | "list" | "leaderboard">("card");
  const [listFilter, setListFilter] = useState<ListFilter>("ALL");
  // Ticks every minute so tasks flip from "Due today" to "Overdue" without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [selectedQuest, setSelectedQuest] = useState<StudentQuest | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Finals Track selection state
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [trackSelectionBusy, setTrackSelectionBusy] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const loadQuestCard = useCallback(async (targetSectionId?: string) => {
    setLoading(true);
    try {
      const qs = targetSectionId
        ? `?sectionId=${encodeURIComponent(targetSectionId)}`
        : "";
      const res = await fetch(`/api/questcard${qs}`);
      if (res.ok) {
        const json = (await res.json()) as QuestCardApiResponse;
        setData(json);
        if (json.activeSection) {
          setSectionId(json.activeSection.id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuestCard();
  }, [loadQuestCard]);

  const submissionByQuestId = useMemo(() => {
    const map = new Map<string, StudentSubmission>();
    if (!data) return map;
    for (const s of data.submissions) {
      map.set(s.questId, s);
    }
    return map;
  }, [data]);

  const deadlineByQuestId = useMemo(() => {
    const map = new Map<string, QuestDeadlineState>();
    if (!data) return map;
    for (const q of data.quests) {
      const status = submissionByQuestId.get(q.id)?.status ?? "NOT_STARTED";
      map.set(q.id, getQuestDeadlineState(q.deadline, status, now));
    }
    return map;
  }, [data, submissionByQuestId, now]);

  const counts = useMemo(() => {
    const c = {
      stamped: 0,
      pending: 0,
      revision: 0,
      notStarted: 0,
      overdue: 0,
      dueToday: 0,
      dueSoon: 0,
    };
    if (!data) return c;
    for (const q of data.quests) {
      const status = submissionByQuestId.get(q.id)?.status ?? "NOT_STARTED";
      if (status === "STAMPED") c.stamped += 1;
      else if (status === "PENDING_REVIEW") c.pending += 1;
      else if (status === "NEEDS_REVISION") c.revision += 1;
      else c.notStarted += 1;

      const kind = deadlineByQuestId.get(q.id)?.kind;
      if (kind === "OVERDUE") c.overdue += 1;
      else if (kind === "DUE_TODAY") c.dueToday += 1;
      else if (kind === "DUE_SOON") c.dueSoon += 1;
    }
    return c;
  }, [data, submissionByQuestId, deadlineByQuestId]);

  /** Tasks for the banner, ordered Overdue → Due today → Due soon, then by task number. */
  const deadlineAlerts = useMemo(() => {
    if (!data) return [];
    const order: Partial<Record<DeadlineStateKind, number>> = {
      OVERDUE: 0,
      DUE_TODAY: 1,
      DUE_SOON: 2,
    };
    return data.quests
      .flatMap((q) => {
        const state = deadlineByQuestId.get(q.id);
        return state && order[state.kind] !== undefined ? [{ quest: q, state }] : [];
      })
      .sort(
        (a, b) =>
          order[a.state.kind]! - order[b.state.kind]! ||
          a.quest.taskNumber - b.quest.taskNumber
      );
  }, [data, deadlineByQuestId]);

  const urlInspection = useMemo(() => {
    if (!urlInput.trim()) return null;
    return validateSubmissionUrl(urlInput);
  }, [urlInput]);

  function openQuestDrawer(q: StudentQuest) {
    const sub = submissionByQuestId.get(q.id);
    setSelectedQuest(q);
    setUrlInput(sub?.submissionUrl || "");
    setNoteInput(sub?.studentNote || "");
    setSubmitFeedback(null);
  }

  function handleRequestSubmitConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuest) return;
    const check = validateSubmissionUrl(urlInput);
    if (!check.valid) {
      setSubmitFeedback({
        type: "err",
        text: check.error || "Please enter a valid URL first.",
      });
      return;
    }
    setSubmitFeedback(null);
    setConfirmSubmitOpen(true);
  }

  async function executeSubmitQuest() {
    if (!selectedQuest) return;
    setSubmitBusy(true);
    setSubmitFeedback(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId: selectedQuest.id,
          submissionUrl: urlInput,
          studentNote: noteInput,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitFeedback({
          type: "err",
          text: json.error || "Could not submit quest link.",
        });
        setConfirmSubmitOpen(false);
        return;
      }
      setConfirmSubmitOpen(false);
      setSubmitFeedback({
        type: "ok",
        text: "Submitted! Your request has been queued into your teacher's review batch.",
      });
      await loadQuestCard(sectionId);
    } catch {
      setConfirmSubmitOpen(false);
      setSubmitFeedback({
        type: "err",
        text: "Network error while submitting. Please try again.",
      });
    } finally {
      setSubmitBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const totalQuests = data?.quests.length ?? 0;
  const progressPct =
    totalQuests > 0 ? Math.round((counts.stamped / totalQuests) * 100) : 0;

  return (
    <VintageShell
      portal="student"
      portalLabel="Student Portal"
      userName={`${initialUser.lastName}, ${initialUser.firstName}`}
      userSubtitle={`${initialUser.studentId || initialUser.email} • ${
        initialUser.courseCode || "APC"
      }`}
      onLogout={handleLogout}
      onChangePassword={() => {
        window.location.href = "/change-password";
      }}
      navItems={[
        {
          key: "card",
          label: "Quest Card",
          icon: <LayoutGrid className="h-4 w-4" />,
        },
        {
          key: "list",
          label: "To-Do List",
          icon: <ListChecks className="h-4 w-4" />,
          badge: counts.notStarted + counts.revision,
        },
        {
          key: "leaderboard",
          label: "Rankings",
          icon: <Trophy className="h-4 w-4" />,
        },
      ]}
      activeNavKey={tab}
      onSelectNav={(k) => {
        setTab(k as "card" | "list" | "leaderboard");
        void loadQuestCard(sectionId || undefined);
      }}
      statPlaques={
        data?.activeSection
          ? [
              {
                label: "Stamped",
                value: `${counts.stamped}/${totalQuests}`,
                icon: "seal",
              },
              {
                label: "Waiting Check",
                value: counts.pending,
                icon: "scroll",
              },
              {
                label: "Completion",
                value: `${progressPct}%`,
                icon: "sun",
              },
            ]
          : []
      }
      rightSlot={
        <div className="flex items-center gap-2">
          {data && data.sections.length > 0 && (
            <>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#5E5246]">
                Section:
              </span>
              {data.sections.length > 1 ? (
                <select
                  value={sectionId}
                  onChange={(e) => {
                    setSectionId(e.target.value);
                    void loadQuestCard(e.target.value);
                  }}
                  className="folio-input px-2.5 py-1 text-xs font-bold"
                >
                  {data.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} ({s.term})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="border border-[#16192C] bg-[#16192C] px-2.5 py-1 font-mono text-xs font-bold text-[#D4AB50]">
                  {data.activeSection?.code}
                </span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => void loadQuestCard(sectionId || undefined)}
            className="btn-heritage-paper px-2.5 py-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      }
    >
      {loading && !data ? (
        <div className="folio-panel p-10 text-center text-sm text-[#5E5246]">
          Loading your Rizal QuestCard...
        </div>
      ) : !data?.activeSection ? (
        <div className="folio-panel p-10 text-center">
          <Feather className="mx-auto h-9 w-9 text-[#8A6923]" />
          <h2 className="mt-3 font-display text-xl font-bold text-[#16192C]">
            No Enrolled RizLife Section Yet
          </h2>
          <p className="mt-1 text-sm text-[#5E5246]">
            Ask your GE-Rizal professor to add your APC email (
            <span className="font-mono font-semibold text-[#16192C]">
              {initialUser.email}
            </span>
            ) into your class section.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(counts.revision > 0 || deadlineAlerts.length > 0) && (() => {
            const urgent = counts.overdue > 0 || counts.revision > 0;
            const summary = [
              counts.overdue > 0 && `${counts.overdue} overdue`,
              counts.dueToday > 0 && `${counts.dueToday} due today`,
              counts.dueSoon > 0 && `${counts.dueSoon} due soon`,
            ].filter(Boolean);
            const shown = deadlineAlerts.slice(0, MAX_BANNER_CHIPS);
            const hidden = deadlineAlerts.length - shown.length;
            return (
              <div
                className={`space-y-2 border-l-4 px-4 py-2.5 text-xs font-medium ${
                  urgent
                    ? "border-[#A92B2C] bg-[#FEE2E2] text-[#7F1D1D]"
                    : "border-[#D97706] bg-[#FEF3C7] text-[#78350F]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    {summary.length > 0 && `Tasks: ${summary.join(" · ")}. `}
                    {counts.revision > 0 &&
                      `${counts.revision} task(s) need revision.`}
                  </span>
                </div>
                {shown.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-6">
                    {shown.map(({ quest, state }) => (
                      <button
                        key={quest.id}
                        type="button"
                        onClick={() => openQuestDrawer(quest)}
                        title={state.detail}
                        className={`inline-flex max-w-full items-center gap-1 border bg-white px-2 py-1 text-left text-[11px] transition hover:shadow-sm ${
                          state.kind === "OVERDUE"
                            ? "border-[#A92B2C] text-[#7F1D1D] hover:bg-[#FFF5F5]"
                            : "border-[#D97706] text-[#78350F] hover:bg-[#FFFBEB]"
                        }`}
                      >
                        <span className="shrink-0 font-mono font-bold">
                          #{quest.taskNumber}
                        </span>
                        <span className="max-w-[14rem] truncate font-semibold">
                          {quest.title}
                        </span>
                        <span className="shrink-0">· {state.shortDetail}</span>
                      </button>
                    ))}
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTab("list");
                          // Land on the group the first hidden task belongs to.
                          setListFilter(
                            deadlineAlerts[shown.length].state.kind === "OVERDUE"
                              ? "OVERDUE"
                              : "DUE_SOON"
                          );
                        }}
                        className="px-2 py-1 text-[11px] font-bold underline underline-offset-2"
                      >
                        +{hidden} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* FINALS CAPSTONE TRACK BANNER */}
          {data.finalsTrack && (
            <div className="rounded border border-[#C6B393] bg-[#FFFBF3] p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EFE6D2] text-[#8A6923] text-lg">
                    {data.finalsTrack.track === "SYSTEM"
                      ? "💻"
                      : data.finalsTrack.track === "OPENLEARNING_MODULE"
                      ? "📖"
                      : "⏳"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A6923]">
                        RizLife Finals Capstone Requirement
                      </span>
                      {data.finalsTrack.track === "UNDECIDED" && (
                        <span className="animate-pulse rounded bg-[#FEE2E2] px-1.5 py-0.2 text-[10px] font-bold text-[#991B1B]">
                          Action Required
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-[#16192C]">
                      {data.finalsTrack.track === "SYSTEM" &&
                        "Option A: Creating a System (Software/App Project)"}
                      {data.finalsTrack.track === "OPENLEARNING_MODULE" &&
                        `Option B: OpenLearning Module — ${
                          data.finalsTrack.assignedModuleTitle ||
                          "Awaiting Teacher/Admin Module Assignment"
                        }`}
                      {data.finalsTrack.track === "UNDECIDED" &&
                        "Choose your Finals Track: System vs. OpenLearning Module"}
                    </div>
                    <p className="mt-0.5 text-xs text-[#5E5246]">
                      {data.finalsTrack.track === "SYSTEM" &&
                        "You are creating a system/software project for your capstone."}
                      {data.finalsTrack.track === "OPENLEARNING_MODULE" &&
                        (data.finalsTrack.assignedModuleTitle
                          ? "You are assigned to complete this specific OpenLearning module for your final output."
                          : "You chose the Module track! Your professor or admin will configure your specific module.")}
                      {data.finalsTrack.track === "UNDECIDED" &&
                        "Decide whether you want to build a system project or complete an assigned OpenLearning module."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTrackModalOpen(true)}
                    className="btn-heritage-paper px-3 py-1.5 text-xs font-semibold"
                  >
                    {data.finalsTrack.track === "UNDECIDED"
                      ? "Choose My Track"
                      : "Change Track"}
                  </button>

                  {data.finalsTrack.track === "OPENLEARNING_MODULE" &&
                    data.finalsTrack.assignedModuleUrl && (
                      <a
                        href={data.finalsTrack.assignedModuleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-heritage-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                      >
                        <span>Launch OpenLearning Module</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUTHENTIC RIZAL QUEST CARD */}
          {tab === "card" && (
            <RizalQuestCardBoard
              studentName={`${initialUser.lastName}, ${initialUser.firstName}${
                initialUser.middleName ? ` ${initialUser.middleName}` : ""
              }`}
              studentNumber={initialUser.studentId}
              courseCode={initialUser.courseCode}
              sectionCode={data.activeSection.code}
              term={data.activeSection.term}
              quests={data.quests}
              statusByQuestId={
                new Map(
                  data.quests.map((q) => [
                    q.id,
                    submissionByQuestId.get(q.id)?.status ?? "NOT_STARTED",
                  ])
                )
              }
              selectedQuestId={selectedQuest?.id ?? null}
              onRefresh={() => void loadQuestCard(sectionId || undefined)}
              refreshing={loading}
              onSelectQuest={(q) => {
                const found = data.quests.find((item) => item.id === q.id);
                if (found) openQuestDrawer(found);
              }}
            />
          )}

          {/* TAB: TO-DO / LIST */}
          {tab === "list" && (
            <section className="folio-panel relative overflow-hidden p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <NoliFiliBooksWatermark className="h-8 w-10" />
                  {(
                    [
                      ["ALL", "All Tasks"],
                      [
                        "OVERDUE",
                        counts.overdue > 0 ? `Overdue (${counts.overdue})` : "Overdue",
                      ],
                      [
                        "DUE_SOON",
                        counts.dueToday + counts.dueSoon > 0
                          ? `Due Soon (${counts.dueToday + counts.dueSoon})`
                          : "Due Soon",
                      ],
                      ["NOT_STARTED", "Not Started"],
                      ["PENDING_REVIEW", "Pending Review"],
                      ["NEEDS_REVISION", "Needs Revision"],
                      ["STAMPED", "Stamped"],
                    ] as const satisfies ReadonlyArray<readonly [ListFilter, string]>
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setListFilter(key)}
                      className={
                        listFilter === key
                          ? "btn-heritage-ink px-3 py-1.5 text-xs"
                          : "btn-heritage-paper px-3 py-1.5 text-xs"
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void loadQuestCard(sectionId || undefined)}
                  className="btn-heritage-paper px-3 py-1.5 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {data.quests.length === 0 ? (
                <div className="folio-tonal p-6 text-center text-xs text-[#5E5246]">
                  No tasks have been posted by your instructor yet.
                </div>
              ) : (() => {
                const visibleQuests = data.quests.filter((q) => {
                  const status = submissionByQuestId.get(q.id)?.status ?? "NOT_STARTED";
                  const kind = deadlineByQuestId.get(q.id)?.kind;
                  if (listFilter === "ALL") return true;
                  if (listFilter === "OVERDUE") return kind === "OVERDUE";
                  if (listFilter === "DUE_SOON")
                    return kind === "DUE_TODAY" || kind === "DUE_SOON";
                  return status === listFilter;
                });
                if (visibleQuests.length === 0) {
                  return (
                    <div className="folio-tonal p-6 text-center text-xs text-[#5E5246]">
                      {listFilter === "OVERDUE"
                        ? "Nothing overdue. Nice work!"
                        : listFilter === "DUE_SOON"
                        ? "Nothing due in the next 3 days."
                        : "No tasks match this filter."}
                    </div>
                  );
                }
                return (
                <div className="space-y-2.5">
                  {visibleQuests
                    .map((q) => {
                      const sub = submissionByQuestId.get(q.id);
                      const status = sub?.status ?? "NOT_STARTED";
                      const deadlineState = deadlineByQuestId.get(q.id);
                      const kind = deadlineState?.kind ?? "NO_DEADLINE";
                      return (
                        <div
                          key={q.id}
                          className={`flex flex-col gap-3 border border-[#C6B393] bg-white p-4 sm:flex-row sm:items-center sm:justify-between ${
                            kind === "OVERDUE"
                              ? "border-l-4 border-l-[#A92B2C]"
                              : kind === "DUE_TODAY"
                              ? "border-l-4 border-l-[#D97706]"
                              : ""
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="border border-[#16192C] bg-[#16192C] px-2 py-0.5 font-mono text-xs font-bold text-[#FAF6EC]">
                                #{q.taskNumber}
                              </span>
                              <h3 className="font-semibold text-[#16192C]">
                                {q.title}
                              </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5E5246]">
                              <span>{QUEST_CATEGORY_LABELS[q.category]}</span>
                              <span
                                className={`inline-flex items-center gap-1 ${deadlineToneClass(kind)}`}
                              >
                                <Calendar className="h-3 w-3" />
                                {deadlineState?.detail ?? "No deadline"}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <StatusBadge status={status} deadlineKind={kind} />
                            <button
                              type="button"
                              onClick={() => openQuestDrawer(q)}
                              className="btn-heritage-ink shrink-0 px-3.5 py-2 text-xs"
                            >
                              {status === "STAMPED" ? "View Stamp" : "Open & Submit"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
                );
              })()}
            </section>
          )}

          {/* TAB: CONDITIONAL LEADERBOARD */}
          {tab === "leaderboard" && (
            <section className="folio-panel p-6">
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void loadQuestCard(sectionId || undefined)}
                  className="btn-heritage-paper px-3 py-1.5 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              {!data.leaderboard.visible ? (
                <div className="mx-auto max-w-md py-8 text-center">
                  <LamparillaWreathWatermark className="mx-auto h-16 w-16" />
                  <h2 className="mt-3 font-display text-xl font-bold text-[#16192C]">
                    Class Rankings Locked
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#5E5246]">
                    Rankings are currently hidden by your instructor until the end of
                    the term. Keep finishing your quests early-submission timestamps
                    are saved automatically for speed tie-breakers!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <LamparillaWreathWatermark className="h-9 w-9" />
                    <h2 className="font-display text-xl font-bold text-[#16192C]">
                      {data.activeSection.code} Speed &amp; Completion Leaderboard
                    </h2>
                  </div>
                  <div className="overflow-x-auto border border-[#C6B393] bg-white">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b-2 border-[#C6B393] bg-[#EFE6D2] text-[#16192C]">
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Course</th>
                          <th className="px-4 py-3">Quests Stamped</th>
                          <th className="px-4 py-3">Milestone Reached</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.leaderboard.entries.map((entry) => {
                          const isMe = entry.studentId === initialUser.userId;
                          return (
                            <tr
                              key={entry.studentId}
                              className={`border-b border-[#EFE6D2] ${
                                isMe ? "bg-[#DCFCE7] font-semibold" : ""
                              }`}
                            >
                              <td className="px-4 py-3 font-mono font-bold">
                                #{entry.rank}
                              </td>
                              <td className="px-4 py-3">
                                {entry.fullName}{" "}
                                {isMe && (
                                  <span className="ml-1 border border-[#0E8F47] bg-[#0E8F47] px-1.5 py-0.5 font-mono text-[10px] text-white">
                                    YOU
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">{entry.courseCode || "-"}</td>
                              <td className="px-4 py-3 font-mono font-bold text-[#0E8F47]">
                                {entry.stampedCount} / {entry.totalQuests} (
                                {entry.completionPct}%)
                              </td>
                              <td className="px-4 py-3 text-[#5E5246]">
                                {entry.speedLabel}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* QUEST SUBMISSION SLIDE-OVER DRAWER */}
      <ModalDrawer
        open={Boolean(selectedQuest)}
        onClose={() => setSelectedQuest(null)}
        subtitle={
          selectedQuest
            ? `Task #${selectedQuest.taskNumber} • ${
                QUEST_CATEGORY_LABELS[selectedQuest.category]
              }`
            : ""
        }
        title={selectedQuest?.title || ""}
      >
        {selectedQuest && (
          <div className="space-y-4">
            {(() => {
              const sub = submissionByQuestId.get(selectedQuest.id);
              const status = sub?.status ?? "NOT_STARTED";
              const deadlineState = deadlineByQuestId.get(selectedQuest.id);
              const kind = deadlineState?.kind ?? "NO_DEADLINE";
              const urgencyText =
                kind === "OVERDUE"
                  ? `Overdue · ${deadlineState?.relative}`
                  : kind === "DUE_TODAY" || kind === "DUE_SOON"
                  ? deadlineState?.label
                  : null;
              return (
                <>
                  <div
                    className={`folio-tonal flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 ${
                      kind === "OVERDUE"
                        ? "border-l-4 border-l-[#A92B2C]"
                        : kind === "DUE_TODAY"
                        ? "border-l-4 border-l-[#D97706]"
                        : ""
                    }`}
                  >
                    <StatusBadge status={status} deadlineKind={kind} />
                    <div className="text-right text-[11px] text-[#5E5246]">
                      <div>
                        Deadline:{" "}
                        <strong className="text-[#16192C]">
                          {formatQuestDeadline(selectedQuest.deadline)}
                        </strong>
                      </div>
                      {urgencyText && (
                        <div className={deadlineToneClass(kind)}>{urgencyText}</div>
                      )}
                    </div>
                  </div>

                  {(sub?.submittedAt || sub?.stampedAt) && (
                    <div className="grid gap-2 border border-[#C6B393] bg-white px-3.5 py-2.5 text-[11px] sm:grid-cols-2">
                      <div>
                        <span className="text-[#5E5246]">Requested Checking:</span>{" "}
                        <strong className="text-[#16192C]">
                          {sub.submittedAt
                            ? new Date(sub.submittedAt).toLocaleString("en-PH")
                            : "-"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#5E5246]">Checked &amp; Stamped:</span>{" "}
                        <strong className="text-[#0E8F47]">
                          {sub.stampedAt
                            ? new Date(sub.stampedAt).toLocaleString("en-PH")
                            : "Waiting for teacher"}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="relative overflow-hidden border border-[#C6B393] bg-white p-4 text-xs leading-relaxed text-[#4A4540]">
                    <NoliFiliBooksWatermark className="absolute right-2 top-2 h-11 w-14 opacity-30" />
                    <div className="mb-1.5 font-bold text-[#16192C]">
                      Task Instructions
                    </div>
                    <p className="relative z-10 whitespace-pre-line">
                      {selectedQuest.description}
                    </p>
                    {selectedQuest.openlearningUrl && (
                      <a
                        href={selectedQuest.openlearningUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-heritage-paper mt-3 px-3 py-1.5 text-xs"
                      >
                        Open Activity in OpenLearning
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  {sub?.teacherFeedback && (
                    <div
                      className={`border-l-4 p-3.5 text-xs ${
                        status === "NEEDS_REVISION"
                          ? "border-[#A92B2C] bg-[#FEE2E2] text-[#7F1D1D]"
                          : "border-[#0E8F47] bg-[#DCFCE7] text-[#14532D]"
                      }`}
                    >
                      <div className="font-bold">Instructor Note:</div>
                      <p className="mt-1">{sub.teacherFeedback}</p>
                    </div>
                  )}

                  {status === "STAMPED" ? (
                    <div className="border-2 border-[#0E8F47] bg-[#DCFCE7] p-4 text-center">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-[#0E8F47]" />
                      <div className="mt-2 font-display text-base font-bold text-[#09592C]">
                        Quest Verified &amp; Stamped!
                      </div>
                      <p className="mt-1 text-xs text-[#166534]">
                        Stamped on {formatShortDate(sub?.stampedAt ?? null)}
                      </p>
                      {sub?.submissionUrl && (
                        <a
                          href={sub.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold underline"
                        >
                          View Submitted Link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleRequestSubmitConfirm} className="space-y-3.5">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#5E5246]">
                          OpenLearning Submission Link
                        </label>
                        <input
                          type="url"
                          required
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://www.openlearning.com/apc/courses/rizlife/..."
                          className="folio-input w-full px-3 py-2 text-xs"
                        />
                        {urlInspection && !urlInspection.valid && (
                          <div className="mt-1.5 text-[11px] font-semibold text-[#A92B2C]">
                            {urlInspection.error}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#5E5246]">
                          Note (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder="Optional note..."
                          className="folio-input w-full px-3 py-2 text-xs"
                        />
                      </div>

                      {submitFeedback && (
                        <div
                          className={`border-l-4 px-3 py-2 text-xs font-semibold ${
                            submitFeedback.type === "ok"
                              ? "border-[#0E8F47] bg-[#DCFCE7] text-[#14532D]"
                              : "border-[#A92B2C] bg-[#FEE2E2] text-[#7F1D1D]"
                          }`}
                        >
                          {submitFeedback.text}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitBusy}
                        className="btn-heritage-primary w-full py-2.5 text-sm"
                      >
                        <Send className="h-4 w-4" />
                        {submitBusy
                          ? "Submitting..."
                          : status === "PENDING_REVIEW"
                          ? "Update Link"
                          : "Submit & Notify Teacher"}
                      </button>
                    </form>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </ModalDrawer>

      <ConfirmDialog
        open={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        onConfirm={executeSubmitQuest}
        busy={submitBusy}
        variant="primary"
        title={
          selectedQuest
            ? `Submit Task #${selectedQuest.taskNumber} for Checking?`
            : "Confirm Quest Submission"
        }
        description="Please double-check that your OpenLearning link below opens your exact work. Your teacher will check it and stamp your Quest Card."
        highlightText={urlInput.trim()}
        confirmLabel="Yes, Submit & Notify Teacher"
      />

      {/* FINALS TRACK SELECTION MODAL */}
      <ModalDrawer
        open={trackModalOpen}
        onClose={() => setTrackModalOpen(false)}
        title="Choose Your Finals Capstone Track"
        subtitle={data?.activeSection?.code ? `Section ${data.activeSection.code}` : undefined}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#5E5246]">
            For your RizLife final output, choose whether you will create an original system/application or complete an assigned OpenLearning module.
          </p>

          {trackError && (
            <div className="rounded border border-[#A92B2C] bg-[#FEE2E2] p-2.5 text-xs font-semibold text-[#7F1D1D]">
              {trackError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {/* OPTION 1: CREATE SYSTEM */}
            <button
              type="button"
              disabled={trackSelectionBusy}
              onClick={async () => {
                if (!data?.activeSection) return;
                setTrackSelectionBusy(true);
                setTrackError(null);
                try {
                  const res = await fetch("/api/finals-track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sectionId: data.activeSection.id,
                      finalsTrack: "SYSTEM",
                    }),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setTrackError(json.error || "Failed to update track. Please try again.");
                    return;
                  }
                  setTrackModalOpen(false);
                  await loadQuestCard(data.activeSection.id);
                } catch {
                  setTrackError("Network error while selecting track.");
                } finally {
                  setTrackSelectionBusy(false);
                }
              }}
              className={`flex flex-col items-start rounded-lg border-2 p-4 text-left transition hover:shadow-md ${
                data?.finalsTrack?.track === "SYSTEM"
                  ? "border-[#16192C] bg-[#EFE6D2]"
                  : "border-[#C6B393] bg-white hover:border-[#8A6923]"
              }`}
            >
              <div className="text-2xl mb-1">💻</div>
              <div className="font-display text-sm font-bold text-[#16192C]">
                Option A: Create a System
              </div>
              <p className="mt-1 text-[11px] text-[#5E5246]">
                Develop and submit an original software, web app, or digital platform inspired by Rizal&apos;s ideals.
              </p>
              {data?.finalsTrack?.track === "SYSTEM" && (
                <span className="mt-3 inline-block rounded bg-[#16192C] px-2 py-0.5 text-[10px] font-bold text-[#D4AB50]">
                  ✓ Current Selection
                </span>
              )}
            </button>

            {/* OPTION 2: OPENLEARNING MODULE */}
            <button
              type="button"
              disabled={trackSelectionBusy}
              onClick={async () => {
                if (!data?.activeSection) return;
                setTrackSelectionBusy(true);
                setTrackError(null);
                try {
                  const res = await fetch("/api/finals-track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sectionId: data.activeSection.id,
                      finalsTrack: "OPENLEARNING_MODULE",
                    }),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setTrackError(json.error || "Failed to update track. Please try again.");
                    return;
                  }
                  setTrackModalOpen(false);
                  await loadQuestCard(data.activeSection.id);
                } catch {
                  setTrackError("Network error while selecting track.");
                } finally {
                  setTrackSelectionBusy(false);
                }
              }}
              className={`flex flex-col items-start rounded-lg border-2 p-4 text-left transition hover:shadow-md ${
                data?.finalsTrack?.track === "OPENLEARNING_MODULE"
                  ? "border-[#8A6923] bg-[#FFFBEB]"
                  : "border-[#C6B393] bg-white hover:border-[#8A6923]"
              }`}
            >
              <div className="text-2xl mb-1">📖</div>
              <div className="font-display text-sm font-bold text-[#16192C]">
                Option B: OpenLearning Module
              </div>
              <p className="mt-1 text-[11px] text-[#5E5246]">
                Opt for the academic module track. Your teacher or admin will configure the specific module you need to finish.
              </p>
              {data?.finalsTrack?.track === "OPENLEARNING_MODULE" && (
                <span className="mt-3 inline-block rounded bg-[#8A6923] px-2 py-0.5 text-[10px] font-bold text-white">
                  ✓ Current Selection
                </span>
              )}
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setTrackModalOpen(false)}
              className="btn-heritage-paper px-4 py-1.5 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </ModalDrawer>
    </VintageShell>
  );
}
