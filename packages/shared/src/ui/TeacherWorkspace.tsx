"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Feather,
  FileSpreadsheet,
  HelpCircle,
  KeyRound,
  Layers,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Stamp,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import {
  QUEST_CATEGORY_LABELS,
  type DigestQueueSummary,
  type LeaderboardEntry,
  type QuestCategoryValue,
  type SubmissionStatusValue,
} from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ModalDrawer } from "./ModalDrawer";
import {
  LamparillaWreathWatermark,
  NoliFiliBooksWatermark,
  QuillInkwellWatermark,
} from "./RizalArt";
import { RizalQuestCardBoard } from "./RizalQuestCardBoard";
import { StampCelebrationOverlay } from "./StampCelebrationOverlay";
import { StatusBadge } from "./StatusBadge";

export interface WorkspaceSectionOption {
  id: string;
  code: string;
  name: string;
  term: string;
  teacherId: string | null;
  teacher?: { firstName: string; lastName: string; email: string } | null;
  _count?: { enrollments: number; quests: number };
}

export interface WorkspaceQuestItem {
  id: string;
  sectionId: string;
  taskNumber: number;
  title: string;
  description: string;
  category: QuestCategoryValue;
  openlearningUrl: string | null;
  startDate: string | null;
  deadline: string | null;
}

export interface WorkspaceStudentItem {
  id: string;
  studentId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  courseCode: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
}

export interface WorkspaceSubmissionItem {
  id: string;
  questId: string;
  studentId: string;
  submissionUrl: string | null;
  studentNote: string | null;
  status: SubmissionStatusValue;
  teacherFeedback: string | null;
  firstSubmittedAt: string | null;
  submittedAt: string | null;
  stampedAt: string | null;
  stampedByName?: string | null;
  includedInDigest: boolean;
  quest: { id: string; taskNumber: number; title: string };
  student: {
    id: string;
    studentId: string | null;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    courseCode: string | null;
    email: string;
  };
}

export interface WorkspaceDigestLog {
  id: string;
  recipientEmail: string;
  subject: string;
  submissionCount: number;
  triggerType: string;
  deliveryStatus: string;
  htmlPreview: string;
  errorMessage: string | null;
  sentAt: string;
}

export interface WorkspacePayload {
  section: {
    id: string;
    code: string;
    name: string;
    term: string;
    teacherId: string | null;
    teacherName: string;
    teacherEmail: string;
    leaderboardVisible: boolean;
    digestThreshold: number;
    digestEnabled: boolean;
    lastDigestSentAt: string | null;
  };
  quests: WorkspaceQuestItem[];
  students: WorkspaceStudentItem[];
  submissions: WorkspaceSubmissionItem[];
  leaderboard: LeaderboardEntry[];
  digestQueue: DigestQueueSummary | null;
  digestLogs: WorkspaceDigestLog[];
}

export type WorkspaceTab =
  | "queue"
  | "stampcard"
  | "tracker"
  | "quests"
  | "leaderboard"
  | "digest"
  | "roster";

export interface WorkspaceSummaryStats {
  sectionCode: string;
  studentsCount: number;
  questsCount: number;
  pendingCount: number;
  digestPendingCount: number;
  digestThreshold: number;
}

interface TeacherWorkspaceProps {
  apiBase?: string;
  initialSections: WorkspaceSectionOption[];
  initialSectionId?: string | null;
  initialTab?: string | null;
  externalTab?: WorkspaceTab;
  onTabChange?: (tab: WorkspaceTab) => void;
  onSummaryChange?: (stats: WorkspaceSummaryStats) => void;
  isAdminOverride?: boolean;
  teachersForAssign?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }[];
  onSectionsChanged?: () => void;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDeliveryLabel(status: string): string {
  if (status === "SENT") return "Sent to Outlook";
  if (status === "PREVIEW_ONLY") return "Saved Email Preview";
  return "Delivery Failed";
}

function formatTriggerLabel(trigger: string): string {
  if (trigger === "THRESHOLD") return "Auto-sent at batch threshold";
  if (trigger === "SCHEDULED") return "Daily scheduled digest";
  return "Sent manually by teacher";
}

