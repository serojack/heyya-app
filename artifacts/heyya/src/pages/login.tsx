import { useState } from "react";
import { useDemoLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const DEMO_EMAIL = "demouser@heyya.app";
const DEMO_PASSWORD = "demo1990user";

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useDemoLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (email.trim() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setError("Invalid login ID or password.");
      return;
    }

    // Credentials match — log in as first teacher
    loginMutation.mutate(
      { data: { role: "teacher" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/");
        },
        onError: () => {
          setError("Login failed. Please try again.");
        },
      }
    );
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 dark:bg-background p-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-primary-foreground text-3xl font-bold tracking-tight">H</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl tracking-wide" style={{ fontFamily: "10Pixel, sans-serif" }}>Heyya</h1>
            <p className="text-sm text-muted-foreground">Goldeen Park High</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Login ID
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        {/* Demo hint */}
        <p className="text-center text-xs text-muted-foreground border border-dashed rounded-lg px-4 py-3">
          Demo account:{" "}
          <span
            className="font-mono text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => setEmail(DEMO_EMAIL)}
          >
            {DEMO_EMAIL}
          </span>
          {" / "}
          <span
            className="font-mono text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => setPassword(DEMO_PASSWORD)}
          >
            {DEMO_PASSWORD}
          </span>
        </p>
      </div>
    </div>
  );
}
