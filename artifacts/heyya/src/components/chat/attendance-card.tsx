import { useGetAttendance, useUpdateAttendanceEntry, useFinalizeAttendance, useGetMe, getGetAttendanceQueryKey } from "@workspace/api-client-react";
import { UserAvatar } from "../shared/avatars";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock, Info, Calendar as CalendarIcon } from "lucide-react";

const statusConfig = {
  present: { color: "bg-green-500", text: "text-green-700", icon: Check },
  absent: { color: "bg-red-500", text: "text-red-700", icon: X },
  late: { color: "bg-amber-500", text: "text-amber-700", icon: Clock },
  excused: { color: "bg-blue-500", text: "text-blue-700", icon: Info },
};

export function AttendanceCard({ message, isMine }: { message: any, isMine: boolean }) {
  const attendanceId = Number(message.metadata?.attendanceId);
  const { data: user } = useGetMe();
  const { data: attendance } = useGetAttendance(attendanceId, { query: { enabled: !!attendanceId } });
  const updateEntry = useUpdateAttendanceEntry();
  const finalize = useFinalizeAttendance();
  const queryClient = useQueryClient();

  if (!attendance) return <div className="animate-pulse h-24 w-64 bg-card/50 rounded-2xl" />;

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const isParent = user?.role === 'parent';

  // Filter entries if parent (only show their child)
  const entries = attendance.entries.filter(e => 
    !isParent || e.studentId === user?.childId
  );

  const handleUpdate = (studentId: number, status: 'present'|'absent'|'late'|'excused') => {
    if (!isTeacherOrAdmin || attendance.finalized) return;
    updateEntry.mutate({ attendanceId, data: { studentId, status } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAttendanceQueryKey(attendanceId) })
    });
  };

  const handleFinalize = () => {
    if (!isTeacherOrAdmin || attendance.finalized) return;
    finalize.mutate({ attendanceId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAttendanceQueryKey(attendanceId) })
    });
  };

  return (
    <div className={cn("mt-2 mb-1 rounded-2xl bg-card border shadow-sm p-4 w-full min-w-[280px] max-w-sm", isMine ? "text-card-foreground border-primary/20" : "")}>
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-full text-primary">
            <CalendarIcon className="w-4 h-4" />
          </div>
          Attendance
        </h4>
        {attendance.finalized ? (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-transparent text-[10px] px-2 py-0 h-5">Finalized</Badge>
        ) : (
          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px] px-2 py-0 h-5">Active Session</Badge>
        )}
      </div>

      {attendance.finalized && isTeacherOrAdmin ? (
        <div className="bg-muted rounded-xl p-3 mb-4 text-xs font-medium flex gap-3 flex-wrap">
          <span className="text-green-700">{attendance.presentCount} Present</span>
          <span className="text-red-700">{attendance.absentCount} Absent</span>
          {!!attendance.lateCount && <span className="text-amber-700">{attendance.lateCount} Late</span>}
          {!!attendance.excusedCount && <span className="text-blue-700">{attendance.excusedCount} Excused</span>}
        </div>
      ) : null}

      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
        {entries.map(entry => (
          <div key={entry.studentId} className="flex items-center justify-between p-2 rounded-xl bg-background/50 border hover:bg-background transition-colors">
            <div className="flex items-center gap-2">
              <UserAvatar user={entry.student} className="w-7 h-7" />
              <span className="text-sm font-medium truncate max-w-[90px]">{entry.student?.name}</span>
            </div>
            <div className="flex gap-1">
              {(["present", "absent", "late", "excused"] as const).map(s => {
                if (!isTeacherOrAdmin && entry.status !== s) return null;
                
                const isActive = entry.status === s;
                const Icon = statusConfig[s].icon;
                return (
                  <button
                    key={s}
                    disabled={!isTeacherOrAdmin || attendance.finalized || updateEntry.isPending}
                    onClick={() => handleUpdate(entry.studentId, s)}
                    className={cn(
                      "p-1.5 rounded-full transition-all duration-200",
                      isActive ? statusConfig[s].color + " text-white shadow-sm scale-110" : "bg-muted text-muted-foreground hover:bg-accent",
                      (!isTeacherOrAdmin || attendance.finalized) && "cursor-default hover:bg-muted"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {entries.length === 0 && <div className="text-sm text-center text-muted-foreground py-2">No students</div>}
      </div>

      {isTeacherOrAdmin && !attendance.finalized && (
        <Button 
          className="w-full mt-4 rounded-xl shadow-sm" 
          onClick={handleFinalize}
          disabled={finalize.isPending}
        >
          Finalize Attendance
        </Button>
      )}
    </div>
  );
}
