import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Pencil, Bot, Calendar, Clock, FileText, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListMessagesQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface ConfirmationCardProps {
  message: {
    id: number;
    roomId: number;
    metadata: any;
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

export function ConfirmationCard({ message }: ConfirmationCardProps) {
  const meta = message.metadata as {
    studentName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    duration: string | null;
    reason: string;
    notes: string | null;
    label: string;
    status: "pending" | "confirmed" | "cancelled";
  };

  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);
  const [localStatus, setLocalStatus] = useState<"pending" | "confirmed" | "cancelled">(meta.status);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(message.roomId) });

  const handleConfirm = async () => {
    setLoading("confirm");
    try {
      const r = await fetch(`/api/rooms/${message.roomId}/assistant/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmationMessageId: message.id }),
      });
      if (r.ok) {
        setLocalStatus("confirmed");
        invalidate();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    setLoading("cancel");
    try {
      const r = await fetch(`/api/rooms/${message.roomId}/assistant/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmationMessageId: message.id }),
      });
      if (r.ok) {
        setLocalStatus("cancelled");
        invalidate();
      }
    } finally {
      setLoading(null);
    }
  };

  const leaveTypeColor =
    meta.leaveType === "sick"
      ? "bg-red-50 text-red-700 border-red-200"
      : meta.leaveType === "personal"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-gray-50 text-gray-700 border-gray-200";

  const confirmed = localStatus === "confirmed";
  const cancelled = localStatus === "cancelled";

  return (
    <div className="w-full min-w-[260px] max-w-[340px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Leave Request Detected
          </p>
          <p className="text-[10px] text-muted-foreground">Heyya Assistant</p>
        </div>
        <div className="ml-auto">
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", leaveTypeColor)}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-1.5 text-[13px]">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="font-semibold">{meta.studentName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span>
            {meta.startDate === meta.endDate
              ? formatDate(meta.startDate)
              : `${formatDate(meta.startDate)} – ${formatDate(meta.endDate)}`}
            {meta.duration && (
              <span className="text-muted-foreground ml-1.5">({meta.duration})</span>
            )}
          </span>
        </div>
        {meta.reason && (
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground leading-snug">{meta.reason}</span>
          </div>
        )}
        {meta.notes && (
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground leading-snug italic">{meta.notes}</span>
          </div>
        )}
      </div>

      {/* Status / Buttons */}
      {confirmed ? (
        <div className="flex items-center gap-1.5 mt-3 text-emerald-600 text-[12px] font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Leave confirmed and recorded
        </div>
      ) : cancelled ? (
        <div className="flex items-center gap-1.5 mt-3 text-muted-foreground text-[12px]">
          <XCircle className="w-4 h-4" />
          Request cancelled
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            className="flex-1 h-8 text-[12px] rounded-lg"
            onClick={handleConfirm}
            disabled={loading !== null}
          >
            {loading === "confirm" ? (
              <span className="animate-pulse">Confirming…</span>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Confirm & Submit
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[12px] rounded-lg px-3"
            onClick={handleCancel}
            disabled={loading !== null}
          >
            <XCircle className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
