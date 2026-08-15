/**
 * @file App.tsx
 * @description Root application component. Establishes all global providers and
 * the client-side routing configuration.
 *
 * Provider hierarchy (outermost → innermost):
 *   QueryClientProvider  – React Query cache shared across all pages
 *   EntityProvider       – Active business-entity selection (Gopuff, BevMo!, …)
 *   TooltipProvider      – Radix UI tooltip context
 *   WouterRouter         – Hash-free client-side router, base path from Vite env
 *     Shell              – Persistent sidebar + header layout
 *       RoutedErrorBoundary – Per-route error isolation; resets on navigation
 *         Switch / Route – Page-level code-split routes
 *   Toaster              – Global toast notification container
 */

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

/**
 * Shared React Query client instance.
 * - `retry: 1`        – Retry failed requests once before surfacing an error.
 * - `staleTime: 30s`  – Cache responses for 30 seconds to avoid redundant
 *                       refetches when navigating between pages.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/**
 * Declares all first-level application routes inside the persistent Shell layout.
 * The catch-all `<Route component={NotFound} />` must be last so Wouter only
 * renders it when no other route matched.
 */
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
          {/* Catch-all: renders when no route above matches */}
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

/**
 * Wraps the routed subtree in an {@link ErrorBoundary} that automatically resets
 * whenever the active route changes. This ensures a page-level crash does not
 * permanently block navigation — moving to a different route clears the error.
 *
 * @param children - The routed page components to protect.
 */
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  // useLocation returns the current pathname; passing it as resetKey means the
  // boundary resets its error state on every route transition.
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

/**
 * Top-level application component exported as the default export.
 * Composes all global providers and injects the router.
 *
 * The `BASE_URL` trailing slash is stripped so that Wouter's base-path matching
 * works correctly in both the root (`/`) and nested (`/app/`) deployments.
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EntityProvider>
        <TooltipProvider>
          {/* Strip trailing slash from Vite's BASE_URL to keep Wouter happy */}
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          {/* Toaster lives outside Router so toasts survive route transitions */}
          <Toaster />
        </TooltipProvider>
      </EntityProvider>
    </QueryClientProvider>
  );
}

export default App;
