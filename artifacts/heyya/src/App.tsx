import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AuthGuard } from '@/components/layout/auth-guard';
import { AppLayout } from '@/components/layout/app-layout';

import Login from '@/pages/login';
import RoomsPage from '@/pages/rooms';
import RoomChat from '@/pages/room-chat';
import ProfilePage from '@/pages/profile';
import LeavePage from '@/pages/leave';
import AdminDashboard from '@/pages/admin';
import PersonalAssistantPage from '@/pages/assistant';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public route — no auth guard */}
      <Route path="/login" component={Login} />

      {/* Admin dashboard — authenticated, own layout */}
      <Route path="/admin">
        <AuthGuard>
          <AdminDashboard />
        </AuthGuard>
      </Route>

      {/* All other routes — authenticated + app layout */}
      <Route>
        <AuthGuard>
          <AppLayout>
            <Switch>
              <Route path="/" component={PersonalAssistantPage} />
              <Route path="/assistant" component={PersonalAssistantPage} />
              <Route path="/rooms" component={RoomsPage} />
              <Route path="/rooms/:id" component={RoomChat} />
              <Route path="/leave" component={LeavePage} />
              <Route path="/profile" component={ProfilePage} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </AuthGuard>
      </Route>
    </Switch>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <Router />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
