import { useLocation, Link } from "wouter";
import { MessageSquare, Sparkles, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [location] = useLocation();

  // Hide mobile nav inside a specific chat room
  if (location.startsWith("/rooms/") && location !== "/rooms") {
    return null;
  }

  const navItems = [
    { href: "/assistant", label: "Assistant", icon: Sparkles },
    { href: "/rooms", label: "School", icon: MessageSquare },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around z-40 pb-safe">
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href === "/rooms" && location.startsWith("/rooms"));
        return (
          <Link key={item.href} href={item.href}>
            <div className={cn(
              "flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors cursor-pointer",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <item.icon className={cn("w-6 h-6", isActive && "fill-primary/20")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
