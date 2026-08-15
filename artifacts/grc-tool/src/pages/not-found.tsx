/**
 * @file not-found.tsx
 * @description 404 Not Found page — catch-all route rendered by Wouter when no
 * other route in the `<Switch>` matches the current pathname.
 *
 * This component is registered as the last (default) route in App.tsx:
 * ```tsx
 * <Route component={NotFound} />  // No `path` prop = catch-all
 * ```
 * Wouter's `<Switch>` evaluates routes top-to-bottom and stops at the first
 * match. Because `NotFound` has no `path` prop it acts as a wildcard and only
 * activates when all preceding routes have failed to match.
 *
 * Visual design:
 * - A large `"404"` heading provides immediate visual recognition.
 * - A brief "Page not found" sub-heading gives context without cluttering the UI.
 * - A Wouter `<Link>` to `"/"` enables client-side navigation back to the
 *   Dashboard without a full browser reload. The `href="/"` is the root
 *   route which renders the Dashboard component.
 */

import { Link } from "wouter"

/**
 * Not Found (404) page component.
 *
 * Rendered as the default `<Route>` (no `path` prop) at the end of the Wouter
 * `<Switch>` in App.tsx so it only activates when all other routes have failed
 * to match the current URL pathname.
 *
 * The container uses `h-[80vh]` rather than `h-screen` so that the Shell's
 * persistent sidebar and header remain visible above the error message —
 * users can still navigate away via the sidebar without using the link below.
 *
 * @returns A centred 404 error UI with a return-to-dashboard link.
 */
export default function NotFound() {
  return (
    /* Centred layout: `flex flex-col items-center justify-center` vertically
       and horizontally centres all children. `h-[80vh]` ensures the content
       sits in the visible viewport without filling the entire screen height,
       leaving room for the Shell header at the top. */
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
      {/* Large numeric status code for immediate recognition — auditors and
          developers immediately understand "404" means page not found. */}
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="text-lg text-muted-foreground">Page not found</p>
      {/* Wouter's <Link> performs client-side navigation to the Dashboard
          route without a full page reload, preserving React state (e.g. the
          active entity selection) and avoiding an unnecessary server round-trip. */}
      <Link href="/" className="text-primary hover:underline mt-4">
        Return to Dashboard
      </Link>
    </div>
  )
}
