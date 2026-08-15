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
 *
 * Design decisions:
 * - The `QueryClient` is created at module level (outside the component) so it
 *   is only instantiated once per application lifecycle, not once per render.
 * - The `Toaster` lives outside the `Router` so that toast notifications
 *   triggered during a route transition are not unmounted mid-display.
 * - `RoutedErrorBoundary` uses Wouter's `useLocation` as a `resetKey` so that
 *   moving to a different route automatically clears any active page error.
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
 *
 * Configured with application-wide defaults:
 * - `retry: 1`       – Retry failed requests once before surfacing an error.
 *                      Avoids hammering a flaky API while still recovering from
 *                      transient network blips.
 * - `staleTime: 30s` – Treat cached responses as fresh for 30 seconds. This
 *                      prevents redundant refetches when navigating between
 *                      pages within the same session while still re-fetching
 *                      stale data on focus or remount after 30 s.
 *
 * The instance is created at module scope so it is shared across all renders
 * and never re-created when React re-renders the `App` component.
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
 *
 * Route order matters in Wouter's `<Switch>`: routes are matched top-to-bottom
 * and only the first match renders. The catch-all `<Route component={NotFound} />`
 * must therefore be last so Wouter only renders it when no other route matched.
 *
 * Every `<Route>` receives a `component` prop (lazy page component) rather than
 * a JSX `children` prop so Wouter can tree-shake unused components in production.
 *
 * @returns The Shell wrapper containing the route switcher.
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
 * Implementation detail: `useLocation` returns the current pathname string.
 * Passing it as `resetKey` to the boundary means that any change to the
 * pathname (i.e. any navigation event) causes `componentDidUpdate` in the
 * boundary to detect the changed key and call `resetError()`.
 *
 * @param children - The routed page components to protect. Must be a valid
 *                   React node tree; crashes in this subtree are caught.
 * @returns The `children` wrapped in an auto-resetting error boundary.
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
 * Provider nesting rationale:
 * - `QueryClientProvider` is outermost so every component in the tree can call
 *   React Query hooks.
 * - `EntityProvider` is inside Query so entity-aware queries can be composed
 *   with query hooks without circular dependencies.
 * - `TooltipProvider` wraps the router so tooltips in the Shell (e.g. the
 *   entity error tooltip) and in page components all share the same Radix
 *   tooltip root.
 * - `Toaster` is a sibling of the router rather than nested inside it, so
 *   toast notifications survive route transitions without being unmounted.
 *
 * The `BASE_URL` trailing slash is stripped so that Wouter's base-path matching
 * works correctly in both the root (`/`) and nested (`/app/`) deployments.
 *
 * @returns The fully configured React application tree ready for mount.
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
