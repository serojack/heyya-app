import { useState, useEffect } from "react";
import { BookOpen, ClipboardList, AlertCircle, X, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface HookItem {
  id: string;
  category: "lesson" | "assignment" | "upcoming";
  text: string;
  dueDate: string | null;
  checked: boolean;
}

interface HookCardProps {
  message: {
    id: number;
    metadata: any;
    createdAt: string;
  };
}

const CATEGORY_CONFIG = {
  lesson: {
    icon: BookOpen,
    label: "What we covered today",
    emoji: "📌",
    color: "text-blue-700",
  },
  assignment: {
    icon: ClipboardList,
    label: "Assignments due",
    emoji: "📝",
    color: "text-orange-700",
  },
  upcoming: {
    icon: AlertCircle,
    label: "Upcoming",
    emoji: "✅",
    color: "text-emerald-700",
  },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

export function HookCard({ message }: HookCardProps) {
  const meta = message.metadata as {
    studentName: string;
    date: string;
    items: HookItem[];
  };

  const storageKey = `hook-${message.id}`;

  // Load persisted checked state from localStorage
  const [items, setItems] = useState<HookItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedMap: Record<string, boolean> = JSON.parse(saved);
        return (meta.items ?? []).map((item) => ({
          ...item,
          checked: savedMap[item.id] ?? item.checked,
        }));
      }
    } catch {}
    return meta.items ?? [];
  });

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(`${storageKey}-dismissed`) === "1";
    } catch {
      return false;
    }
  });

  const toggleItem = (id: string) => {
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      );
      // Persist
      try {
        const map: Record<string, boolean> = {};
        next.forEach((i) => (map[i.id] = i.checked));
        localStorage.setItem(storageKey, JSON.stringify(map));
      } catch {}
      return next;
    });
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`${storageKey}-dismissed`, "1");
    } catch {}
  };

  if (dismissed) return null;

  // Group items by category
  const grouped: Record<string, HookItem[]> = { lesson: [], assignment: [], upcoming: [] };
  items.forEach((item) => {
    const cat = item.category in grouped ? item.category : "lesson";
    grouped[cat].push(item);
  });

  const allDone = items.length > 0 && items.every((i) => i.checked);

  return (
    <div className="w-full max-w-[360px] rounded-2xl overflow-hidden border border-amber-200/80 shadow-sm">
      {/* Warm header */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 flex items-center justify-between border-b border-amber-200/60">
        <div>
          <p className="text-[13px] font-bold text-amber-800">
            Your Hook — {formatDate(meta.date)}
          </p>
          <p className="text-[11px] text-amber-600 mt-0.5">
            {allDone ? "All caught up! 🎉" : `Here's what you missed, ${meta.studentName.split(" ")[0]}.`}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="p-1 rounded-full hover:bg-amber-200/60 text-amber-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="bg-amber-50/40 px-4 py-3 space-y-3">
        {Object.entries(grouped).map(([cat, catItems]) => {
          if (catItems.length === 0) return null;
          const config = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
          return (
            <div key={cat}>
              <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-1.5", config.color)}>
                {config.emoji} {config.label}
              </p>
              <div className="space-y-1">
                {catItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className="w-full flex items-start gap-2 group text-left"
                  >
                    <div className="mt-0.5 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                      {item.checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-[13px] leading-snug",
                          item.checked && "line-through text-muted-foreground"
                        )}
                      >
                        {item.text}
                      </p>
                      {item.dueDate && !item.checked && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Due {formatDate(item.dueDate)}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-amber-50/40 px-4 pb-3 border-t border-amber-200/40 pt-2">
        <p className="text-[11px] text-amber-600 text-center">
          Get well soon! Tap ✅ to mark items complete.
        </p>
      </div>
    </div>
  );
}
