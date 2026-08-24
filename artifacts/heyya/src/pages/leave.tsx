import { useState } from "react";
import { useListLeaveRequests, useCreateLeaveRequest, useGetMe, getListLeaveRequestsQueryKey } from "@workspace/api-client-react";
import { formatRelativeTime } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, Plus, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { UserAvatar } from "@/components/shared/avatars";

export default function LeavePage() {
  const { data: user } = useGetMe();
  const [filter, setFilter] = useState<'pending'|'approved'|'rejected'|'all'>('all');
  const { data: requests, isLoading } = useListLeaveRequests(
    { status: filter === 'all' ? undefined : filter },
    { query: { refetchInterval: 10000 } }
  );

  const isParentOrStudent = user?.role === 'parent' || user?.role === 'student';

  const typeColors: Record<string, string> = {
    sick: "bg-orange-100 text-orange-800",
    personal: "bg-blue-100 text-blue-800",
    other: "bg-gray-100 text-gray-800"
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1"/> Approved</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1"/> Rejected</Badge>;
      default: return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-secondary/10">
      <div className="flex-shrink-0 p-4 border-b bg-card flex justify-between items-center z-10 sticky top-0">
        <div>
          <h1 className="text-xl font-bold">Leave Requests</h1>
          <p className="text-sm text-muted-foreground hidden md:block">Manage absences and leave history</p>
        </div>
        {isParentOrStudent && <NewLeaveDialog />}
      </div>

      <div className="p-4 flex gap-2 overflow-x-auto no-scrollbar bg-card border-b">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <Badge 
            key={f}
            variant={filter === f ? "default" : "outline"}
            className="cursor-pointer capitalize px-4 py-1.5 whitespace-nowrap"
            onClick={() => setFilter(f)}
          >
            {f}
          </Badge>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20 md:pb-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-card rounded-2xl animate-pulse border" />
          ))
        ) : requests?.length === 0 ? (
          <div className="text-center p-10 text-muted-foreground">
            <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p>No leave requests found.</p>
          </div>
        ) : (
          requests?.map(req => (
            <div key={req.id} className="bg-card border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <UserAvatar user={req.onBehalfOf || req.requester} className="w-8 h-8" />
                    <div>
                      <div className="font-semibold text-sm">{req.onBehalfOf?.name || req.requester?.name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className={typeColors[req.type] || typeColors.other}>
                      {req.type}
                    </Badge>
                    {getStatusBadge(req.status)}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-sm italic border">
                  "{req.reason}"
                </div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Requested {formatRelativeTime(req.createdAt)}</span>
                  {req.approvedBy && <span>Reviewed by {req.approvedBy.name}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NewLeaveDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"sick"|"personal"|"other">("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const createLeave = useCreateLeaveRequest();
  const queryClient = useQueryClient();

  const handleCreate = () => {
    if (!startDate || !endDate || !reason) return;
    createLeave.mutate({ data: { type, startDate, endDate, reason } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeaveRequestsQueryKey() });
        setOpen(false);
        setReason("");
        setStartDate("");
        setEndDate("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full gap-2 shadow-md">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Apply Leave</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Leave Type</label>
            <div className="flex gap-2 flex-wrap">
              {(["sick", "personal", "other"] as const).map(t => (
                <Badge 
                  key={t}
                  variant={type === t ? "default" : "outline"}
                  className="cursor-pointer capitalize px-4 py-1"
                  onClick={() => setType(t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <textarea 
              className="w-full rounded-xl border p-3 text-sm focus:ring-2 focus:ring-primary outline-none min-h-[100px] resize-none"
              placeholder="Please explain why you need this leave..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!startDate || !endDate || !reason || createLeave.isPending} className="w-full sm:w-auto">
            {createLeave.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
