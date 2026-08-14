import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EntityProvider } from '@/context/EntityContext';
import { Shell } from '@/components/layout/Shell';

import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';
import Frameworks from '@/pages/frameworks';
import Evidence from '@/pages/evidence';
import Policies from '@/pages/policies';
import Aocs from '@/pages/aocs';
import Assessments from '@/pages/assessments';
import Controls from '@/pages/controls';
import Vendors from '@/pages/vendors';
import Activity from '@/pages/activity';
import Settings from '@/pages/settings';

import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/frameworks" component={Frameworks} />
          <Route path="/evidence" component={Evidence} />
          <Route path="/policies" component={Policies} />
          <Route path="/aocs" component={Aocs} />
          <Route path="/assessments" component={Assessments} />
          <Route path="/controls" component={Controls} />
          <Route path="/vendors" component={Vendors} />
          <Route path="/activity" component={Activity} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EntityProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </EntityProvider>
    </QueryClientProvider>
  );
}

export default App;