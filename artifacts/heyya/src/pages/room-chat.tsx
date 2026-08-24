import { useParams, Link } from "wouter";
import { useGetRoom, useListMessages, useGetMe } from "@workspace/api-client-react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { RoomAvatar } from "@/components/shared/avatars";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MatesPanel } from "@/components/chat/mates-panel";
import { useEffect, useRef, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Message } from "@workspace/api-client-react";

// ── Date formatting ──────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface DateGroup {
  key: string;
  label: string;
  messages: Message[];
}

function groupByDate(messages: Message[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let currentKey = "";
  for (const msg of messages) {
    const key = toDateKey(msg.createdAt);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ key, label: formatDateLabel(msg.createdAt), messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

const NEAR_BOTTOM_PX = 120;

// ── Component ────────────────────────────────────────────────────────────────

export default function RoomChat() {
  const { id } = useParams();
  const roomId = Number(id);
  const { data: user } = useGetMe();
  const { data: room, isLoading: roomLoading } = useGetRoom(roomId, {
    query: { enabled: !!roomId },
  });

  const { data: messagesList, isLoading: msgsLoading } = useListMessages(
    roomId,
    { limit: 50 },
    { query: { enabled: !!roomId, refetchInterval: 3000 } }
  );

  // API returns oldest-first — render as-is so oldest is at top, newest at bottom
  const messages: Message[] = messagesList ?? [];
  const groups = groupByDate(messages);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const initialScrollDoneRef = useRef(false);

  const [showJump, setShowJump] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stickyDate, setStickyDate] = useState<string | null>(null);

  // ── Scroll helpers ──────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((smooth: boolean) => {
    bottomAnchorRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
      block: "end",
    });
    isAtBottomRef.current = true;
    setShowJump(false);
    setUnreadCount(0);
  }, []);

  const refreshStickyDate = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const containerTop = el.getBoundingClientRect().top;
    let label = "";
    el.querySelectorAll<HTMLElement>("[data-date-label]").forEach((header) => {
      if (header.getBoundingClientRect().top <= containerTop + 48) {
        label = header.dataset.dateLabel ?? "";
      }
    });
    setStickyDate(label || null);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < NEAR_BOTTOM_PX;
    isAtBottomRef.current = atBottom;
    setShowJump(distFromBottom > el.clientHeight);
    if (atBottom) setUnreadCount(0);
    refreshStickyDate();
  }, [refreshStickyDate]);

  // ── Initial scroll to bottom ────────────────────────────────────────────────

  useEffect(() => {
    if (msgsLoading || messages.length === 0 || initialScrollDoneRef.current) return;
    // Double rAF ensures layout is fully painted before we measure/scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom(false);
        prevCountRef.current = messages.length;
        initialScrollDoneRef.current = true;
        refreshStickyDate();
      });
    });
  }, [msgsLoading, messages.length, scrollToBottom, refreshStickyDate]);

  // ── New-message auto-scroll ─────────────────────────────────────────────────

  useEffect(() => {
    if (!initialScrollDoneRef.current) return;
    const curr = messages.length;
    const prev = prevCountRef.current;
    if (curr <= prev) return;
    const added = curr - prev;
    prevCountRef.current = curr;

    const lastMsg = messages[curr - 1];
    const sentByMe = lastMsg?.senderId === user?.id;

    if (isAtBottomRef.current || sentByMe) {
      requestAnimationFrame(() => scrollToBottom(true));
    } else {
      setUnreadCount((n) => n + added);
      setShowJump(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, user?.id, scrollToBottom]);

  // ── Scroll listener ────────────────────────────────────────────────────────

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex h-full bg-[#E5DDD5] dark:bg-background">
      <div className="flex-1 flex flex-col min-w-0 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">

        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b bg-card/95 backdrop-blur z-10 flex-shrink-0 shadow-sm">
          <Link href="/rooms" className="md:hidden mr-3">
            <div className="p-2 -ml-2 rounded-full hover:bg-muted text-primary transition-colors cursor-pointer">
              <ArrowLeft className="w-6 h-6" />
            </div>
          </Link>
          {roomLoading ? (
            <div className="flex items-center gap-3 w-full">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ) : room ? (
            <div className="flex items-center gap-3 flex-1 cursor-pointer">
              <RoomAvatar room={room} className="w-10 h-10" />
              <div>
                <h2 className="font-semibold text-[15px]">{room.name}</h2>
                <p className="text-xs text-muted-foreground">{room.memberCount} members</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Scroll area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pt-2 pb-2 scroll-smooth"
        >
          {/* Sticky date pill */}
          {stickyDate && (
            <div className="sticky top-2 z-10 flex justify-center pointer-events-none mb-1">
              <div className="bg-black/20 text-white text-[11px] px-3 py-1 rounded-full backdrop-blur-md shadow-sm select-none">
                {stickyDate}
              </div>
            </div>
          )}

          {msgsLoading ? (
            <div className="flex flex-col gap-4 opacity-50 pt-4">
              <Skeleton className="h-12 w-2/3 self-start rounded-2xl" />
              <Skeleton className="h-16 w-3/4 self-end rounded-2xl" />
              <Skeleton className="h-10 w-1/2 self-start rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="bg-card/90 shadow-sm text-foreground text-sm px-6 py-3 rounded-full">
                No messages yet. Start the conversation!
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="flex justify-center my-4" data-date-label={group.label}>
                    <div className="bg-muted/80 text-muted-foreground text-[11px] px-3 py-1 rounded-full border shadow-sm backdrop-blur-sm select-none">
                      {group.label}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {group.messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isMine={msg.senderId === user?.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {/* Anchor element — scrolled into view to reach the bottom */}
              <div ref={bottomAnchorRef} className="h-2" />
            </div>
          )}
        </div>

        {/* Jump-to-bottom button */}
        <div
          className={cn(
            "absolute bottom-[72px] right-4 z-20 transition-all duration-200",
            showJump ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
          )}
        >
          <button
            onClick={() => scrollToBottom(true)}
            className="relative w-10 h-10 rounded-full bg-card border shadow-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent transition-colors active:scale-95"
          >
            <ChevronDown className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Input */}
        <ChatInput roomId={roomId} />
      </div>

      {/* Right: Mates Panel */}
      <div className="hidden lg:flex w-[280px] xl:w-[320px] flex-col border-l bg-card flex-shrink-0">
        <MatesPanel roomId={roomId} />
      </div>
    </div>
  );
}
