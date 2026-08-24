import { useGetLeaveRequest, useUpdateLeaveRequest, useGetMe, getGetLeaveRequestQueryKey, getGetRoomStatsQueryKey } from "@workspace/api-client-react";
import { UserAvatar } from "../shared/avatars";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, User, FileText, CheckCircle, XCircle } from "lucide-react";

export function LeaveCard({ message, isMine }: { message: any, isMine: boolean }) {
  const leaveId = Number(message.metadata?.leaveId);
  const { data: user } = useGetMe();
  const { data: leave } = useGetLeaveRequest(leaveId, { query: { enabled: !!leaveId } });
  const updateLeave = useUpdateLeaveRequest();
  const queryClient = useQueryClient();

  if (!leave) return <div className="animate-pulse h-24 w-64 bg-card/50 rounded-2xl" />;

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const isPending = leave.status === 'pending';

  const handleAction = (status: 'approved' | 'rejected') => {
    updateLeave.mutate({ leaveId, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeaveRequestQueryKey(leaveId) });
        queryClient.invalidateQueries({ queryKey: getGetRoomStatsQueryKey(message.roomId) });
      }
    });
  };

  const typeColors: Record<string, string> = {
    sick: "bg-orange-100 text-orange-800 border-orange-200",
    personal: "bg-blue-100 text-blue-800 border-blue-200",
    other: "bg-gray-100 text-gray-800 border-gray-200"
  };

  return (
    <div className={cn("mt-2 mb-1 rounded-2xl bg-card border shadow-sm p-4 w-full min-w-[260px] max-w-sm", isMine ? "text-card-foreground border-primary/20" : "")}>
      <div className="flex justify-between items-start mb-4">
        <Badge variant="outline" className={cn("capitalize px-2 py-0 h-5 text-[10px]", typeColors[leave.type] || typeColors.other)}>
          {leave.type} Leave
        </Badge>
        {leave.status === 'approved' && <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px] px-2 py-0 h-5 border-transparent"><CheckCircle className="w-3 h-3 mr-1"/> Approved</Badge>}
        {leave.status === 'rejected' && <Badge variant="secondary" className="bg-red-100 text-red-800 text-[10px] px-2 py-0 h-5 border-transparent"><XCircle className="w-3 h-3 mr-1"/> Rejected</Badge>}
        {leave.status === 'pending' && <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] px-2 py-0 h-5">Pending</Badge>}
      </div>

      <div className="space-y-3 mb-4 text-sm bg-background/50 rounded-xl p-3 border">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{leave.onBehalfOf?.name || leave.requester?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate">{new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</span>
        </div>
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-muted-foreground italic line-clamp-3 text-xs leading-relaxed">"{leave.reason}"</p>
        </div>
      </div>

      {isTeacherOrAdmin && isPending && (
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            className="flex-1 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shadow-none h-9"
            onClick={() => handleAction('rejected')}
            disabled={updateLeave.isPending}
          >
            Reject
          </Button>
          <Button 
            className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-none h-9"
            onClick={() => handleAction('approved')}
            disabled={updateLeave.isPending}
          >
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}
