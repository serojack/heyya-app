import { Message } from "@workspace/api-client-react";
import { formatMessageTime } from "@/lib/date-utils";
import { UserAvatar } from "../shared/avatars";
import { cn } from "@/lib/utils";
import { AttendanceCard } from "./attendance-card";
import { LeaveCard } from "./leave-card";
import { ConfirmationCard } from "./confirmation-card";
import { HookCard } from "./hook-card";

export function MessageBubble({ message, isMine }: { message: Message, isMine: boolean }) {
  // Hook card renders as a standalone full-width card (not a bubble)
  if (message.type === "hook_card") {
    return (
      <div className="flex justify-center my-2">
        <HookCard message={message as any} />
      </div>
    );
  }

  if (message.type === "system") {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-muted/80 text-muted-foreground text-[12px] px-4 py-1.5 rounded-full font-medium shadow-sm backdrop-blur-sm border">
          {message.content}
        </div>
      </div>
    );
  }

  // Telegram-style bubble shapes
  const bubbleShape = isMine 
    ? "rounded-[1.25rem] rounded-br-sm" 
    : "rounded-[1.25rem] rounded-bl-sm";

  const bubbleColor = isMine
    ? "bg-primary text-primary-foreground shadow-sm"
    : "bg-card text-card-foreground border shadow-sm";

  return (
    <div className={cn("flex w-full gap-2", isMine ? "justify-end" : "justify-start")}>
      {!isMine && (
        <UserAvatar user={message.sender} className="w-8 h-8 mt-auto flex-shrink-0" />
      )}
      
      <div className={cn(
        "max-w-[85%] md:max-w-[75%] px-3 pb-1.5 pt-2 relative group",
        bubbleShape,
        bubbleColor
      )}>
        {/* Sender Name for received messages */}
        {!isMine && message.sender && (
          <div className="text-[13px] font-semibold text-primary mb-0.5">
            {message.sender.name}
          </div>
        )}

        {/* Message Content depending on type */}
        {message.type === "text" && (
          <div className="text-[15px] leading-snug whitespace-pre-wrap break-words pr-12">
            {message.content}
          </div>
        )}

        {message.type === "attendance_card" && (
          <div className="pr-12">
            <AttendanceCard message={message} isMine={isMine} />
          </div>
        )}

        {message.type === "leave_card" && (
          <div className="pr-12">
            <LeaveCard message={message} isMine={isMine} />
          </div>
        )}

        {message.type === "confirmation_card" && (
          <div className="pr-12">
            <ConfirmationCard message={message as any} />
          </div>
        )}

        {/* Floating Time Badge inside the bubble */}
        <div className={cn(
          "text-[10px] float-right mt-1 ml-3 select-none flex items-center gap-1",
          isMine ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {formatMessageTime(message.createdAt)}
        </div>

        {/* Clear floats */}
        <div className="clear-both" />
      </div>
    </div>
  );
}