export function TeacherWorkspace({
  apiBase = "/api/workspace",
  initialSections,
  initialSectionId,
  initialTab,
  externalTab,
  onTabChange,
  onSummaryChange,
  isAdminOverride = false,
  teachersForAssign = [],
  onSectionsChanged,
}: TeacherWorkspaceProps) {
  const [sections, setSections] = useState<WorkspaceSectionOption[]>(initialSections);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    initialSectionId && initialSections.some((s) => s.id === initialSectionId)
      ? initialSectionId
      : initialSections[0]?.id || ""
  );
  const validTabs: WorkspaceTab[] = [
    "queue",
    "stampcard",
    "tracker",
    "quests",
    "leaderboard",
    "digest",
    "roster",
  ];
  const [internalTab, setInternalTab] = useState<WorkspaceTab>(
    validTabs.includes(initialTab as WorkspaceTab)
      ? (initialTab as WorkspaceTab)
      : "queue"
  );

  const activeTab = externalTab ?? internalTab;
  const setActiveTab = useCallback(
    (next: WorkspaceTab) => {
      if (onTabChange) onTabChange(next);
      setInternalTab(next);
    },
    [onTabChange]
  );

  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [showGuide, setShowGuide] = useState(true);

  const [stampOverlay, setStampOverlay] = useState<{
    visible: boolean;
    taskNumber?: number;
    studentName?: string;
  }>({ visible: false });
  const [recentlyStampedKey, setRecentlyStampedKey] = useState<string | null>(null);
  const [recentlyUnstampedKey, setRecentlyUnstampedKey] = useState<string | null>(
    null
  );

  const [queueFilter, setQueueFilter] = useState<
    "PENDING_REVIEW" | "STAMPED" | "NEEDS_REVISION"
  >("PENDING_REVIEW");
  const [queueSort, setQueueSort] = useState<
    "REQUESTED_ASC" | "REQUESTED_DESC" | "STAMPED_ASC" | "STAMPED_DESC" | "TASK_ASC"
  >("REQUESTED_ASC");
  const [queueFeedbacks, setQueueFeedbacks] = useState<Record<string, string>>({});
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);

  const [stampCardStudentId, setStampCardStudentId] = useState<string>("");
  const [stampCardSearch, setStampCardSearch] = useState("");
  const [stampCardQuest, setStampCardQuest] = useState<WorkspaceQuestItem | null>(
    null
  );
  const [stampCardFeedback, setStampCardFeedback] = useState("");
  const [stampCardUrl, setStampCardUrl] = useState("");
  const [stampCardBusy, setStampCardBusy] = useState(false);

  const [trackerSearch, setTrackerSearch] = useState("");
  const [trackerCourseFilter, setTrackerCourseFilter] = useState("ALL");
  const [cellDrawer, setCellDrawer] = useState<{
    student: WorkspaceStudentItem;
    quest: WorkspaceQuestItem;
    submission: WorkspaceSubmissionItem | null;
  } | null>(null);
  const [cellUrl, setCellUrl] = useState("");
  const [cellFeedback, setCellFeedback] = useState("");
  const [cellBusy, setCellBusy] = useState(false);

  const [showNewSection, setShowNewSection] = useState(false);
  const [newSecCode, setNewSecCode] = useState("");
  const [newSecName, setNewSecName] = useState("");
  const [newSecTerm, setNewSecTerm] = useState("Term 2 AY 2026-2027");
  const [newSecTeacherId, setNewSecTeacherId] = useState("");

  const [questDrawerOpen, setQuestDrawerOpen] = useState(false);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [qTitle, setQTitle] = useState("");
  const [qCategory, setQCategory] = useState<QuestCategoryValue>("SELF_PACED");
  const [qDesc, setQDesc] = useState("");
  const [qUrl, setQUrl] = useState("");
  const [qStart, setQStart] = useState("");
  const [qDeadline, setQDeadline] = useState("");
  const [qBusy, setQBusy] = useState(false);

  const [digestThresholdInput, setDigestThresholdInput] = useState(20);
  const [digestEnabledInput, setDigestEnabledInput] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<{
    subject: string;
    html: string;
  } | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);

  const [stuId, setStuId] = useState("");
  const [stuLast, setStuLast] = useState("");
  const [stuFirst, setStuFirst] = useState("");
  const [stuMiddle, setStuMiddle] = useState("");
  const [stuCourse, setStuCourse] = useState("BSIT");
  const [stuEmail, setStuEmail] = useState("");
  const [stuPass, setStuPass] = useState("Student@2026");
  const [stuBusy, setStuBusy] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showUploadStudentsModal, setShowUploadStudentsModal] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDefaultPass, setImportDefaultPass] = useState("Student@2026");
  const [importReport, setImportReport] = useState<{
    totalParsed: number;
    createdCount: number;
    enrolledExistingCount: number;
    skippedCount: number;
    errors: { rowNumber: number; message: string }[];
  } | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const [resetTarget, setResetTarget] = useState<WorkspaceStudentItem | null>(null);
  const [resetNewPass, setResetNewPass] = useState("Student@2026");

  const [showEditSection, setShowEditSection] = useState(false);
  const [editSecCode, setEditSecCode] = useState("");
  const [editSecName, setEditSecName] = useState("");
  const [editSecTerm, setEditSecTerm] = useState("");
  const [editSecTeacherId, setEditSecTeacherId] = useState("");

  const [editStudentTarget, setEditStudentTarget] =
    useState<WorkspaceStudentItem | null>(null);
  const [editStuId, setEditStuId] = useState("");
  const [editStuLast, setEditStuLast] = useState("");
  const [editStuFirst, setEditStuFirst] = useState("");
  const [editStuMiddle, setEditStuMiddle] = useState("");
  const [editStuCourse, setEditStuCourse] = useState("");
  const [editStuEmail, setEditStuEmail] = useState("");

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

  const triggerStampAnimation = useCallback(
    (studentId: string, questId: string, taskNumber: number, studentName: string) => {
      setRecentlyUnstampedKey(null);
      setRecentlyStampedKey(`${studentId}:${questId}`);
      setStampOverlay({ visible: true, taskNumber, studentName });
      setTimeout(() => {
        setStampOverlay({ visible: false });
      }, 1050);
      setTimeout(() => {
        setRecentlyStampedKey((prev) =>
          prev === `${studentId}:${questId}` ? null : prev
        );
      }, 2400);
    },
    []
  );

  const triggerUnstampAnimation = useCallback(
    (studentId: string, questId: string) => {
      setRecentlyStampedKey(null);
      setRecentlyUnstampedKey(`${studentId}:${questId}`);
      setTimeout(() => {
        setRecentlyUnstampedKey((prev) =>
          prev === `${studentId}:${questId}` ? null : prev
        );
      }, 1200);
    },
    []
  );

  const loadSectionsList = useCallback(async () => {
    const res = await fetch(`${apiBase}/sections`);
    if (res.ok) {
      const data = await res.json();
      setSections(data.sections || []);
      if (!selectedSectionId && data.sections?.[0]?.id) {
        setSelectedSectionId(data.sections[0].id);
      }
    }
  }, [apiBase, selectedSectionId]);

  const loadWorkspace = useCallback(
    async (secId: string) => {
      if (!secId) return;
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/sections/${secId}`);
        const data = (await res.json()) as WorkspacePayload & { error?: string };
        if (!res.ok) {
          showToast("err", data.error || "Failed to load section workspace.");
          return;
        }
        setWorkspace(data);
        setDigestThresholdInput(data.section.digestThreshold);
        setDigestEnabledInput(data.section.digestEnabled);
        setStampCardStudentId((prev) => {
          if (prev && data.students.some((s) => s.id === prev)) return prev;
          return data.students[0]?.id || "";
        });
        const pendingCount = data.submissions.filter(
          (s) => s.status === "PENDING_REVIEW"
        ).length;
        onSummaryChange?.({
          sectionCode: data.section.code,
          studentsCount: data.students.length,
          questsCount: data.quests.length,
          pendingCount,
          digestPendingCount: data.digestQueue?.pendingCount ?? 0,
          digestThreshold: data.section.digestThreshold,
        });
      } catch {
        showToast("err", "Network error loading section workspace.");
      } finally {
        setLoading(false);
      }
    },
    [apiBase, showToast, onSummaryChange]
  );

  useEffect(() => {
    setSections(initialSections);
    if (initialSectionId && initialSections.some((s) => s.id === initialSectionId)) {
      setSelectedSectionId(initialSectionId);
    } else if (!selectedSectionId && initialSections[0]?.id) {
      setSelectedSectionId(initialSections[0].id);
    }
  }, [initialSections, initialSectionId, selectedSectionId]);

  useEffect(() => {
    if (selectedSectionId) {
      void loadWorkspace(selectedSectionId);
    }
  }, [selectedSectionId, activeTab, loadWorkspace]);

  const submissionMap = useMemo(() => {
    const map = new Map<string, WorkspaceSubmissionItem>();
    if (!workspace) return map;
    for (const s of workspace.submissions) {
      map.set(`${s.studentId}:${s.questId}`, s);
    }
    return map;
  }, [workspace]);

  const pendingCountByStudent = useMemo(() => {
    const counts = new Map<string, number>();
    if (!workspace) return counts;
    for (const s of workspace.submissions) {
      if (s.status === "PENDING_REVIEW") {
        counts.set(s.studentId, (counts.get(s.studentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [workspace]);

  const statusCounts = useMemo(() => {
    const res = { PENDING_REVIEW: 0, STAMPED: 0, NEEDS_REVISION: 0 };
    if (!workspace) return res;
    for (const s of workspace.submissions) {
      if (s.status === "PENDING_REVIEW") res.PENDING_REVIEW += 1;
      else if (s.status === "STAMPED") res.STAMPED += 1;
      else if (s.status === "NEEDS_REVISION") res.NEEDS_REVISION += 1;
    }
    return res;
  }, [workspace]);

  const displayedQueueSubmissions = useMemo(() => {
    if (!workspace) return [];
    const list = workspace.submissions.filter((s) => s.status === queueFilter);
    const getMs = (iso: string | null) =>
      iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER;

    list.sort((a, b) => {
      if (queueSort === "REQUESTED_ASC") {
        return (
          getMs(a.firstSubmittedAt ?? a.submittedAt) -
          getMs(b.firstSubmittedAt ?? b.submittedAt)
        );
      }
      if (queueSort === "REQUESTED_DESC") {
        return (
          getMs(b.submittedAt ?? b.firstSubmittedAt) -
          getMs(a.submittedAt ?? a.firstSubmittedAt)
        );
      }
      if (queueSort === "STAMPED_ASC") {
        return getMs(a.stampedAt) - getMs(b.stampedAt);
      }
      if (queueSort === "STAMPED_DESC") {
        return getMs(b.stampedAt) - getMs(a.stampedAt);
      }
      return a.quest.taskNumber - b.quest.taskNumber;
    });
    return list;
  }, [workspace, queueFilter, queueSort]);

  const activeStampCardStudent = useMemo(() => {
    if (!workspace) return null;
    return workspace.students.find((s) => s.id === stampCardStudentId) ?? null;
  }, [workspace, stampCardStudentId]);

  const filteredStampCardStudents = useMemo(() => {
    if (!workspace) return [];
    const q = stampCardSearch.trim().toLowerCase();
    if (!q) return workspace.students;
    return workspace.students.filter((st) =>
      `${st.lastName} ${st.firstName} ${st.studentId ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [workspace, stampCardSearch]);

  const distinctCourses = useMemo(() => {
    if (!workspace) return [];
    const set = new Set<string>();
    for (const s of workspace.students) {
      if (s.courseCode) set.add(s.courseCode);
    }
    return Array.from(set).sort();
  }, [workspace]);

  const filteredStudents = useMemo(() => {
    if (!workspace) return [];
    const q = trackerSearch.trim().toLowerCase();
    return workspace.students.filter((st) => {
      if (trackerCourseFilter !== "ALL" && st.courseCode !== trackerCourseFilter) {
        return false;
      }
      if (!q) return true;
      const full = `${st.lastName} ${st.firstName} ${st.middleName ?? ""} ${
        st.studentId ?? ""
      } ${st.email}`.toLowerCase();
      return full.includes(q);
    });
  }, [workspace, trackerSearch, trackerCourseFilter]);

  const applyOptimisticStatus = useCallback(
    (
      questId: string,
      studentId: string,
      nextStatus: SubmissionStatusValue,
      feedback: string
    ) => {
      const nowIso = new Date().toISOString();
      setWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          submissions: prev.submissions.map((s) =>
            s.questId === questId && s.studentId === studentId
              ? {
                  ...s,
                  status: nextStatus,
                  teacherFeedback: feedback || s.teacherFeedback,
                  stampedAt: nextStatus === "STAMPED" ? nowIso : null,
                }
              : s
          ),
        };
      });
    },
    []
  );

  function requestQueueReview(
    sub: WorkspaceSubmissionItem,
    action: "STAMP" | "NEEDS_REVISION"
  ) {
    if (action === "STAMP") {
      if (sub.status === "STAMPED") return;
      askConfirm({
        title: `Approve & Stamp Task #${sub.quest.taskNumber}?`,
        description: `This stamps ${sub.student.lastName}, ${sub.student.firstName}'s Quest Card for this task.`,
        highlightText: `Task #${sub.quest.taskNumber}: ${sub.quest.title}`,
        confirmLabel: "Yes, Stamp Quest!",
        variant: "primary",
        onConfirm: async () => {
          await executeQueueReview(sub, "STAMP");
        },
      });
      return;
    }

    askConfirm({
      title: `Return Task #${sub.quest.taskNumber} for Revision?`,
      description: `This marks ${sub.student.lastName}, ${sub.student.firstName}'s submission as Needs Revision so they can update their link.`,
      highlightText: `Task #${sub.quest.taskNumber}: ${sub.quest.title}`,
      confirmLabel: "Yes, Return to Revise",
      variant: "danger",
      onConfirm: async () => {
        await executeQueueReview(sub, "NEEDS_REVISION");
      },
    });
  }

  async function executeQueueReview(
    sub: WorkspaceSubmissionItem,
    action: "STAMP" | "NEEDS_REVISION"
  ) {
    setQueueBusyId(sub.id);
    try {
      const feedbackText = queueFeedbacks[sub.id] ?? "";
      const res = await fetch(`${apiBase}/submissions/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId: sub.questId,
          studentId: sub.studentId,
          action,
          teacherFeedback: feedbackText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "Action failed.");
      } else {
        applyOptimisticStatus(
          sub.questId,
          sub.studentId,
          action === "STAMP" ? "STAMPED" : "NEEDS_REVISION",
          feedbackText
        );
        if (action === "STAMP") {
          triggerStampAnimation(
            sub.studentId,
            sub.questId,
            sub.quest.taskNumber,
            `${sub.student.lastName}, ${sub.student.firstName}`
          );
          showToast(
            "ok",
            `Stamped Task #${sub.quest.taskNumber} for ${sub.student.lastName}, ${sub.student.firstName}.`
          );
        } else {
          showToast("ok", `Returned Task #${sub.quest.taskNumber} for revision.`);
        }
        void loadWorkspace(selectedSectionId);
      }
    } finally {
      setQueueBusyId(null);
    }
  }

  function selectStampCardQuest(quest: WorkspaceQuestItem) {
    if (!activeStampCardStudent) return;
    const sub = submissionMap.get(`${activeStampCardStudent.id}:${quest.id}`);
    setStampCardQuest(quest);
    setStampCardUrl(sub?.submissionUrl || "");
    setStampCardFeedback(sub?.teacherFeedback || "");
  }

  function requestStampCardAction(action: "STAMP" | "NEEDS_REVISION" | "RESET") {
    if (!activeStampCardStudent || !stampCardQuest) return;
    if (action === "RESET") {
      askConfirm({
        title: `Clear Stamp on Task #${stampCardQuest.taskNumber}?`,
        description: `This removes the green stamp from ${activeStampCardStudent.lastName}, ${activeStampCardStudent.firstName}'s Quest Card and resets the task to Not Started.`,
        highlightText: `Task #${stampCardQuest.taskNumber}: ${stampCardQuest.title}`,
        confirmLabel: "Yes, Clear Stamp",
        variant: "danger",
        onConfirm: async () => {
          await executeStampCardAction("RESET");
        },
      });
      return;
    }
    void executeStampCardAction(action);
  }

  async function executeStampCardAction(
    action: "STAMP" | "NEEDS_REVISION" | "RESET"
  ) {
    if (!activeStampCardStudent || !stampCardQuest) return;
    setStampCardBusy(true);
    try {
      const res = await fetch(`${apiBase}/submissions/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId: stampCardQuest.id,
          studentId: activeStampCardStudent.id,
          action,
          teacherFeedback: stampCardFeedback,
          submissionUrl: stampCardUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "Could not update stamp.");
        return;
      }
      if (action === "STAMP") {
        triggerStampAnimation(
          activeStampCardStudent.id,
          stampCardQuest.id,
          stampCardQuest.taskNumber,
          `${activeStampCardStudent.lastName}, ${activeStampCardStudent.firstName}`
        );
        showToast(
          "ok",
          `Stamped Task #${stampCardQuest.taskNumber} on ${activeStampCardStudent.lastName}, ${activeStampCardStudent.firstName}'s Quest Card!`
        );
      } else if (action === "NEEDS_REVISION") {
        triggerUnstampAnimation(activeStampCardStudent.id, stampCardQuest.id);
        showToast("ok", "Sent back to student with revision note.");
      } else {
        triggerUnstampAnimation(activeStampCardStudent.id, stampCardQuest.id);
        showToast("ok", "Stamp cleared back to Not Started.");
      }
      await loadWorkspace(selectedSectionId);
    } finally {
      setStampCardBusy(false);
    }
  }

  function openCellModal(student: WorkspaceStudentItem, quest: WorkspaceQuestItem) {
    const sub = submissionMap.get(`${student.id}:${quest.id}`) || null;
    setCellDrawer({ student, quest, submission: sub });
    setCellUrl(sub?.submissionUrl || "");
    setCellFeedback(sub?.teacherFeedback || "");
  }

  function requestCellAction(action: "STAMP" | "NEEDS_REVISION" | "RESET") {
    if (!cellDrawer) return;
    if (action === "STAMP") {
      if (cellDrawer.submission?.status === "STAMPED") return;
      askConfirm({
        title: `Approve & Stamp Task #${cellDrawer.quest.taskNumber}?`,
        description: `This stamps ${cellDrawer.student.lastName}, ${cellDrawer.student.firstName}'s Quest Card for this task.`,
        highlightText: `Task #${cellDrawer.quest.taskNumber}: ${cellDrawer.quest.title}`,
        confirmLabel: "Yes, Stamp Quest!",
        variant: "primary",
        onConfirm: async () => {
          await executeCellAction("STAMP");
        },
      });
      return;
    }

    if (action === "NEEDS_REVISION") {
      askConfirm({
        title: `Return Task #${cellDrawer.quest.taskNumber} for Revision?`,
        description: `This marks the task as Needs Revision for ${cellDrawer.student.lastName}, ${cellDrawer.student.firstName} so they can update their submission.`,
        highlightText: `Task #${cellDrawer.quest.taskNumber}: ${cellDrawer.quest.title}`,
        confirmLabel: "Yes, Return to Revise",
        variant: "danger",
        onConfirm: async () => {
          await executeCellAction("NEEDS_REVISION");
        },
      });
      return;
    }

    askConfirm({
      title: `Clear Stamp on Task #${cellDrawer.quest.taskNumber}?`,
      description: `This removes the stamp and resets the task to Not Started for ${cellDrawer.student.lastName}, ${cellDrawer.student.firstName}.`,
      highlightText: `Task #${cellDrawer.quest.taskNumber}: ${cellDrawer.quest.title}`,
      confirmLabel: "Yes, Clear Stamp",
      variant: "danger",
      onConfirm: async () => {
        await executeCellAction("RESET");
      },
    });
  }

  async function executeCellAction(action: "STAMP" | "NEEDS_REVISION" | "RESET") {
    if (!cellDrawer) return;
    const targetStudent = cellDrawer.student;
    const targetQuest = cellDrawer.quest;
    const feedbackText = cellFeedback;
    setCellBusy(true);
    try {
      const res = await fetch(`${apiBase}/submissions/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId: targetQuest.id,
          studentId: targetStudent.id,
          action,
          teacherFeedback: feedbackText,
          submissionUrl: cellUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "Failed to update submission.");
        return;
      }
      setCellDrawer(null);
      applyOptimisticStatus(
        targetQuest.id,
        targetStudent.id,
        action === "STAMP"
          ? "STAMPED"
          : action === "NEEDS_REVISION"
          ? "NEEDS_REVISION"
          : "NOT_STARTED",
        feedbackText
      );
      if (action === "STAMP") {
        triggerStampAnimation(
          targetStudent.id,
          targetQuest.id,
          targetQuest.taskNumber,
          `${targetStudent.lastName}, ${targetStudent.firstName}`
        );
        showToast("ok", "Quest stamped! Student's QuestCard is now emerald green.");
      } else if (action === "NEEDS_REVISION") {
        if (cellDrawer.submission?.status === "STAMPED") {
          triggerUnstampAnimation(targetStudent.id, targetQuest.id);
        }
        showToast("ok", "Marked as Needs Revision with your note.");
      } else {
        triggerUnstampAnimation(targetStudent.id, targetQuest.id);
        showToast("ok", "Reset task back to Not Started.");
      }
      void loadWorkspace(selectedSectionId);
    } finally {
      setCellBusy(false);
    }
  }

  function openEditSectionModal() {
    if (!workspace) return;
    setEditSecCode(workspace.section.code);
    setEditSecName(workspace.section.name);
    setEditSecTerm(workspace.section.term);
    setEditSecTeacherId(workspace.section.teacherId ?? "");
    setShowEditSection(true);
  }

  function requestSaveSectionEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    askConfirm({
      title: "Save Section Changes?",
      description: `Confirm updating the details for section ${workspace.section.code}.`,
      highlightText: `${editSecCode.toUpperCase()} - ${editSecName} (${editSecTerm})`,
      confirmLabel: "Save Changes",
      variant: "primary",
      onConfirm: async () => {
        const res = await fetch(`${apiBase}/sections/${workspace.section.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: editSecCode,
            name: editSecName,
            term: editSecTerm,
            ...(isAdminOverride ? { teacherId: editSecTeacherId || null } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast("err", data.error || "Could not update section.");
          return;
        }
        setShowEditSection(false);
        await loadSectionsList();
        await loadWorkspace(workspace.section.id);
        onSectionsChanged?.();
        showToast("ok", `Updated section ${editSecCode.toUpperCase()}.`);
      },
    });
  }

  function requestDeleteActiveSection() {
    if (!workspace) return;
    askConfirm({
      title: `Delete Section ${workspace.section.code}?`,
      description: `This permanently deletes ${workspace.section.code} along with all ${workspace.quests.length} tasks, student enrollments, and submission records. This cannot be undone.`,
      highlightText: `${workspace.section.code} - ${workspace.section.name} (${workspace.section.term})`,
      confirmLabel: "Delete Section",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`${apiBase}/sections/${workspace.section.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          showToast("err", data.error || "Failed to delete section.");
          return;
        }
        setShowEditSection(false);
        setSelectedSectionId("");
        setWorkspace(null);
        await loadSectionsList();
        onSectionsChanged?.();
        showToast("ok", `Deleted section ${workspace.section.code}.`);
      },
    });
  }

  async function handleCreateSection(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${apiBase}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: newSecCode,
        name: newSecName,
        term: newSecTerm,
        ...(isAdminOverride ? { teacherId: newSecTeacherId || null } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast("err", data.error || "Could not create section.");
      return;
    }
    setShowNewSection(false);
    setNewSecCode("");
    setNewSecName("");
    await loadSectionsList();
    setSelectedSectionId(data.section.id);
    onSectionsChanged?.();
    showToast("ok", `Created section ${data.section.code}.`);
  }

  function openNewQuestDrawer() {
    setEditingQuestId(null);
    setQTitle("");
    setQCategory("SELF_PACED");
    setQDesc("");
    setQUrl("");
    setQStart("");
    setQDeadline("");
    setQuestDrawerOpen(true);
  }

  function openEditQuestDrawer(q: WorkspaceQuestItem) {
    setEditingQuestId(q.id);
    setQTitle(q.title);
    setQCategory(q.category);
    setQDesc(q.description);
    setQUrl(q.openlearningUrl || "");
    setQStart(toDatetimeLocal(q.startDate));
    setQDeadline(toDatetimeLocal(q.deadline));
    setQuestDrawerOpen(true);
  }

  function handleSaveQuest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSectionId) return;
    if (editingQuestId) {
      askConfirm({
        title: "Save Changes to Quest Task?",
        description:
          "Students in this section will immediately see the updated task title, instructions, and deadlines on their Quest Card.",
        highlightText: qTitle,
        confirmLabel: "Save Task Changes",
        variant: "primary",
        onConfirm: async () => {
          await executeSaveQuest();
        },
      });
      return;
    }
    void executeSaveQuest();
  }

  async function executeSaveQuest() {
    if (!selectedSectionId) return;
    setQBusy(true);
    try {
      const endpoint = editingQuestId
        ? `${apiBase}/quests/${editingQuestId}`
        : `${apiBase}/quests`;
      const method = editingQuestId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          title: qTitle,
          category: qCategory,
          description: qDesc,
          openlearningUrl: qUrl || null,
          startDate: qStart ? new Date(qStart).toISOString() : null,
          deadline: qDeadline ? new Date(qDeadline).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "Failed to save quest.");
        return;
      }
      setQuestDrawerOpen(false);
      await loadWorkspace(selectedSectionId);
      showToast("ok", editingQuestId ? "Task updated." : "New task added to QuestCard!");
    } finally {
      setQBusy(false);
    }
  }

  async function handleReorderQuest(questId: string, direction: "UP" | "DOWN") {
    const res = await fetch(`${apiBase}/quests/${questId}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (res.ok) {
      await loadWorkspace(selectedSectionId);
    }
  }

  function handleDeleteQuest(quest: WorkspaceQuestItem) {
    askConfirm({
      title: `Delete Task #${quest.taskNumber}?`,
      description:
        "Deleting this task will permanently remove it from the Quest Card along with all student submissions and stamps for this task.",
      highlightText: `Task #${quest.taskNumber}: ${quest.title}`,
      confirmLabel: "Yes, Delete Task",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`${apiBase}/quests/${quest.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          showToast("ok", `Deleted Task #${quest.taskNumber}.`);
          await loadWorkspace(selectedSectionId);
        } else {
          showToast("err", "Failed to delete quest task.");
        }
      },
    });
  }

  function handleToggleLeaderboard() {
    if (!workspace) return;
    const nextVal = !workspace.section.leaderboardVisible;
    askConfirm({
      title: nextVal
        ? "Reveal Class Rankings to Students?"
        : "Hide Class Rankings from Students?",
      description: nextVal
        ? `All students in ${workspace.section.code} will immediately be able to see the speed leaderboard on their Quest Card.`
        : `Students in ${workspace.section.code} will no longer see the class leaderboard until you turn it back on.`,
      confirmLabel: nextVal ? "Yes, Reveal Leaderboard" : "Yes, Hide Leaderboard",
      variant: "warning",
      onConfirm: async () => {
        const res = await fetch(`${apiBase}/sections/${workspace.section.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leaderboardVisible: nextVal }),
        });
        if (res.ok) {
          showToast(
            "ok",
            nextVal
              ? "Class Rankings are now VISIBLE to students."
              : "Class Rankings are now HIDDEN from students."
          );
          await loadWorkspace(workspace.section.id);
        }
      },
    });
  }

  async function handleSaveDigestSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    setDigestBusy(true);
    try {
      const res = await fetch(`${apiBase}/sections/${workspace.section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digestEnabled: digestEnabledInput,
          digestThreshold: Number(digestThresholdInput),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "Failed to update email settings.");
      } else {
        showToast("ok", "Email summary rules saved.");
        await loadWorkspace(workspace.section.id);
      }
    } finally {
      setDigestBusy(false);
    }
  }

  function handleSendDigestNow() {
    if (!workspace) return;
    askConfirm({
      title: "Send Combined Summary Email Now?",
      description: `This will bundle all ${
        workspace.digestQueue?.pendingCount ?? 0
      } waiting student submission request(s) into 1 summary email for ${
        workspace.section.teacherEmail || "the assigned teacher"
      }.`,
      highlightText: workspace.digestQueue?.subject || undefined,
      confirmLabel: "Send Summary Email",
      variant: "primary",
      onConfirm: async () => {
        setDigestBusy(true);
        try {
          const res = await fetch(
            `${apiBase}/sections/${workspace.section.id}/digest`,
            { method: "POST" }
          );
          const data = await res.json();
          if (!res.ok) {
            showToast("err", data.error || "Failed to send summary email.");
          } else if (!data.sent && data.submissionCount === 0) {
            showToast("err", "No new waiting student requests to summarize yet.");
          } else {
            showToast(
              "ok",
              `Combined ${data.submissionCount} requests into 1 summary (${formatDeliveryLabel(
                data.deliveryStatus
              )}).`
            );
            await loadWorkspace(workspace.section.id);
          }
        } finally {
          setDigestBusy(false);
        }
      },
    });
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSectionId) return;
    setStuBusy(true);
    try {
      const res = await fetch(`${apiBase}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          studentId: stuId,
          lastName: stuLast,
          firstName: stuFirst,
          middleName: stuMiddle || null,
          courseCode: stuCourse || null,
          email: stuEmail,
          defaultPassword: stuPass || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "Could not add student.");
        return;
      }
      showToast(
        "ok",
        data.created
          ? `Added & enrolled ${data.student.email} (temporary password: ${data.defaultPassword}).`
          : `Enrolled existing student ${data.student.email} into this section.`
      );
      setStuId("");
      setStuLast("");
      setStuFirst("");
      setStuMiddle("");
      setStuEmail("");
      setShowAddStudentModal(false);
      await loadWorkspace(selectedSectionId);
    } finally {
      setStuBusy(false);
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSectionId || !importFile) return;
    setImportBusy(true);
    try {
      const form = new FormData();
      form.append("sectionId", selectedSectionId);
      form.append("defaultPassword", importDefaultPass);
      form.append("file", importFile);

      const res = await fetch(`${apiBase}/students/import`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "Bulk upload failed.");
        return;
      }
      setImportReport(data);
      setImportFile(null);
      showToast(
        "ok",
        `Uploaded ${data.createdCount} new + ${data.enrolledExistingCount} existing students.`
      );
      await loadWorkspace(selectedSectionId);
    } finally {
      setImportBusy(false);
    }
  }

  function openEditStudentDrawer(st: WorkspaceStudentItem) {
    setEditStudentTarget(st);
    setEditStuId(st.studentId || "");
    setEditStuLast(st.lastName);
    setEditStuFirst(st.firstName);
    setEditStuMiddle(st.middleName || "");
    setEditStuCourse(st.courseCode || "");
    setEditStuEmail(st.email);
    setResetNewPass("Student@2026");
  }

  function requestSaveStudentEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editStudentTarget) return;
    askConfirm({
      title: "Save Student Profile Changes?",
      description: `Confirm updating the details for ${editStuLast}, ${editStuFirst}.`,
      highlightText: `${editStuId || "No ID"} • ${editStuEmail}`,
      confirmLabel: "Save Changes",
      variant: "primary",
      onConfirm: async () => {
        const res = await fetch(`${apiBase}/students/${editStudentTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: editStuId || null,
            lastName: editStuLast,
            firstName: editStuFirst,
            middleName: editStuMiddle || null,
            courseCode: editStuCourse || null,
            email: editStuEmail,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast("err", data.error || "Could not update student details.");
          return;
        }
        setEditStudentTarget(null);
        await loadWorkspace(selectedSectionId);
        showToast("ok", `Updated student profile for ${editStuEmail}.`);
      },
    });
  }

  function handleResetStudentPasswordFromEdit() {
    if (!editStudentTarget) return;
    const target = editStudentTarget;
    askConfirm({
      title: "Reset Student Password?",
      description: `Reset password for ${target.lastName}, ${target.firstName} to the starter password below. They will be asked to choose a personal password on next login.`,
      highlightText: `${target.email}  →  ${resetNewPass}`,
      confirmLabel: "Yes, Reset Password",
      variant: "warning",
      onConfirm: async () => {
        const res = await fetch(
          `${apiBase}/students/${target.id}/reset-password`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPassword: resetNewPass }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          showToast("err", data.error || "Password reset failed.");
          return;
        }
        showToast(
          "ok",
          `Temporary password reset for ${target.email}. They will change it on next login.`
        );
        setEditStudentTarget(null);
        await loadWorkspace(selectedSectionId);
      },
    });
  }

  function handleRemoveStudent(st: WorkspaceStudentItem) {
    askConfirm({
      title: `Remove Student from ${workspace?.section.code}?`,
      description: `This removes ${st.lastName}, ${st.firstName} from this section's roster and Quest Card tracker.`,
      highlightText: `${st.lastName}, ${st.firstName} (${st.studentId || st.email})`,
      confirmLabel: "Yes, Remove Student",
      variant: "danger",
      onConfirm: async () => {
        const res = await fetch(
          `${apiBase}/sections/${selectedSectionId}/enrollments/${st.id}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          setEditStudentTarget(null);
          showToast("ok", `Removed ${st.lastName}, ${st.firstName} from section.`);
          await loadWorkspace(selectedSectionId);
        } else {
          showToast("err", "Failed to remove student from section.");
        }
      },
    });
  }

  if (sections.length === 0) {
    return (
      <div className="folio-panel p-8 text-center">
        <Layers className="mx-auto h-10 w-10 text-[#8A6923]" />
        <h2 className="mt-3 font-display text-xl font-bold text-[#16192C]">
          No Class Sections Assigned Yet
        </h2>
        <p className="mt-1 text-sm text-[#5E5246]">
          {isAdminOverride
            ? "Create your first section in the Sections & Terms tab or click below."
            : "Your Admin will assign your RizLife class section here, or you can create one if needed."}
        </p>
        <button
          type="button"
          onClick={() => setShowNewSection(true)}
          className="btn-heritage-primary mt-4 px-4 py-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Create Section
        </button>

        {showNewSection && (
          <ModalDrawer
            open={showNewSection}
            onClose={() => setShowNewSection(false)}
            title="Create New RizLife Section"
          >
            <form onSubmit={handleCreateSection} className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Section Code (e.g. IT241)
                </label>
                <input
                  required
                  value={newSecCode}
                  onChange={(e) => setNewSecCode(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Course / Section Title
                </label>
                <input
                  required
                  value={newSecName}
                  onChange={(e) => setNewSecName(e.target.value)}
                  placeholder="Life and Works of Rizal (BSIT)"
                  className="folio-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Academic Term
                </label>
                <input
                  required
                  value={newSecTerm}
                  onChange={(e) => setNewSecTerm(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-sm"
                />
              </div>
              {isAdminOverride && (
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                    Assigned Instructor
                  </label>
                  <select
                    value={newSecTeacherId}
                    onChange={(e) => setNewSecTeacherId(e.target.value)}
                    className="folio-input w-full px-3 py-2 text-sm"
                  >
                    <option value="">- Unassigned (Assign Later) -</option>
                    {teachersForAssign.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.lastName}, {t.firstName} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button type="submit" className="btn-heritage-primary w-full py-2.5 text-sm">
                Create Section
              </button>
            </form>
          </ModalDrawer>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StampCelebrationOverlay
        visible={stampOverlay.visible}
        taskNumber={stampOverlay.taskNumber}
        studentName={stampOverlay.studentName}
      />

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

      {/* SECTION SELECTOR HEADER (only shown when switching between multiple sections or inside Admin Override) */}
      {(sections.length > 1 || !externalTab) && (
        <div className="folio-panel px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#5E5246]">
                Section:
              </span>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="folio-input px-3 py-1.5 text-xs font-bold"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.code} - {sec.name} ({sec.term})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Show horizontal bar ONLY when embedded inside Admin's Override tab */}
          {!externalTab && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#C6B393] pt-3">
              {[
                {
                  key: "queue" as const,
                  label: `Check Work (${statusCounts.PENDING_REVIEW})`,
                  icon: ClipboardCheck,
                },
                {
                  key: "stampcard" as const,
                  label: "Stamp Card",
                  icon: Stamp,
                },
                {
                  key: "quests" as const,
                  label: `Tasks (${workspace?.quests.length ?? 0})`,
                  icon: Layers,
                },
                {
                  key: "roster" as const,
                  label: `Students (${workspace?.students.length ?? 0})`,
                  icon: Users,
                },
                {
                  key: "tracker" as const,
                  label: "Excel Tracker",
                  icon: FileSpreadsheet,
                },
                {
                  key: "leaderboard" as const,
                  label: "Rankings",
                  icon: Trophy,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={
                      active
                        ? "btn-heritage-ink px-3 py-1.5 text-xs"
                        : "btn-heritage-paper px-3 py-1.5 text-xs"
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: CHECK STUDENT WORK */}
      {workspace && activeTab === "queue" && (
        <div className="folio-panel p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <QuillInkwellWatermark className="h-9 w-9" />
              <h2 className="font-display text-xl font-bold text-[#16192C]">
                Check Student Work
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex border border-[#16192C] bg-[#EFE6D2]">
                {(
                  [
                    [
                      "PENDING_REVIEW",
                      `Waiting (${statusCounts.PENDING_REVIEW})`,
                      "REQUESTED_ASC",
                    ],
                    [
                      "STAMPED",
                      `Stamped (${statusCounts.STAMPED})`,
                      "STAMPED_ASC",
                    ],
                    [
                      "NEEDS_REVISION",
                      `Revise (${statusCounts.NEEDS_REVISION})`,
                      "REQUESTED_DESC",
                    ],
                  ] as const
                ).map(([statusKey, label, defaultSort]) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => {
                      setQueueFilter(statusKey);
                      setQueueSort(defaultSort);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      queueFilter === statusKey
                        ? "bg-[#16192C] text-[#FAF6EC]"
                        : "text-[#4A4540] hover:bg-[#FAF6EC]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={queueSort}
                onChange={(e) => setQueueSort(e.target.value as typeof queueSort)}
                className="folio-input px-3 py-1.5 text-xs font-bold"
              >
                <option value="REQUESTED_ASC">
                  Sort: Who Requested First (Earliest)
                </option>
                <option value="REQUESTED_DESC">
                  Sort: Most Recently Requested
                </option>
                {queueFilter === "STAMPED" && (
                  <>
                    <option value="STAMPED_ASC">
                      Sort: Who Was Checked First (Earliest Stamp)
                    </option>
                    <option value="STAMPED_DESC">
                      Sort: Most Recently Checked
                    </option>
                  </>
                )}
                <option value="TASK_ASC">Sort: By Task Number</option>
              </select>

              <button
                type="button"
                onClick={() => void loadWorkspace(selectedSectionId)}
                className="btn-heritage-paper px-3 py-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {displayedQueueSubmissions.length === 0 ? (
            <div className="folio-tonal p-8 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-[#0E8F47]" />
              <p className="mt-2 font-bold text-[#16192C]">
                {queueFilter === "PENDING_REVIEW"
                  ? `All caught up! No waiting student requests in ${workspace.section.code}.`
                  : "No matching student records in this filter yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedQueueSubmissions.map((sub, idx) => (
                <div
                  key={sub.id}
                  className="border border-[#C6B393] bg-white p-4 shadow-[2px_2px_0_rgba(22,25,44,0.06)]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {(queueSort === "REQUESTED_ASC" ||
                          queueSort === "STAMPED_ASC") && (
                          <span className="border border-[#D4AB50] bg-[#FEF3C7] px-2 py-0.5 font-mono text-[10px] font-bold text-[#78350F]">
                            #{idx + 1}{" "}
                            {queueSort === "STAMPED_ASC" ? "CHECKED" : "REQUESTED"}
                          </span>
                        )}
                        <span className="border border-[#16192C] bg-[#16192C] px-2 py-0.5 font-mono text-xs font-bold text-[#FAF6EC]">
                          Task #{sub.quest.taskNumber}
                        </span>
                        <span className="font-bold text-[#16192C]">
                          {sub.quest.title}
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-[#16192C]">
                        {sub.student.lastName}, {sub.student.firstName}{" "}
                        <span className="font-mono text-xs font-normal text-[#5E5246]">
                          ({sub.student.studentId || sub.student.email} •{" "}
                          {sub.student.courseCode || "APC"})
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#5E5246]">
                        <span>
                          <strong>Requested First:</strong>{" "}
                          <span className="font-semibold text-[#16192C]">
                            {formatDateTime(sub.firstSubmittedAt ?? sub.submittedAt)}
                          </span>
                        </span>
                        {sub.submittedAt &&
                          sub.firstSubmittedAt &&
                          sub.submittedAt !== sub.firstSubmittedAt && (
                            <span>
                              <strong>Latest Update:</strong>{" "}
                              <span className="font-semibold text-[#16192C]">
                                {formatDateTime(sub.submittedAt)}
                              </span>
                            </span>
                          )}
                        {sub.stampedAt && (
                          <span>
                            <strong>Checked &amp; Stamped:</strong>{" "}
                            <span className="font-bold text-[#0E8F47]">
                              {formatDateTime(sub.stampedAt)}
                            </span>
                            {sub.stampedByName ? ` (by ${sub.stampedByName})` : ""}
                          </span>
                        )}
                      </div>

                      {sub.studentNote && (
                        <div className="text-xs italic text-[#594D42]">
                          Student note: &ldquo;{sub.studentNote}&rdquo;
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                      <StatusBadge status={sub.status} />
                      {sub.submissionUrl ? (
                        <a
                          href={sub.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-heritage-brass px-3 py-2 text-xs"
                        >
                          Open Student Output
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs italic text-[#5E5246]">
                          No URL attached
                        </span>
                      )}
                    </div>
                  </div>

                  {sub.status !== "STAMPED" && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-[#EFE6D2] pt-3 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        placeholder="Optional message to student (e.g. Great reflection! or Please fix link)..."
                        value={queueFeedbacks[sub.id] ?? ""}
                        onChange={(e) =>
                          setQueueFeedbacks((prev) => ({
                            ...prev,
                            [sub.id]: e.target.value,
                          }))
                        }
                        className="folio-input flex-1 px-3 py-1.5 text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={queueBusyId === sub.id}
                          onClick={() => requestQueueReview(sub, "NEEDS_REVISION")}
                          className="btn-heritage-danger px-3 py-1.5 text-xs"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Return with Note
                        </button>
                        <button
                          type="button"
                          disabled={queueBusyId === sub.id}
                          onClick={() => requestQueueReview(sub, "STAMP")}
                          className="btn-heritage-primary px-4 py-1.5 text-xs"
                        >
                          <Feather className="h-3.5 w-3.5" />
                          Approve &amp; Stamp!
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE STAMP A QUEST CARD */}
      {workspace && activeTab === "stampcard" && (
        <div className="space-y-4">
          <div className="folio-panel px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="font-display text-lg font-bold text-[#16192C]">
                Stamp a Quest Card
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#5E5246]" />
                  <input
                    type="text"
                    placeholder="Find student..."
                    value={stampCardSearch}
                    onChange={(e) => setStampCardSearch(e.target.value)}
                    className="folio-input py-1.5 pl-8 pr-3 text-xs"
                  />
                </div>
                <select
                  value={stampCardStudentId}
                  onChange={(e) => {
                    setStampCardStudentId(e.target.value);
                    setStampCardQuest(null);
                  }}
                  className="folio-input px-3 py-1.5 text-xs font-bold"
                >
                  {filteredStampCardStudents.map((st) => {
                    const pCount = pendingCountByStudent.get(st.id) ?? 0;
                    return (
                      <option key={st.id} value={st.id}>
                        {st.lastName}, {st.firstName}{" "}
                        {pCount > 0 ? `(${pCount} waiting)` : ""}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={() => void loadWorkspace(selectedSectionId)}
                  className="btn-heritage-paper px-3 py-1.5 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {activeStampCardStudent ? (
            <RizalQuestCardBoard
              studentName={`${activeStampCardStudent.lastName}, ${activeStampCardStudent.firstName}${
                activeStampCardStudent.middleName
                  ? ` ${activeStampCardStudent.middleName}`
                  : ""
              }`}
              studentNumber={activeStampCardStudent.studentId}
              courseCode={activeStampCardStudent.courseCode}
              sectionCode={workspace.section.code}
              term={workspace.section.term}
              quests={workspace.quests}
              statusByQuestId={
                new Map(
                  workspace.quests.map((q) => [
                    q.id,
                    submissionMap.get(`${activeStampCardStudent.id}:${q.id}`)
                      ?.status ?? "NOT_STARTED",
                  ])
                )
              }
              justStampedQuestId={
                recentlyStampedKey?.startsWith(`${activeStampCardStudent.id}:`)
                  ? recentlyStampedKey.split(":")[1]
                  : null
              }
              justUnstampedQuestId={
                recentlyUnstampedKey?.startsWith(`${activeStampCardStudent.id}:`)
                  ? recentlyUnstampedKey.split(":")[1]
                  : null
              }
              selectedQuestId={cellDrawer?.quest.id ?? null}
              onRefresh={() => void loadWorkspace(selectedSectionId)}
              refreshing={loading}
              onSelectQuest={(q) => {
                const full = workspace.quests.find((item) => item.id === q.id);
                if (full) openCellModal(activeStampCardStudent, full);
              }}
            />
          ) : (
            <div className="folio-panel p-8 text-center text-sm text-[#5E5246]">
              Add students in <strong>My Students</strong> first to view and stamp
              their Quest Cards.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CLASS EXCEL TRACKER */}
      {workspace && activeTab === "tracker" && (
        <div className="folio-panel p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="font-display text-xl font-bold text-[#16192C]">
              {workspace.section.code}_Task Tracker
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#5E5246]" />
                <input
                  type="text"
                  placeholder="Search student or ID..."
                  value={trackerSearch}
                  onChange={(e) => setTrackerSearch(e.target.value)}
                  className="folio-input py-1.5 pl-8 pr-3 text-xs"
                />
              </div>

              <select
                value={trackerCourseFilter}
                onChange={(e) => setTrackerCourseFilter(e.target.value)}
                className="folio-input px-2.5 py-1.5 text-xs"
              >
                <option value="ALL">All Courses</option>
                {distinctCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <a
                href={`${apiBase}/sections/${workspace.section.id}/export?format=xlsx`}
                className="btn-heritage-primary px-3 py-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel (.xlsx)
              </a>
              <a
                href={`${apiBase}/sections/${workspace.section.id}/export?format=csv`}
                className="btn-heritage-paper px-3 py-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </a>
              <button
                type="button"
                onClick={() => void loadWorkspace(selectedSectionId)}
                className="btn-heritage-paper px-3 py-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto touch-pan-x border border-[#C6B393] bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b-2 border-[#C6B393] bg-[#EFE6D2] text-[#16192C]">
                  <th className="md:sticky md:left-0 md:z-20 min-w-[115px] border-r border-[#C6B393] bg-[#EFE6D2] px-3 py-2.5 font-mono">
                    Student ID
                  </th>
                  <th className="md:sticky md:left-[115px] md:z-20 min-w-[125px] border-r border-[#C6B393] bg-[#EFE6D2] px-3 py-2.5">
                    Last Name
                  </th>
                  <th className="md:sticky md:left-[240px] md:z-20 min-w-[135px] border-r border-[#C6B393] bg-[#EFE6D2] px-3 py-2.5">
                    First Name
                  </th>
                  <th className="min-w-[115px] border-r border-[#C6B393] px-3 py-2.5">
                    Middle Name
                  </th>
                  <th className="px-3 py-2.5">Course</th>
                  <th className="px-3 py-2.5 text-center">Progress</th>
                  {workspace.quests.map((q) => (
                    <th
                      key={q.id}
                      title={`Task ${q.taskNumber}: ${q.title}`}
                      className="min-w-[88px] border-l border-[#C6B393] px-2 py-2.5 text-center"
                    >
                      <div className="font-mono font-bold">T{q.taskNumber}</div>
                      <div className="max-w-[82px] truncate text-[10px] font-normal text-[#5E5246]">
                        {q.title}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st) => {
                  let stampedCount = 0;
                  for (const q of workspace.quests) {
                    if (submissionMap.get(`${st.id}:${q.id}`)?.status === "STAMPED") {
                      stampedCount += 1;
                    }
                  }
                  return (
                    <tr
                      key={st.id}
                      className="border-b border-[#EFE6D2] hover:bg-[#FAF6EC]"
                    >
                      <td className="md:sticky md:left-0 md:z-10 border-r border-[#C6B393] bg-white px-3 py-2 font-mono text-[11px] font-semibold text-[#16192C]">
                        {st.studentId || "-"}
                      </td>
                      <td className="md:sticky md:left-[115px] md:z-10 border-r border-[#C6B393] bg-white px-3 py-2 font-bold text-[#16192C]">
                        {st.lastName}
                      </td>
                      <td className="md:sticky md:left-[240px] md:z-10 border-r border-[#C6B393] bg-white px-3 py-2 font-semibold text-[#16192C]">
                        {st.firstName}
                      </td>
                      <td className="border-r border-[#EFE6D2] px-3 py-2 text-[#5E5246]">
                        {st.middleName || "-"}
                      </td>
                      <td className="px-3 py-2 text-[#5E5246]">
                        {st.courseCode || "-"}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-[#0E8F47]">
                        {stampedCount}/{workspace.quests.length}
                      </td>
                      {workspace.quests.map((q) => {
                        const sub = submissionMap.get(`${st.id}:${q.id}`);
                        const status = sub?.status || "NOT_STARTED";
                        const cellClass =
                          status === "STAMPED"
                            ? "bg-[#DCFCE7] text-[#09592C] hover:bg-[#BBF7D0]"
                            : status === "PENDING_REVIEW"
                            ? "bg-[#FEF3C7] text-[#78350F] hover:bg-[#FDE68A]"
                            : status === "NEEDS_REVISION"
                            ? "bg-[#FEE2E2] text-[#7F1D1D] hover:bg-[#FECACA]"
                            : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFE6D2]";

                        return (
                          <td
                            key={q.id}
                            className="border-l border-[#EFE6D2] p-1 text-center"
                          >
                            <button
                              type="button"
                              onClick={() => openCellModal(st, q)}
                              className={`w-full px-1.5 py-1.5 text-[10px] font-bold transition cursor-pointer ${cellClass}`}
                            >
                              {status === "STAMPED" ? (
                                <span className="inline-flex items-center gap-1">
                                  <Feather className="h-3 w-3" />
                                  Stamped
                                </span>
                              ) : status === "PENDING_REVIEW" ? (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Check
                                </span>
                              ) : status === "NEEDS_REVISION" ? (
                                "Revise"
                              ) : (
                                "-"
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MANAGE TASKS */}
      {workspace && activeTab === "quests" && (
        <div className="folio-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <NoliFiliBooksWatermark className="h-9 w-11" />
              <h2 className="font-display text-xl font-bold text-[#16192C]">
                Manage Quest Card Tasks
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadWorkspace(selectedSectionId)}
                className="btn-heritage-paper px-3 py-2 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={openNewQuestDrawer}
                className="btn-heritage-primary px-3.5 py-2 text-xs"
              >
                <Plus className="h-4 w-4" />
                Add Quest Task
              </button>
            </div>
          </div>

          {workspace.quests.length === 0 ? (
            <div className="folio-tonal p-8 text-center text-xs text-[#5E5246]">
              No tasks added to <strong>{workspace.section.code}</strong> yet. Click{" "}
              <strong>Add Quest Task</strong> above to create your first Quest Card
              activity!
            </div>
          ) : (
            <div className="space-y-2.5">
              {workspace.quests.map((q, idx) => (
                <div
                  key={q.id}
                  className="flex flex-col gap-3 border border-[#C6B393] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center bg-[#16192C] font-mono text-xs font-bold text-[#D4AB50]">
                        {q.taskNumber}
                      </span>
                      <h3 className="font-bold text-[#16192C]">{q.title}</h3>
                    </div>
                    <p className="line-clamp-2 text-xs text-[#5E5246]">
                      {q.description}
                    </p>
                    <div className="flex flex-wrap gap-4 text-[11px] text-[#5E5246]">
                      <span>Start: {formatDateTime(q.startDate)}</span>
                      <span>Deadline: {formatDateTime(q.deadline)}</span>
                      {q.openlearningUrl && (
                        <a
                          href={q.openlearningUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#0E8F47] hover:underline"
                        >
                          OpenLearning Guide <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="border border-[#C6B393] bg-[#EFE6D2] px-2.5 py-1 text-[10px] font-bold text-[#5E5246]">
                      {QUEST_CATEGORY_LABELS[q.category]}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditQuestDrawer(q)}
                      className="btn-heritage-paper px-3 py-1.5 text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CLASS RANKINGS */}
      {workspace && activeTab === "leaderboard" && (
        <div className="folio-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <LamparillaWreathWatermark className="h-9 w-9" />
              <h2 className="font-display text-lg font-bold text-[#16192C]">
                Class Speed Rankings
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadWorkspace(selectedSectionId)}
                className="btn-heritage-paper px-3 py-2 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleToggleLeaderboard}
                className={
                  workspace.section.leaderboardVisible
                    ? "btn-heritage-primary shrink-0 px-4 py-2 text-xs"
                    : "btn-heritage-paper shrink-0 px-4 py-2 text-xs"
                }
              >
                <Eye className="h-4 w-4" />
                {workspace.section.leaderboardVisible
                  ? "Visible to Students (Hide)"
                  : "Hidden from Students (Reveal)"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#C6B393] bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-[#C6B393] bg-[#EFE6D2] text-[#16192C]">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Stamped Progress</th>
                  <th className="px-4 py-3">Waiting Check</th>
                  <th className="px-4 py-3">Earliest Completion Speed</th>
                </tr>
              </thead>
              <tbody>
                {workspace.leaderboard.map((row) => (
                  <tr
                    key={row.studentId}
                    className="border-b border-[#EFE6D2] hover:bg-[#FAF6EC]"
                  >
                    <td className="px-4 py-3 font-mono font-bold">
                      {row.rank <= 3 ? (
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center text-white ${
                            row.rank === 1
                              ? "bg-[#D4AB50] text-[#16192C]"
                              : row.rank === 2
                              ? "bg-[#6B7280]"
                              : "bg-[#8A6923]"
                          }`}
                        >
                          {row.rank}
                        </span>
                      ) : (
                        `#${row.rank}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#16192C]">{row.fullName}</div>
                      <div className="font-mono text-[11px] text-[#5E5246]">
                        {row.studentNumber || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#5E5246]">
                      {row.courseCode || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0E8F47]">
                          {row.stampedCount}/{row.totalQuests}
                        </span>
                        <div className="h-2 w-24 border border-[#C6B393] bg-[#EFE6D2]">
                          <div
                            className="h-full bg-[#0E8F47]"
                            style={{ width: `${row.completionPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#78350F]">
                      {row.pendingCount}
                    </td>
                    <td className="px-4 py-3 text-[#4A4540]">{row.speedLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: EMAIL SUMMARY */}
      {workspace && activeTab === "digest" && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="folio-panel p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-[#0E8F47]" />
                <h2 className="font-display text-lg font-bold text-[#16192C]">
                  Combined Outlook Email Batch
                </h2>
              </div>

              <div className="folio-tonal p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase text-[#5E5246]">
                    Students Waiting in Next Summary
                  </span>
                  <span className="font-mono text-2xl font-extrabold text-[#0E8F47]">
                    {workspace.digestQueue?.pendingCount ?? 0} /{" "}
                    {workspace.section.digestThreshold}
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full border border-[#B59A6C] bg-white">
                  <div
                    className="h-full bg-[#0E8F47] transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((workspace.digestQueue?.pendingCount ?? 0) /
                            Math.max(1, workspace.section.digestThreshold)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-[#5E5246]">
                  From {workspace.digestQueue?.uniqueStudentCount ?? 0} student(s). Last
                  summary sent: {formatDateTime(workspace.section.lastDigestSentAt)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!workspace.digestQueue}
                  onClick={() =>
                    workspace.digestQueue &&
                    setPreviewHtml({
                      subject: workspace.digestQueue.subject,
                      html: workspace.digestQueue.htmlPreview,
                    })
                  }
                  className="btn-heritage-paper px-3.5 py-2 text-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview Email
                </button>
                <button
                  type="button"
                  disabled={
                    digestBusy || (workspace.digestQueue?.pendingCount ?? 0) === 0
                  }
                  onClick={handleSendDigestNow}
                  className="btn-heritage-primary px-4 py-2 text-xs disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {digestBusy ? "Sending..." : "Send Combined Email Now"}
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSaveDigestSettings}
              className="folio-panel p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-[#8A6923]" />
                <h2 className="font-display text-lg font-bold text-[#16192C]">
                  When Should Summary Emails Send?
                </h2>
              </div>

              <label className="flex items-center gap-2.5 border border-[#C6B393] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#16192C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={digestEnabledInput}
                  onChange={(e) => setDigestEnabledInput(e.target.checked)}
                  className="h-4 w-4 accent-[#0E8F47]"
                />
                Automatically send 1 email once enough student requests accumulate
              </label>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Send Summary After This Many Submissions
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={digestThresholdInput}
                  onChange={(e) => setDigestThresholdInput(Number(e.target.value))}
                  className="folio-input w-full px-3 py-2 font-mono text-sm"
                />
                <p className="mt-1 text-[11px] text-[#5E5246]">
                  Recommended: <strong>20</strong> (sends 1 email when 20 tasks are
                  waiting, plus scheduled checks at 8 AM and 5 PM).
                </p>
              </div>

              <button
                type="submit"
                disabled={digestBusy}
                className="btn-heritage-ink px-4 py-2 text-xs"
              >
                Save Email Preferences
              </button>
            </form>
          </div>

          <div className="folio-panel p-5">
            <h3 className="mb-3 font-display text-lg font-bold text-[#16192C]">
              Sent Summary History
            </h3>
            {workspace.digestLogs.length === 0 ? (
              <p className="text-xs text-[#5E5246]">No summary emails sent yet.</p>
            ) : (
              <div className="overflow-x-auto border border-[#C6B393] bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#C6B393] bg-[#EFE6D2]">
                      <th className="px-3 py-2.5">Sent At</th>
                      <th className="px-3 py-2.5">How Sent</th>
                      <th className="px-3 py-2.5">Requests Combined</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Subject</th>
                      <th className="px-3 py-2.5 text-right">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.digestLogs.map((log) => (
                      <tr key={log.id} className="border-b border-[#EFE6D2]">
                        <td className="px-3 py-2">{formatDateTime(log.sentAt)}</td>
                        <td className="px-3 py-2 text-[#5E5246]">
                          {formatTriggerLabel(log.triggerType)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold">
                          {log.submissionCount}
                        </td>
                        <td className="px-3 py-2">
                          <span className="border border-[#C6B393] bg-[#EFE6D2] px-2 py-0.5 text-[10px] font-bold">
                            {formatDeliveryLabel(log.deliveryStatus)}
                          </span>
                        </td>
                        <td className="px-3 py-2">{log.subject}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewHtml({
                                subject: log.subject,
                                html: log.htmlPreview,
                              })
                            }
                            className="text-xs font-bold text-[#0E8F47] hover:underline cursor-pointer"
                          >
                            View Email
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: MY STUDENTS */}
      {workspace && activeTab === "roster" && (
        <div className="folio-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <QuillInkwellWatermark className="h-9 w-9" />
              <h3 className="font-display text-lg font-bold text-[#16192C]">
                Enrolled Students in {workspace.section.code}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadWorkspace(selectedSectionId)}
                className="btn-heritage-paper px-3 py-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportReport(null);
                  setShowUploadStudentsModal(true);
                }}
                className="btn-heritage-paper px-3 py-1.5 text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload CSV / Excel
              </button>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(true)}
                className="btn-heritage-primary px-3.5 py-1.5 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Student
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#C6B393] bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-[#C6B393] bg-[#EFE6D2]">
                  <th className="px-3 py-2.5">Student ID</th>
                  <th className="px-3 py-2.5">Last Name</th>
                  <th className="px-3 py-2.5">First Name</th>
                  <th className="px-3 py-2.5">Middle Name</th>
                  <th className="px-3 py-2.5">Course</th>
                  <th className="px-3 py-2.5">APC Email</th>
                  <th className="px-3 py-2.5">Password State</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workspace.students.map((st) => (
                  <tr key={st.id} className="border-b border-[#EFE6D2]">
                    <td className="px-3 py-2 font-mono">{st.studentId || "-"}</td>
                    <td className="px-3 py-2 font-bold text-[#16192C]">
                      {st.lastName}
                    </td>
                    <td className="px-3 py-2 font-semibold text-[#16192C]">
                      {st.firstName}
                    </td>
                    <td className="px-3 py-2 text-[#5E5246]">
                      {st.middleName || "-"}
                    </td>
                    <td className="px-3 py-2">{st.courseCode || "-"}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{st.email}</td>
                    <td className="px-3 py-2">
                      {st.mustChangePassword ? (
                        <span className="border border-[#D4AB50] bg-[#FEF3C7] px-2 py-0.5 font-mono text-[10px] font-bold text-[#78350F]">
                          Starter PW
                        </span>
                      ) : (
                        <span className="border border-[#0E8F47] bg-[#DCFCE7] px-2 py-0.5 font-mono text-[10px] font-bold text-[#09592C]">
                          Personalized
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openEditStudentDrawer(st)}
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

      {/* ADD STUDENT MODAL */}
      <ModalDrawer
        open={showAddStudentModal}
        onClose={() => setShowAddStudentModal(false)}
        subtitle={workspace?.section.code}
        title="Add Student to Section"
      >
        <form onSubmit={handleCreateStudent} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Student ID
              </label>
              <input
                required
                placeholder="e.g. 2024-140101"
                value={stuId}
                onChange={(e) => setStuId(e.target.value)}
                className="folio-input w-full px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Course Code
              </label>
              <input
                placeholder="e.g. BSIT / BSIT-MI"
                value={stuCourse}
                onChange={(e) => setStuCourse(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Last Name
              </label>
              <input
                required
                placeholder="e.g. Alobin"
                value={stuLast}
                onChange={(e) => setStuLast(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                First Name
              </label>
              <input
                required
                placeholder="e.g. Vince Nelmar"
                value={stuFirst}
                onChange={(e) => setStuFirst(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Middle Name
              </label>
              <input
                placeholder="e.g. Pega"
                value={stuMiddle}
                onChange={(e) => setStuMiddle(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              APC Email (@student.apc.edu.ph)
            </label>
            <input
              required
              type="email"
              placeholder="vpalobin@student.apc.edu.ph"
              value={stuEmail}
              onChange={(e) => setStuEmail(e.target.value)}
              className="folio-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Starter Default Password
            </label>
            <input
              required
              minLength={6}
              value={stuPass}
              onChange={(e) => setStuPass(e.target.value)}
              className="folio-input w-full px-3 py-2 font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={stuBusy}
            className="btn-heritage-primary w-full py-2.5 text-xs"
          >
            {stuBusy ? "Adding Student..." : "Create & Enroll Student"}
          </button>
        </form>
      </ModalDrawer>

      {/* UPLOAD CLASS LIST MODAL */}
      <ModalDrawer
        open={showUploadStudentsModal}
        onClose={() => setShowUploadStudentsModal(false)}
        subtitle={workspace?.section.code}
        title="Upload Class List (CSV / Excel)"
      >
        <form onSubmit={handleBulkImport} className="space-y-3.5">
          <div className="flex justify-end">
            <a
              href={`${apiBase}/students/template`}
              className="text-xs font-bold text-[#0E8F47] hover:underline"
            >
              Download Template CSV
            </a>
          </div>

          <input
            type="file"
            accept=".csv,.xlsx"
            required
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="block w-full border border-dashed border-[#B59A6C] bg-[#EFE6D2] p-2.5 text-xs"
          />

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Starter Password for Uploaded Students
            </label>
            <input
              required
              minLength={6}
              value={importDefaultPass}
              onChange={(e) => setImportDefaultPass(e.target.value)}
              className="folio-input w-full px-3 py-2 font-mono text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={importBusy || !importFile}
            className="btn-heritage-ink w-full py-2.5 text-xs disabled:opacity-50"
          >
            {importBusy ? "Uploading Class List..." : "Upload Students to Section"}
          </button>

          {importReport && (
            <div className="border border-[#C6B393] bg-white p-3 text-xs">
              <div className="font-bold text-[#16192C]">
                Upload Summary: {importReport.createdCount} created,{" "}
                {importReport.enrolledExistingCount} existing enrolled,{" "}
                {importReport.skippedCount} skipped.
              </div>
              {importReport.errors.length > 0 && (
                <ul className="mt-1.5 max-h-24 list-disc overflow-y-auto pl-4 text-[#A92B2C]">
                  {importReport.errors.map((er, i) => (
                    <li key={i}>
                      Row {er.rowNumber}: {er.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      </ModalDrawer>

      {/* CELL QUICK STAMP / REVIEW DRAWER */}
      <ModalDrawer
        open={Boolean(cellDrawer)}
        onClose={() => setCellDrawer(null)}
        subtitle={
          cellDrawer
            ? `${cellDrawer.student.lastName}, ${cellDrawer.student.firstName} (${
                cellDrawer.student.studentId || cellDrawer.student.email
              })`
            : ""
        }
        title={
          cellDrawer
            ? `Task #${cellDrawer.quest.taskNumber}: ${cellDrawer.quest.title}`
            : ""
        }
      >
        {cellDrawer && (
          <div className="space-y-4">
            {(() => {
              const hasStudentSubmission = Boolean(
                cellDrawer.submission &&
                  cellDrawer.submission.status !== "NOT_STARTED" &&
                  cellDrawer.submission.submissionUrl?.trim()
              );
              const submittedLink = cellDrawer.submission?.submissionUrl?.trim() || "";

              return (
                <>
                  <div className="folio-tonal flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-bold text-[#5E5246]">
                      Current Status
                    </span>
                    <StatusBadge
                      status={cellDrawer.submission?.status || "NOT_STARTED"}
                    />
                  </div>

                  <div className="relative overflow-hidden border border-[#C6B393] bg-white p-3 text-xs leading-relaxed text-[#4A4540]">
                    <NoliFiliBooksWatermark className="absolute right-2 top-2 h-10 w-12 opacity-30" />
                    <div className="mb-1 font-bold text-[#16192C]">Quest Prompt</div>
                    <div className="relative z-10">{cellDrawer.quest.description}</div>
                  </div>

                  {!hasStudentSubmission ? (
                    <div className="border-l-4 border-[#D4AB50] bg-[#FEF3C7] p-3.5 text-xs text-[#78350F]">
                      <div className="font-bold">Not Submitted Yet</div>
                      <p className="mt-1">
                        {cellDrawer.student.lastName}, {cellDrawer.student.firstName} has
                        not submitted an OpenLearning link for this task yet. You can
                        stamp this task once the student submits their link.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2 border border-[#C6B393] bg-white px-3 py-2 text-[11px] sm:grid-cols-2">
                        <div>
                          <span className="text-[#5E5246]">Requested First:</span>{" "}
                          <strong className="text-[#16192C]">
                            {formatDateTime(
                              cellDrawer.submission?.firstSubmittedAt ??
                                cellDrawer.submission?.submittedAt ??
                                null
                            )}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#5E5246]">Checked &amp; Stamped:</span>{" "}
                          <strong className="text-[#0E8F47]">
                            {formatDateTime(cellDrawer.submission?.stampedAt ?? null)}
                          </strong>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                          Student OpenLearning Link
                        </label>
                        <div className="space-y-2">
                          <div className="truncate border border-[#C6B393] bg-[#EFE6D2] px-3 py-2 font-mono text-xs text-[#16192C]">
                            {submittedLink}
                          </div>
                          <a
                            href={submittedLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-heritage-brass w-full py-2 text-xs"
                          >
                            Open Student Output on OpenLearning
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                          Note to Student (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={cellFeedback}
                          onChange={(e) => setCellFeedback(e.target.value)}
                          placeholder="Optional note or revision instructions..."
                          className="folio-input w-full px-3 py-2 text-xs"
                        />
                      </div>

                      {cellDrawer.submission?.status === "STAMPED" ? (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-center gap-2 border-2 border-[#0E8F47] bg-[#DCFCE7] px-3 py-2.5 text-xs font-bold text-[#09592C]">
                            <CheckCircle2 className="h-4 w-4 text-[#0E8F47]" />
                            Already Verified &amp; Stamped
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={cellBusy}
                              onClick={() => requestCellAction("NEEDS_REVISION")}
                              className="btn-heritage-danger py-2 text-xs"
                            >
                              Return to Revise
                            </button>
                            <button
                              type="button"
                              disabled={cellBusy}
                              onClick={() => requestCellAction("RESET")}
                              className="btn-heritage-paper py-2 text-xs"
                            >
                              Clear Stamp
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pt-1">
                          <button
                            type="button"
                            disabled={cellBusy}
                            onClick={() => requestCellAction("STAMP")}
                            className="btn-heritage-primary w-full py-3 text-sm"
                          >
                            <Feather className="h-4 w-4" />
                            Approve &amp; Stamp Quest!
                          </button>
                          <button
                            type="button"
                            disabled={cellBusy}
                            onClick={() => requestCellAction("NEEDS_REVISION")}
                            className="btn-heritage-danger w-full py-2 text-xs"
                          >
                            Return to Revise
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </ModalDrawer>

      {/* QUEST BUILDER DRAWER */}
      <ModalDrawer
        open={questDrawerOpen}
        onClose={() => setQuestDrawerOpen(false)}
        subtitle={workspace?.section.code}
        title={editingQuestId ? "Edit Quest Task" : "Add New Quest Task"}
      >
        <form onSubmit={handleSaveQuest} className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Quest Title
            </label>
            <input
              required
              value={qTitle}
              onChange={(e) => setQTitle(e.target.value)}
              placeholder="e.g. Revisiting the Law (R.A. 1425)"
              className="folio-input w-full px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Category
            </label>
            <select
              value={qCategory}
              onChange={(e) => setQCategory(e.target.value as QuestCategoryValue)}
              className="folio-input w-full px-3 py-2 text-sm"
            >
              {Object.entries(QUEST_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Instructions / Prompt
            </label>
            <textarea
              required
              rows={4}
              value={qDesc}
              onChange={(e) => setQDesc(e.target.value)}
              className="folio-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              OpenLearning Reference URL (Optional)
            </label>
            <input
              type="url"
              value={qUrl}
              onChange={(e) => setQUrl(e.target.value)}
              placeholder="https://www.openlearning.com/apc/courses/rizlife/..."
              className="folio-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Start Date/Time
              </label>
              <input
                type="datetime-local"
                value={qStart}
                onChange={(e) => setQStart(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Deadline Date/Time
              </label>
              <input
                type="datetime-local"
                value={qDeadline}
                onChange={(e) => setQDeadline(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={qBusy}
            className="btn-heritage-primary w-full py-2.5 text-sm"
          >
            {qBusy ? "Saving..." : editingQuestId ? "Save Changes" : "Create Quest"}
          </button>

          {editingQuestId && workspace && (
            <div className="space-y-2.5 border-t border-[#C6B393] pt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleReorderQuest(editingQuestId, "UP")}
                  className="btn-heritage-paper py-2 text-xs"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Move Up
                </button>
                <button
                  type="button"
                  onClick={() => void handleReorderQuest(editingQuestId, "DOWN")}
                  className="btn-heritage-paper py-2 text-xs"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Move Down
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = workspace.quests.find((q) => q.id === editingQuestId);
                  if (target) {
                    setQuestDrawerOpen(false);
                    handleDeleteQuest(target);
                  }
                }}
                className="btn-heritage-danger w-full py-2 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Task
              </button>
            </div>
          )}
        </form>
      </ModalDrawer>

      {/* NEW SECTION DRAWER */}
      <ModalDrawer
        open={showNewSection}
        onClose={() => setShowNewSection(false)}
        title="Create New Section"
      >
        <form onSubmit={handleCreateSection} className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Section Code (e.g. IT243)
            </label>
            <input
              required
              value={newSecCode}
              onChange={(e) => setNewSecCode(e.target.value)}
              className="folio-input w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Section Name
            </label>
            <input
              required
              value={newSecName}
              onChange={(e) => setNewSecName(e.target.value)}
              placeholder="Life and Works of Rizal (BSCS)"
              className="folio-input w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Term
            </label>
            <input
              required
              value={newSecTerm}
              onChange={(e) => setNewSecTerm(e.target.value)}
              className="folio-input w-full px-3 py-2 text-sm"
            />
          </div>
          {isAdminOverride && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Assign Teacher (Optional)
              </label>
              <select
                value={newSecTeacherId}
                onChange={(e) => setNewSecTeacherId(e.target.value)}
                className="folio-input w-full px-3 py-2 text-sm"
              >
                <option value="">- Unassigned (Assign Later) -</option>
                {teachersForAssign.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.lastName}, {t.firstName} ({t.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="btn-heritage-primary w-full py-2.5 text-sm">
            Create Section
          </button>
        </form>
      </ModalDrawer>

      {/* HTML DIGEST PREVIEW DRAWER */}
      <ModalDrawer
        open={Boolean(previewHtml)}
        onClose={() => setPreviewHtml(null)}
        subtitle="Outlook Email Digest Preview"
        title={previewHtml?.subject || "Email Digest"}
      >
        {previewHtml && (
          <div className="space-y-3">
            <iframe
              title="Digest Email Preview"
              sandbox=""
              srcDoc={previewHtml.html}
              className="h-[520px] w-full border border-[#C6B393] bg-white"
            />
          </div>
        )}
      </ModalDrawer>

      {/* EDIT OR DELETE SECTION MODAL */}
      <ModalDrawer
        open={showEditSection}
        onClose={() => setShowEditSection(false)}
        subtitle={workspace?.section.code}
        title="Edit or Delete Section"
      >
        <form onSubmit={requestSaveSectionEdit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Section Code
            </label>
            <input
              required
              value={editSecCode}
              onChange={(e) => setEditSecCode(e.target.value)}
              className="folio-input w-full px-3 py-2 text-sm"
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
              className="folio-input w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
              Term
            </label>
            <input
              required
              value={editSecTerm}
              onChange={(e) => setEditSecTerm(e.target.value)}
              className="folio-input w-full px-3 py-2 text-sm"
            />
          </div>
          {isAdminOverride && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Assigned Teacher
              </label>
              <select
                value={editSecTeacherId}
                onChange={(e) => setEditSecTeacherId(e.target.value)}
                className="folio-input w-full px-3 py-2 text-sm"
              >
                <option value="">- Unassigned -</option>
                {teachersForAssign.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.lastName}, {t.firstName} ({t.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="btn-heritage-primary w-full py-2.5 text-sm">
            Save Section Changes
          </button>

          <div className="border-t border-[#C6B393] pt-4">
            <button
              type="button"
              onClick={requestDeleteActiveSection}
              className="btn-heritage-danger w-full py-2.5 text-xs"
            >
              <Trash2 className="h-4 w-4" />
              Delete This Section Permanently
            </button>
          </div>
        </form>
      </ModalDrawer>

      {/* EDIT STUDENT DETAILS MODAL */}
      <ModalDrawer
        open={Boolean(editStudentTarget)}
        onClose={() => setEditStudentTarget(null)}
        subtitle={editStudentTarget?.email}
        title="Edit Student Details"
      >
        {editStudentTarget && (
          <form onSubmit={requestSaveStudentEdit} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Student ID
                </label>
                <input
                  required
                  value={editStuId}
                  onChange={(e) => setEditStuId(e.target.value)}
                  className="folio-input w-full px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Course Code
                </label>
                <input
                  value={editStuCourse}
                  onChange={(e) => setEditStuCourse(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Last Name
                </label>
                <input
                  required
                  value={editStuLast}
                  onChange={(e) => setEditStuLast(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  First Name
                </label>
                <input
                  required
                  value={editStuFirst}
                  onChange={(e) => setEditStuFirst(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                  Middle Name
                </label>
                <input
                  value={editStuMiddle}
                  onChange={(e) => setEditStuMiddle(e.target.value)}
                  className="folio-input w-full px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                APC Email Address
              </label>
              <input
                required
                type="email"
                value={editStuEmail}
                onChange={(e) => setEditStuEmail(e.target.value)}
                className="folio-input w-full px-3 py-2 text-xs"
              />
            </div>
            <button type="submit" className="btn-heritage-primary w-full py-2.5 text-sm">
              Save Student Changes
            </button>

            <div className="space-y-2.5 border-t border-[#C6B393] pt-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5246]">
                Reset Starter Password
              </label>
              <div className="flex gap-2">
                <input
                  minLength={6}
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  className="folio-input flex-1 px-3 py-2 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleResetStudentPasswordFromEdit}
                  className="btn-heritage-ink px-3 py-2 text-xs"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset PW
                </button>
              </div>
            </div>

            <div className="border-t border-[#C6B393] pt-4">
              <button
                type="button"
                onClick={() => handleRemoveStudent(editStudentTarget)}
                className="btn-heritage-danger w-full py-2.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove Student from Section
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
    </div>
  );
}
