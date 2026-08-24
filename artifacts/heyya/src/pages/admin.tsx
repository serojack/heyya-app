import { useState, useMemo, Fragment, useEffect } from "react";
import {
  useGetMe,
  useGetRoomMembers,
  useGetRoomStats,
  useListLeaveRequests,
  useListUsers,
  useUpdateLeaveRequest,
  useDemoLogin,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/shared/avatars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  ClipboardList,
  Mail,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  LogOut,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Folder,
  FolderOpen,
  Users,
  Search,
  GraduationCap,
  Briefcase,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";

type AdminSection = "attendance" | "staff" | "leave" | "rooms";

const GRADE_10_ROOM_ID = 1;

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isDateActive(startDate: string, endDate: string) {
  const today = todayStr();
  return startDate <= today && today <= endDate;
}

function StatusDot({ color }: { color: "green" | "red" | "yellow" | "blue" | "gray" }) {
  const cls = {
    green: "bg-green-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    blue: "bg-blue-500",
    gray: "bg-gray-400",
  }[color];
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />;
}

// ── Top Bar ──────────────────────────────────────────────────────────────────

function AdminTopBar({ section, setSection }: { section: AdminSection; setSection: (s: AdminSection) => void }) {
  const { data: user } = useGetMe();
  const { data: allUsers } = useListUsers();
  const loginMutation = useDemoLogin();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const teachers = allUsers?.filter((u) => u.role === "teacher") ?? [];
  const students = allUsers?.filter((u) => u.role === "student" && u.status !== "withdrawn") ?? [];
  const parents = allUsers?.filter((u) => u.role === "parent") ?? [];

  const switchUser = (userId: number) => {
    loginMutation.mutate(
      { data: { role: "teacher", userId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setLocation("/rooms");
        },
      }
    );
  };

  const handleLogout = async () => {
    await fetch("/api/users/logout", { method: "POST", credentials: "include" });
    queryClient.clear();
    setLocation("/login");
  };

  return (
    <div className="h-16 flex items-center px-6 border-b bg-card shadow-sm flex-shrink-0 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-4">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-sm font-bold">H</span>
        </div>
        <div className="hidden sm:block">
          <p className="text-sm leading-none tracking-wide" style={{ fontFamily: "10Pixel, sans-serif" }}>Heyya</p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Admin Dashboard</p>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex-1 flex items-center gap-1">
        {(
          [
            { id: "attendance", label: "Attendance", icon: BarChart3 },
            { id: "staff", label: "Staff", icon: ClipboardList },
            { id: "leave", label: "Leave Requests", icon: Mail },
            { id: "rooms", label: "Rooms", icon: FolderOpen },
          ] as { id: AdminSection; label: string; icon: React.ElementType }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              section === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Role switcher + logout */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent text-sm font-medium transition-colors"
              disabled={loginMutation.isPending}
            >
              <ShieldCheck className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline">Admin</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wider">
              Switch perspective
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 text-rose-600 font-medium" disabled>
              <ShieldCheck className="w-4 h-4" />
              Admin (current)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground px-2 py-1">Teachers</DropdownMenuLabel>
            {teachers.map((u) => (
              <DropdownMenuItem key={u.id} className="gap-2.5 cursor-pointer" onClick={() => switchUser(u.id)}>
                <UserAvatar user={u} className="w-7 h-7" />
                <span className="truncate font-medium">{u.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground px-2 py-1">Parents</DropdownMenuLabel>
            {parents.map((u) => (
              <DropdownMenuItem key={u.id} className="gap-2.5 cursor-pointer" onClick={() => switchUser(u.id)}>
                <UserAvatar user={u} className="w-7 h-7" />
                <span className="truncate font-medium">{u.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground px-2 py-1">Students</DropdownMenuLabel>
            {students.slice(0, 5).map((u) => (
              <DropdownMenuItem key={u.id} className="gap-2.5 cursor-pointer" onClick={() => switchUser(u.id)}>
                <UserAvatar user={u} className="w-7 h-7" />
                <span className="truncate font-medium">{u.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </div>
  );
}

// ── Grade / Class Tree Data ──────────────────────────────────────────────────

interface ClassEntry {
  gradeLabel: string;
  classLabel: string;
  key: string;          // e.g. "g10-c03"
  roomId: number | null; // null = no live data
}

interface GradeGroup {
  grade: string;       // "Grade 9"
  classes: ClassEntry[];
}

function buildGradeTree(): GradeGroup[] {
  const makeClasses = (gradeNum: number, count: number): ClassEntry[] =>
    Array.from({ length: count }, (_, i) => {
      const classNum = String(i + 1).padStart(2, "0");
      const isLive = gradeNum === 10 && classNum === "03";
      return {
        gradeLabel: `Grade ${gradeNum}`,
        classLabel: `Class ${classNum}`,
        key: `g${gradeNum}-c${classNum}`,
        roomId: isLive ? GRADE_10_ROOM_ID : null,
      };
    });

  return [
    { grade: "Grade 9", classes: makeClasses(9, 3) },
    { grade: "Grade 10", classes: makeClasses(10, 4) },
    { grade: "Grade 11", classes: makeClasses(11, 6) },
    { grade: "Grade 12", classes: makeClasses(12, 4) },
  ];
}

const GRADE_TREE = buildGradeTree();
const DEFAULT_CLASS_KEY = "g10-c03";

// ── Class Detail Panel ───────────────────────────────────────────────────────

function ClassDetailPanel({ entry }: { entry: ClassEntry }) {
  const { data: members, isLoading: membersLoading } = useGetRoomMembers(
    entry.roomId ?? 0,
    { query: { enabled: entry.roomId !== null, refetchInterval: 5000 } }
  );
  const { data: leaveRequests } = useListLeaveRequests(undefined, {
    query: { enabled: entry.roomId !== null, refetchInterval: 5000 },
  });

  type StudentStatus = "present" | "absent" | "excused" | "late";
  const statusConfig: Record<StudentStatus, { label: string; color: "green" | "red" | "yellow" | "blue" }> = {
    present: { label: "Present", color: "green" },
    absent: { label: "Absent", color: "red" },
    late: { label: "Late", color: "yellow" },
    excused: { label: "Excused", color: "blue" },
  };

  // No live data for this class
  if (entry.roomId === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
        <Users className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">{entry.gradeLabel} {entry.classLabel}</p>
        <p className="text-xs">No attendance data available for this class.</p>
      </div>
    );
  }

  if (membersLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    );
  }

  const students = members?.filter((m) => m.user.role === "student").map((m) => m.user) ?? [];

  const approvedLeaveStudentIds = new Set<number>();
  const leaveReasonByStudentId: Record<number, string> = {};
  (leaveRequests ?? []).forEach((lr) => {
    if (lr.status !== "approved") return;
    const targetId = lr.onBehalfOf?.id ?? lr.requester?.id;
    if (!targetId) return;
    approvedLeaveStudentIds.add(targetId);
    leaveReasonByStudentId[targetId] = lr.reason ?? "";
  });

  const studentStatuses: { student: (typeof students)[0]; status: StudentStatus; reason?: string }[] =
    students.map((s) => {
      if (approvedLeaveStudentIds.has(s.id)) {
        return { student: s, status: "excused", reason: leaveReasonByStudentId[s.id] };
      }
      if (s.status === "on_leave") {
        return { student: s, status: "absent", reason: "Long Term Leave" };
      }
      return { student: s, status: "present" };
    });

  const counts = {
    total: studentStatuses.length,
    present: studentStatuses.filter((s) => s.status === "present").length,
    absent: studentStatuses.filter((s) => s.status === "absent").length,
    excused: studentStatuses.filter((s) => s.status === "excused").length,
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold">
          {entry.gradeLabel} {entry.classLabel}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          AY 2026–2027 · Semester 1 (Fall) · Goldeen Park High
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          { label: "Present", value: counts.present, color: "text-green-600" },
          { label: "Absent", value: counts.absent, color: "text-red-500" },
          { label: "Excused", value: counts.excused, color: "text-blue-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border rounded-xl p-3 text-center shadow-sm">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* Student list */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Students ({counts.total})
          </p>
        </div>
        <div className="divide-y">
          {studentStatuses.map(({ student, status, reason }) => {
            const cfg = statusConfig[status];
            return (
              <div key={student.id} className="flex items-center gap-3 px-4 py-2.5">
                <UserAvatar user={student} className="w-8 h-8 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{student.name}</p>
                  {reason && <p className="text-[11px] text-muted-foreground truncate">{reason}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot color={cfg.color} />
                  <span className={`text-xs font-medium text-${cfg.color}-600`}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Attendance Overview ──────────────────────────────────────────────────────

function AttendanceOverview() {
  const [openGrades, setOpenGrades] = useState<Set<string>>(
    () => new Set(GRADE_TREE.map((g) => g.grade)) // all expanded by default
  );
  const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_CLASS_KEY);

  const toggleGrade = (grade: string) => {
    setOpenGrades((prev) => {
      const next = new Set(prev);
      next.has(grade) ? next.delete(grade) : next.add(grade);
      return next;
    });
  };

  const selectedEntry =
    GRADE_TREE.flatMap((g) => g.classes).find((c) => c.key === selectedKey) ??
    GRADE_TREE[1].classes[2]; // fallback: Grade 10 Class 03

  return (
    <div className="flex h-full">
      {/* ── Left: Grade / class tree ── */}
      <div className="w-56 flex-shrink-0 border-r bg-muted/20 overflow-y-auto">
        {/* Semester badge */}
        <div className="px-3 pt-4 pb-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            AY 2026–2027
          </div>
          <div className="text-xs font-medium text-foreground mt-0.5">Semester 1 · Fall</div>
        </div>

        <div className="mt-1 pb-4 space-y-0.5">
          {GRADE_TREE.map((group) => {
            const isOpen = openGrades.has(group.grade);
            return (
              <div key={group.grade}>
                {/* Grade header row */}
                <button
                  onClick={() => toggleGrade(group.grade)}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-accent/60 transition-colors"
                >
                  {isOpen
                    ? <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    : <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  }
                  <span className="text-sm font-semibold flex-1 truncate">{group.grade}</span>
                  <ChevronRight
                    className={cn(
                      "w-3.5 h-3.5 text-muted-foreground transition-transform",
                      isOpen && "rotate-90"
                    )}
                  />
                </button>

                {/* Class list */}
                {isOpen && (
                  <div className="ml-4 border-l border-border/60">
                    {group.classes.map((cls) => {
                      const isSelected = cls.key === selectedKey;
                      return (
                        <button
                          key={cls.key}
                          onClick={() => setSelectedKey(cls.key)}
                          className={cn(
                            "w-full flex items-center gap-2 pl-3 pr-2 py-1.5 text-left text-sm transition-colors",
                            isSelected
                              ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                          )}
                        >
                          <span className="truncate">{cls.classLabel}</span>
                          {cls.roomId !== null && (
                            <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500" title="Live data" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Class detail ── */}
      <ClassDetailPanel entry={selectedEntry} />
    </div>
  );
}

// ── Staff Roster ──────────────────────────────────────────────────────────────

import { STAFF_ROSTER, TEACHING_STAFF, NON_TEACHING_STAFF } from "@/data/staff-roster";
import type { StaffMember } from "@/data/staff-roster";

type StaffTab = "all" | "teaching" | "non-teaching";
type SortCol = "staffId" | "name" | "position" | "mainSubject" | "status";
type SortDir = "asc" | "desc";

function SortIcon({ col, active, dir }: { col: SortCol; active: boolean; dir: SortDir | null }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-30 inline-block" />;
  if (dir === "asc") return <ChevronUp className="w-3 h-3 ml-1 inline-block text-primary" />;
  return <ChevronDown className="w-3 h-3 ml-1 inline-block text-primary" />;
}

function StaffTable({
  rows,
  isNonTeaching,
  sortCol,
  sortDir,
  onSort,
}: {
  rows: StaffMember[];
  isNonTeaching?: boolean;
  sortCol: SortCol | null;
  sortDir: SortDir | null;
  onSort: (col: SortCol) => void;
}) {
  const thCls = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap";
  const tdCls = "px-3 py-2.5 text-sm";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b bg-muted/20">
          <tr>
            {(["staffId", "name", "position", "mainSubject", "status"] as SortCol[]).map((col) => {
              const labels: Record<SortCol, string> = {
                staffId: "Staff ID",
                name: "Name",
                position: "Position",
                mainSubject: isNonTeaching ? "Department" : "Main Subject",
                status: "Status",
              };
              return (
                <th key={col} className={thCls} onClick={() => onSort(col)}>
                  {labels[col]}
                  <SortIcon col={col} active={sortCol === col} dir={sortCol === col ? sortDir : null} />
                </th>
              );
            })}
            <th className={`${thCls} cursor-default hover:text-muted-foreground`}>Email</th>
            <th className={`${thCls} cursor-default hover:text-muted-foreground`}>Mobile</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s) => (
            <tr key={s.staffId} className="hover:bg-muted/30 transition-colors">
              <td className={`${tdCls} font-mono text-xs text-muted-foreground`}>{s.staffId}</td>
              <td className={`${tdCls} font-medium whitespace-nowrap`}>{s.name}</td>
              <td className={`${tdCls} text-muted-foreground`}>{s.position}</td>
              <td className={tdCls}>
                {isNonTeaching
                  ? (s.department ?? "—")
                  : s.subjects.length > 0
                    ? <span className="truncate max-w-[160px] block">{s.subjects[0]}</span>
                    : "—"
                }
              </td>
              <td className={tdCls}>
                <span className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                  s.status === "Active"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                )}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.status === "Active" ? "bg-green-500" : "bg-yellow-500"}`} />
                  {s.status}
                </span>
              </td>
              <td className={`${tdCls} text-muted-foreground text-xs`}>{s.email}</td>
              <td className={`${tdCls} text-muted-foreground whitespace-nowrap`}>{s.mobile}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No staff match your search.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TeachingSubjectGroups({
  rows,
  sortCol,
  sortDir,
  onSort,
}: {
  rows: StaffMember[];
  sortCol: SortCol | null;
  sortDir: SortDir | null;
  onSort: (col: SortCol) => void;
}) {
  // Group by main subject (subjects[0])
  const groups = useMemo(() => {
    const map: Record<string, StaffMember[]> = {};
    for (const s of rows) {
      const key = s.subjects[0] ?? "Other";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(groups.map(([k]) => k)));

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const thCls = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b bg-muted/20">
          <tr>
            {(["staffId", "name", "position", "mainSubject", "status"] as SortCol[]).map((col) => {
              const labels: Record<SortCol, string> = { staffId: "Staff ID", name: "Name", position: "Position", mainSubject: "Main Subject", status: "Status" };
              return (
                <th key={col} className={thCls} onClick={() => onSort(col)}>
                  {labels[col]}
                  <SortIcon col={col} active={sortCol === col} dir={sortCol === col ? sortDir : null} />
                </th>
              );
            })}
            <th className={`${thCls} cursor-default hover:text-muted-foreground`}>Email</th>
            <th className={`${thCls} cursor-default hover:text-muted-foreground`}>Mobile</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([subject, members]) => {
            const isOpen = openGroups.has(subject);
            return (
              <Fragment key={subject}>
                {/* Subject folder header */}
                <tr
                  className="bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => toggleGroup(subject)}
                >
                  <td colSpan={7} className="px-3 py-2 text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      {isOpen
                        ? <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        : <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      }
                      <span>{subject}</span>
                      <span className="ml-1 text-xs font-normal text-muted-foreground">— {members.length} staff</span>
                      <ChevronRight className={cn("w-3.5 h-3.5 ml-auto text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                    </div>
                  </td>
                </tr>
                {/* Member rows */}
                {isOpen && members.map((s) => (
                  <tr key={`row-${s.staffId}`} className="hover:bg-muted/20 transition-colors border-t border-border/40">
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground pl-10">{s.staffId}</td>
                    <td className="px-3 py-2.5 text-sm font-medium whitespace-nowrap">{s.name}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{s.position}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground truncate max-w-[160px]">{s.subjects[0] ?? "—"}</td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.email}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{s.mobile}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
          {groups.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No staff match your search.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StaffAttendance() {
  const [tab, setTab] = useState<StaffTab>("all");
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir | null>(null);
  const [search, setSearch] = useState("");

  const handleSort = (col: SortCol) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  };

  const filtered = useMemo(() => {
    let list: StaffMember[] = STAFF_ROSTER;
    if (tab === "teaching") list = TEACHING_STAFF;
    if (tab === "non-teaching") list = NON_TEACHING_STAFF;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.staffId.toLowerCase().includes(q) ||
          s.subjects.some((sub) => sub.toLowerCase().includes(q)) ||
          s.position.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.department ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tab, search]);

  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const val = (s: StaffMember) => {
        if (sortCol === "staffId") return s.staffId;
        if (sortCol === "name") return s.name;
        if (sortCol === "position") return s.position;
        if (sortCol === "mainSubject") return s.subjects[0] ?? s.department ?? "";
        if (sortCol === "status") return s.status;
        return "";
      };
      const cmp = val(a).localeCompare(val(b));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const tabs: { id: StaffTab; label: string; count: number; icon: React.ElementType }[] = [
    { id: "all",          label: "All Staff",          count: STAFF_ROSTER.length,     icon: Users },
    { id: "teaching",     label: "Teaching Staff",     count: TEACHING_STAFF.length,   icon: GraduationCap },
    { id: "non-teaching", label: "Non-Teaching Staff", count: NON_TEACHING_STAFF.length, icon: Briefcase },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top summary cards */}
      <div className="p-6 pb-0 space-y-5 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold">Staff Roster</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Goldeen Park High · AY 2026–2027 · Semester 1 (Fall)
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Staff",         value: STAFF_ROSTER.length,       color: "text-foreground" },
            { label: "Teaching Staff",       value: TEACHING_STAFF.length,     color: "text-primary" },
            { label: "Non-Teaching Staff",   value: NON_TEACHING_STAFF.length, color: "text-violet-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border rounded-xl p-3.5 text-center shadow-sm">
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, ID, subject, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border">
            {tabs.map(({ id, label, count, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                  tab === id
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className={cn(
                  "ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                  tab === id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto mt-4 border-t">
        <div className="bg-card min-w-max w-full">
          {tab === "teaching" ? (
            <TeachingSubjectGroups
              rows={sorted}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
          ) : (
            <StaffTable
              rows={sorted}
              isNonTeaching={tab === "non-teaching"}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Leave Requests ───────────────────────────────────────────────────────────

function LeaveRequests() {
  const { data: leaveRequests, isLoading } = useListLeaveRequests(undefined, {
    query: { refetchInterval: 5000 },
  });
  const updateLeave = useUpdateLeaveRequest();
  const queryClient = useQueryClient();

  const handleUpdate = (leaveId: number, status: "approved" | "rejected") => {
    updateLeave.mutate(
      { leaveId, data: { status } },
      {
        onSuccess: () => queryClient.invalidateQueries(),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
    );
  }

  const sorted = [...(leaveRequests ?? [])].sort((a, b) => {
    const order = { pending: 0, approved: 1, rejected: 2 };
    return (order[a.status as keyof typeof order] ?? 1) - (order[b.status as keyof typeof order] ?? 1);
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Leave Requests</h2>
        <p className="text-sm text-muted-foreground">All rooms — pending and recent</p>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center text-muted-foreground text-sm shadow-sm">
          No leave requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((lr) => {
            const isPending = lr.status === "pending";
            const isApproved = lr.status === "approved";
            const isRejected = lr.status === "rejected";

            const from = lr.onBehalfOf ? `${lr.requester?.name} (on behalf of ${lr.onBehalfOf.name})` : lr.requester?.name ?? "Unknown";
            const forStudent = lr.onBehalfOf?.name ?? lr.requester?.name ?? "Unknown";

            return (
              <div
                key={lr.id}
                className={cn(
                  "bg-card border rounded-2xl p-4 shadow-sm space-y-3",
                  isPending && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
                  isApproved && "border-green-200 dark:border-green-900",
                  isRejected && "border-red-200 dark:border-red-900 opacity-70"
                )}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isPending && <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                    {isApproved && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    {isRejected && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    <span className="font-semibold text-sm">
                      {isPending ? "New Leave Request" : isApproved ? "Approved Leave" : "Rejected Leave"}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize text-xs flex-shrink-0",
                      isPending && "border-amber-400 text-amber-700 bg-amber-50",
                      isApproved && "border-green-400 text-green-700 bg-green-50",
                      isRejected && "border-red-400 text-red-700 bg-red-50"
                    )}
                  >
                    {lr.status}
                  </Badge>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">From: </span>
                    <span className="font-medium">{from}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">For: </span>
                    <span className="font-medium">{forStudent}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <span className="font-medium capitalize">{lr.type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dates: </span>
                    <span className="font-medium">
                      {lr.startDate === lr.endDate
                        ? lr.startDate
                        : `${lr.startDate} – ${lr.endDate}`}
                    </span>
                  </div>
                  {lr.reason && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Reason: </span>
                      <span>{lr.reason}</span>
                    </div>
                  )}
                  {isApproved && lr.approvedBy && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Approved by: </span>
                      <span className="font-medium">{lr.approvedBy.name}</span>
                    </div>
                  )}
                </div>

                {/* Actions for pending */}
                {isPending && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleUpdate(lr.id, "approved")}
                      disabled={updateLeave.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleUpdate(lr.id, "rejected")}
                      disabled={updateLeave.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Room management ──────────────────────────────────────────────────────────

interface AdminRoom {
  id: number;
  name: string;
  type: "class" | "staff" | "admin";
  description: string | null;
  memberCount?: number;
}

function RoomManagement() {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminRoom | null>(null);
  const [draft, setDraft] = useState({ name: "", type: "class" as AdminRoom["type"], description: "" });

  const loadRooms = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/rooms", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load rooms");
      setRooms(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load rooms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRooms(); }, []);

  const startCreate = () => {
    setEditing(null);
    setDraft({ name: "", type: "class", description: "" });
    setError("");
  };

  const startEdit = (room: AdminRoom) => {
    setEditing(room);
    setDraft({ name: room.name, type: room.type, description: room.description ?? "" });
    setError("");
  };

  const saveRoom = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/rooms/${editing.id}` : "/api/rooms", {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name.trim(), type: draft.type, description: draft.description.trim() || null }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Unable to save room");
      setEditing(null);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save room");
    } finally {
      setSaving(false);
    }
  };

  const deleteRoom = async (room: AdminRoom) => {
    if (!window.confirm(`Delete “${room.name}” and all of its messages and memberships?`)) return;
    setError("");
    const response = await fetch(`/api/rooms/${room.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Unable to delete room");
      return;
    }
    setRooms((current) => current.filter((item) => item.id !== room.id));
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Rooms</h2>
          <p className="text-sm text-muted-foreground">Create, edit, or remove the school spaces shown to users.</p>
        </div>
        <Button onClick={startCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New room</Button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {(editing || draft.name === "") && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{editing ? "Edit room" : "Create a room"}</h3>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setDraft({ name: "", type: "class", description: "" }); }}>Cancel</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_2fr_auto] md:items-end">
            <label className="text-sm font-medium">Room name<input className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Grade 10 Science" /></label>
            <label className="text-sm font-medium">Type<select className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as AdminRoom["type"] })}><option value="class">Class</option><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
            <label className="text-sm font-medium">Description<input className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/20" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Optional description" /></label>
            <Button onClick={saveRoom} disabled={!draft.name.trim() || saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create room"}</Button>
          </div>
        </div>
      )}

      {loading ? <div className="space-y-3"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /></div> : rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">No rooms exist yet. Create the first room for your school.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {rooms.map((room) => <div key={room.id} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Folder className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><p className="font-semibold">{room.name}</p><p className="mt-0.5 text-xs text-muted-foreground"><span className="capitalize">{room.type}</span>{room.memberCount !== undefined ? ` · ${room.memberCount} members` : ""}{room.description ? ` · ${room.description}` : ""}</p></div>
            <Button variant="ghost" size="sm" onClick={() => startEdit(room)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => deleteRoom(room)} className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          </div>)}
        </div>
      )}
    </div>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [section, setSection] = useState<AdminSection>("attendance");

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-background">
      <AdminTopBar section={section} setSection={setSection} />

      <main className="flex-1 overflow-y-auto">
        {section === "attendance" && <AttendanceOverview />}
        {section === "staff" && <StaffAttendance />}
        {section === "leave" && <LeaveRequests />}
        {section === "rooms" && <RoomManagement />}
      </main>
    </div>
  );
}
