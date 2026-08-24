import { ReactNode, useState } from "react";
import { RoomList } from "./room-list";
import { MobileNav } from "./mobile-nav";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 ${sidebarOpen ? "w-[320px] lg:w-[380px]" : "w-16"}`}>
        <RoomList collapsed={!sidebarOpen} onToggle={() => setSidebarOpen((open) => !open)} />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {children}
        <MobileNav />
      </div>
    </div>
  );
}
