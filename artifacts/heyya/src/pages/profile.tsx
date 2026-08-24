import { useGetMe, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInitials, stringToColor } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { data: user } = useGetMe();
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const handleStatusToggle = () => {
    const newStatus = user.status === "online" ? "offline" : "online";
    updateMe.mutate({ data: { status: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      }
    });
  };

  const handleLogout = () => {
    // There isn't a strict logout endpoint in demo, but we can clear local storage or redirect to login.
    // Assuming backend uses a cookie, we can't easily clear it without an endpoint.
    // For demo purposes, we redirect to login where they can "re-login".
    setLocation("/");
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-0 bg-secondary/10">
      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
        <h1 className="text-3xl font-bold mb-6">Profile</h1>
        
        <Card className="border-none shadow-md overflow-hidden rounded-3xl">
          <div className="h-32 bg-gradient-to-r from-primary/80 to-primary" />
          <CardContent className="relative px-6 pb-8 pt-0">
            <div className="absolute -top-16 left-6 rounded-full p-1 bg-card">
              <Avatar className="w-24 h-24 border-4 border-card">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                <AvatarFallback style={{ backgroundColor: stringToColor(user.name), color: 'white', fontSize: '2rem' }}>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full ring-4 ring-card ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
            </div>
            
            <div className="mt-12 space-y-1">
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <p className="text-muted-foreground capitalize">{user.role} • {user.email}</p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl">
                <div>
                  <p className="font-medium">Online Status</p>
                  <p className="text-sm text-muted-foreground">Show others when you are active</p>
                </div>
                <Button 
                  variant={user.status === 'online' ? "default" : "outline"} 
                  onClick={handleStatusToggle}
                  disabled={updateMe.isPending}
                  className="rounded-full"
                >
                  {user.status === 'online' ? 'Online' : 'Offline'}
                </Button>
              </div>

              <div className="pt-4">
                <Button variant="destructive" className="w-full rounded-2xl" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
