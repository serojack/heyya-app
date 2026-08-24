import { useState } from "react";
import { useSendMessage, useCreateAttendance, getListMessagesQueryKey } from "@workspace/api-client-react";
import { Paperclip, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export function ChatInput({ roomId }: { roomId: number }) {
  const [text, setText] = useState("");
  const sendMessage = useSendMessage();
  const createAttendance = useCreateAttendance();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(roomId) });

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;

    // Natural-language attendance trigger
    const lower = content.toLowerCase();
    if (
      lower === "take attendance" ||
      lower === "roll call" ||
      lower.includes("who's here") ||
      lower.includes("whos here")
    ) {
      createAttendance.mutate(
        { roomId, data: {} },
        { onSuccess: () => { setText(""); invalidate(); } }
      );
      return;
    }

    // All other messages go as text — the assistant will detect intent server-side
    sendMessage.mutate(
      { roomId, data: { content, type: "text" } },
      { onSuccess: () => { setText(""); invalidate(); } }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const busy = sendMessage.isPending || createAttendance.isPending;

  return (
    <div className="bg-card p-2 border-t z-20">
      <div className="max-w-4xl mx-auto flex items-end gap-2 bg-background border rounded-[24px] p-1.5 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-primary"
        >
          <Paperclip className="w-5 h-5" />
        </Button>

        <textarea
          className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 min-h-[40px] py-2.5 px-2 text-[15px] outline-none"
          placeholder="Message..."
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
          }}
          onKeyDown={handleKeyDown}
        />

        {text.trim() ? (
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform active:scale-95"
            onClick={handleSend}
            disabled={busy}
          >
            <Send className="w-5 h-5 ml-0.5" />
          </Button>
        ) : (
          <div className="h-10 w-10 shrink-0" />
        )}
      </div>
    </div>
  );
}
