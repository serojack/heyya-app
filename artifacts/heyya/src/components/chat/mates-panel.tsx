import { useGetRoomMembers, useGetRoomStats } from "@workspace/api-client-react";
import { UserAvatar } from "@/components/shared/avatars";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/date-utils";

export function MatesPanel({ roomId }: { roomId: number }) {
  const { data: members, isLoading: membersLoading } = useGetRoomMembers(roomId, { query: { enabled: !!roomId } });
  const { data: stats } = useGetRoomStats(roomId, { query: { enabled: !!roomId } });

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Room Info</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-card border rounded-2xl p-3 shadow-sm">
                <div className="text-2xl font-bold text-primary">{stats.memberCount}</div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Members</div>
              </div>
              <div className="bg-card border rounded-2xl p-3 shadow-sm">
                <div className="text-2xl font-bold text-primary">{stats.messageCount}</div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Messages</div>
              </div>
              {stats.attendanceToday !== null && (
                <div className="bg-card border rounded-2xl p-3 shadow-sm col-span-2 flex justify-between items-center px-4">
                  <div className="text-left">
                    <div className="text-sm font-bold">Attendance Today</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="text-green-600 font-bold">{stats.presentToday}</span> present • <span className="text-red-500 font-bold">{stats.absentToday}</span> absent
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-background">
                    {(() => {
                      const total = (stats.presentToday || 0) + (stats.absentToday || 0);
                      return total > 0 ? `${Math.round((stats.presentToday || 0) / total * 100)}%` : "—";
                    })()}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Members List */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Mates ({members?.length || 0})
            </h3>
            <div className="space-y-1">
              {membersLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  </div>
                ))
              ) : (
                members?.map((member) => (
                  <div key={member.userId} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-accent/50 transition-colors">
                    <UserAvatar user={member.user} className="w-10 h-10" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[15px] truncate">{member.user.name}</div>
                      <div className="text-xs text-muted-foreground capitalize flex items-center gap-1.5">
                        {member.user.role} 
                        {member.user.status === 'on_leave' && <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[9px] bg-yellow-500/20 text-yellow-700">On Leave</Badge>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
