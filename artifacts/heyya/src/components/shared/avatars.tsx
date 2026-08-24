import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function UserAvatar({
  user,
  className,
}: {
  user?: { name: string; avatarUrl?: string | null; status?: string };
  className?: string;
}) {
  if (!user) return null;

  const statusColor =
    user.status === "online"
      ? "bg-green-500"
      : user.status === "on_leave"
        ? "bg-yellow-500"
        : "bg-gray-400";

  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar className="w-full h-full">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
        <AvatarFallback
          style={{ backgroundColor: stringToColor(user.name), color: "#fff" }}
        >
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "absolute bottom-0 right-0 block w-3 h-3 rounded-full ring-2 ring-background",
          statusColor,
        )}
      />
    </div>
  );
}

export function RoomAvatar({
  room,
  className,
}: {
  room: { name: string; avatarUrl?: string | null };
  className?: string;
}) {
  return (
    <Avatar className={cn(className)}>
      {room.avatarUrl && (
        <AvatarImage src={room.avatarUrl} alt={room.name} />
      )}
      <AvatarFallback
        style={{ backgroundColor: stringToColor(room.name), color: "#fff" }}
      >
        {getInitials(room.name)}
      </AvatarFallback>
    </Avatar>
  );
}
