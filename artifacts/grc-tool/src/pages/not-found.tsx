/**
 * @file not-found.tsx
 * @description 404 Not Found page — catch-all route rendered by Wouter when no
 * other route in the `<Switch>` matches the current pathname.
 *
 * Displays a centred "404" heading, a brief descriptive message, and a link
 * that returns the user to the Dashboard (`/`).
 */

import { Link } from "wouter"

/**
 * Not Found page component.
 * Rendered as the default `<Route>` (no `path` prop) at the end of the Wouter
 * `<Switch>` in App.tsx, so it only activates when all other routes have failed
 * to match.
 */
export default function NotFound() {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
      {/* Large numeric status code for immediate recognition. */}
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="text-lg text-muted-foreground">Page not found</p>
      {/* Wouter's <Link> navigates client-side without a full page reload. */}
      <Link href="/" className="text-primary hover:underline mt-4">
        Return to Dashboard
      </Link>
    </div>
  )
}
