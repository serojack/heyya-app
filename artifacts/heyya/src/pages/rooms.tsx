import { useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { RoomList } from "@/components/layout/room-list";
import { useListRooms } from "@workspace/api-client-react";
import { useLocation } from "wouter";

export default function RoomsPage() {
  const { data: rooms } = useListRooms();
  const [, setLocation] = useLocation();

  // Auto-navigate to the first (only) room on desktop
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setLocation(`/rooms/${rooms[0].id}`);
    }
  }, [rooms]);

  return (
    <div className="flex-1 flex h-full">
      {/* Mobile: Show RoomList */}
      <div className="md:hidden flex-1 flex flex-col pb-16 h-full">
        <RoomList />
      </div>

      {/* Desktop: Show loading/empty state while waiting for auto-redirect */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-secondary/30 h-full">
        <div className="text-center space-y-4 max-w-sm px-4">
          <div className="bg-primary p-5 rounded-full inline-flex items-center justify-center shadow-lg shadow-primary/20">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl text-foreground tracking-wide" style={{ fontFamily: "10Pixel, sans-serif" }}>Heyya</h2>
          <p className="text-muted-foreground text-sm">Loading your classroom…</p>
        </div>
      </div>
    </div>
  );
}
