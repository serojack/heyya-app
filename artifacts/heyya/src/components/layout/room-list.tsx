import { useState } from "react";
import { useListRooms, useGetMe, useCreateRoom, getListRoomsQueryKey, useListUsers, useDemoLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Search, Plus, Hash, Users, Shield, MessageSquare, ChevronDown, Upload, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RoomAvatar } from "@/components/shared/avatars";
import { UserAvatar } from "@/components/shared/avatars";
import { formatRelativeTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ExcelUploadButton } from "@/components/shared/excel-upload";

export function RoomList({ className, collapsed = false, onToggle }: { className?: string; collapsed?: boolean; onToggle?: () => void }) {
  const [search, setSearch] = useState("");
  const { data: user } = useGetMe();
  const { data: rooms, isLoading } = useListRooms(
    { search: search.length > 1 ? search : undefined },
    { query: { refetchInterval: 5000 } }
  );
  const [location] = useLocation();

  const isAdmin = user?.role === "admin";

  const getRoomIcon = (type: string) => {
    switch(type) {
      case 'class': return <Hash className="w-3 h-3" />;
      case 'staff': return <Users className="w-3 h-3" />;
      case 'admin': return <Shield className="w-3 h-3" />;
      default: return <MessageSquare className="w-3 h-3" />;
    }
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-4 py-4">
        <button onClick={onToggle} title="Open Heyya navigation" className="rounded-xl px-2 py-2 text-xl tracking-wide hover:bg-accent" style={{ fontFamily: "10Pixel, sans-serif" }}>
          H
        </button>
        <Link href="/assistant" title="Open Heyya Assistant">
          <div className={cn("rounded-xl p-2.5", location === "/" || location === "/assistant" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
            <Sparkles className="h-5 w-5" />
          </div>
        </Link>
        <Link href="/rooms" title="Rooms">
          <div className={cn("rounded-xl p-2.5", location.startsWith("/rooms") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
            <MessageSquare className="h-5 w-5" />
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-sidebar", className)}>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        {/* App title row */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={onToggle} className="text-left" title="Minimise navigation">
              <h2 className="text-xl tracking-wide" style={{ fontFamily: "10Pixel, sans-serif" }}>Heyya</h2>
            </button>
            <p className="text-xs text-muted-foreground">Your personal assistant</p>
          </div>
          <div className="flex items-center gap-1">
            <ExcelUploadButton />
            {isAdmin && <NewRoomDialog />}
          </div>
        </div>

        {/* View As switcher */}
        <ViewAsSwitcher />

        <Link href="/assistant">
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium cursor-pointer transition-colors",
            location === "/" || location === "/assistant"
              ? "bg-primary text-primary-foreground"
              : "bg-sky-50 text-sky-700 hover:bg-sky-100"
          )}>
            <Sparkles className="w-4 h-4" />
            <span>Open Heyya Assistant</span>
          </div>
        </Link>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search rooms..."
            className="pl-9 bg-background border-transparent shadow-sm focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Rooms</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex items-center p-3 space-x-3">
              <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
              </div>
            </div>
          ))
        ) : rooms?.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No rooms found.
          </div>
        ) : (
          rooms?.map((room) => {
            const isActive = location === `/rooms/${room.id}`;
            return (
              <Link key={room.id} href={`/rooms/${room.id}`}>
                <div className={cn(
                  "flex items-center p-3 space-x-3 rounded-2xl transition-colors cursor-pointer select-none",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent/50 text-foreground"
                )}>
                  <RoomAvatar room={room} className="w-12 h-12 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-[15px] truncate pr-2 flex items-center gap-1.5">
                        <span className={isActive ? "text-primary-foreground/80" : "text-muted-foreground"}>
                          {getRoomIcon(room.type)}
                        </span>
                        <span className="truncate">{room.name}</span>
                      </h3>
                      {room.lastMessageAt && (
                        <span className={cn("text-xs whitespace-nowrap", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {formatRelativeTime(room.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-baseline">
                      <p className={cn("text-sm truncate pr-2", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {room.lastMessageSender ? (
                          <span className="font-medium mr-1">{room.lastMessageSender}:</span>
                        ) : null}
                        {room.lastMessage || <span className="italic opacity-70">No messages yet</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function ViewAsSwitcher() {
  const { data: currentUser } = useGetMe();
  const { data: allUsers } = useListUsers();
  const loginMutation = useDemoLogin();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const teachers = allUsers?.filter((u) => u.role === "teacher") ?? [];
  const students = allUsers?.filter((u) => u.role === "student") ?? [];
  const parents = allUsers?.filter((u) => u.role === "parent") ?? [];

  const switchUser = (userId: number) => {
    if (userId === currentUser?.id) return;
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

  const goAdmin = () => {
    setLocation("/admin");
  };

  const handleLogout = async () => {
    await fetch("/api/users/logout", { method: "POST", credentials: "include" });
    queryClient.clear();
    setLocation("/login");
  };

  const displayName = currentUser
    ? (currentUser.role === "teacher" ? currentUser.name : (currentUser.name.split(" ")[0] ?? currentUser.name))
    : "Loading…";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent/60 transition-colors text-left group"
          disabled={loginMutation.isPending}
        >
          <UserAvatar user={currentUser} className="w-8 h-8 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider leading-none mb-0.5">
              Viewing as
            </p>
            <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wider">
          Switch perspective
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Admin */}
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer font-medium text-rose-600 focus:text-rose-600"
          onClick={goAdmin}
        >
          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">Admin</p>
            <p className="text-[10px] text-muted-foreground">Dashboard view</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Teachers */}
        <DropdownMenuLabel className="text-[10px] text-muted-foreground px-2 py-1">
          Teachers
        </DropdownMenuLabel>
        {teachers.map((u) => (
          <DropdownMenuItem
            key={u.id}
            className="gap-2.5 cursor-pointer"
            onClick={() => switchUser(u.id)}
          >
            <UserAvatar user={u} className="w-8 h-8" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{u.name}</p>
            </div>
            {u.id === currentUser?.id && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        {parents.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground px-2 py-1">
              Parents
            </DropdownMenuLabel>
            {parents.map((u) => (
              <DropdownMenuItem
                key={u.id}
                className="gap-2.5 cursor-pointer"
                onClick={() => switchUser(u.id)}
              >
                <UserAvatar user={u} className="w-8 h-8" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.name}</p>
                </div>
                {u.id === currentUser?.id && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Students */}
        <DropdownMenuLabel className="text-[10px] text-muted-foreground px-2 py-1">
          Students
        </DropdownMenuLabel>
        {students.map((u) => (
          <DropdownMenuItem
            key={u.id}
            className={cn("gap-2.5 cursor-pointer", u.status === "withdrawn" && "opacity-50")}
            onClick={() => switchUser(u.id)}
            disabled={u.status === "withdrawn"}
          >
            <UserAvatar user={u} className="w-8 h-8" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{u.name}</p>
              {u.status === "on_leave" && (
                <p className="text-[10px] text-yellow-600 font-medium">On Leave</p>
              )}
              {u.status === "withdrawn" && (
                <p className="text-[10px] text-muted-foreground">Withdrawn</p>
              )}
            </div>
            {u.id === currentUser?.id && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer text-muted-foreground focus:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewRoomDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"class"|"staff"|"admin">("class");
  const createRoom = useCreateRoom();
  const queryClient = useQueryClient();

  const handleCreate = () => {
    if (!name.trim()) return;
    createRoom.mutate({ data: { name, type } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        setOpen(false);
        setName("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary">
          <Plus className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Room</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Room Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grade 10 Science" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Room Type</label>
            <div className="flex gap-2">
              {(["class", "staff", "admin"] as const).map(t => (
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
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!name.trim() || createRoom.isPending}>
            {createRoom.isPending ? "Creating..." : "Create Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
