/**
 * @file query-states.tsx
 * @description Reusable loading and error UI components for React Query-backed
 * data fetches throughout the application.
 *
 * Exports a set of purpose-built skeleton and error primitives that mirror the
 * visual structure of the real content they replace, so the layout does not
 * shift when data arrives. Each component is designed to slot directly into its
 * target context (table body, card grid, KPI row, etc.) without wrapper changes.
 *
 * Design goals:
 * - **Layout stability** – Skeletons match the approximate dimensions of the
 *   real content so there is no cumulative layout shift (CLS) when data arrives.
 * - **Contextual rendering** – Components know whether they live inside a
 *   `<table>` (must render `<tr><td>`) or a `<div>` (can render directly). The
 *   `asTableRow` prop on `QueryError` handles this dual-mode requirement.
 * - **Configurable quantity** – Each skeleton accepts a `rows`, `count`, or
 *   `fields` prop so callers control how many placeholders appear without
 *   copy-pasting JSX arrays.
 *
 * Exported components:
 *   - {@link QueryError}          – Inline error state with HTTP status and retry.
 *   - {@link TableBodySkeleton}   – Shimmer rows for `<tbody>` elements.
 *   - {@link CardSkeleton}        – Single card-shaped shimmer placeholder.
 *   - {@link CardGridSkeleton}    – Configurable grid of card skeletons.
 *   - {@link KpiSkeleton}         – Stat card skeleton for the dashboard KPI row.
 *   - {@link ListItemSkeleton}    – Avatar + text row skeletons for activity feeds.
 *   - {@link ProgressRowSkeleton} – Label + progress bar skeletons for coverage sections.
 *   - {@link FormSkeleton}        – Label + input field skeletons for settings forms.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to extract an HTTP status code from an unknown error value thrown by
 * a React Query fetch function. Checks the three most common shapes returned by
 * fetch-based API clients used in this project:
 *   - `error.status`           – Used by many REST clients and `fetch` wrappers.
 *   - `error.statusCode`       – Used by some Node/Express-style error objects.
 *   - `error.response.status`  – Used by Axios and similar libraries.
 *
 * Returns `null` (rather than a default) so callers can decide whether to show
 * "HTTP 404" or omit the code entirely for non-HTTP errors.
 *
 * @param error - The raw error value from React Query's `error` field.
 * @returns The numeric HTTP status code if found, or `null` otherwise.
 */
function getHttpStatus(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e['status'] === 'number') return e['status'];
    if (typeof e['statusCode'] === 'number') return e['statusCode'];
    // Check nested response object (Axios-style errors).
    const resp = e['response'];
    if (resp && typeof resp === 'object') {
      const r = resp as Record<string, unknown>;
      if (typeof r['status'] === 'number') return r['status'];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// QueryError — inline error state with retry button
// ---------------------------------------------------------------------------

/** Props for the {@link QueryError} component. */
interface QueryErrorProps {
  /** The error value from React Query's `isError` state (`query.error`). */
  error: unknown;
  /**
   * Callback to re-trigger the failed query.
   * Pass React Query's `refetch` function directly:
   * `<QueryError error={error} onRetry={refetch} />`
   */
  onRetry: () => void;
  /**
   * When `true`, wraps the error content in a `<tr><td>` so it can be
   * placed inside a `<tbody>` without breaking HTML table structure.
   * When `false` (default), renders a plain `<div>`.
   */
  asTableRow?: boolean;
  /**
   * Number of columns to span when rendered as a table row (`asTableRow` is
   * `true`). Defaults to `10`, which is wider than any table in the app so
   * the error content always spans the full width.
   */
  colSpan?: number;
  /** Additional Tailwind class names applied to the wrapping `<div>` (non-table mode). */
  className?: string;
}

/**
 * Inner error content shared between table-row and block rendering modes.
 * Displays an alert icon, a descriptive message (prefixed with the HTTP status
 * code when available), and a retry button.
 *
 * Separated from {@link QueryError} so the same JSX can be rendered inside
 * both `<td>` and `<div>` wrappers without duplication.
 *
 * @param props.error   - The raw error object to extract a message from.
 * @param props.onRetry - Callback wired to the "Retry" button click.
 */
function ErrorContent({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // Extract HTTP status for a more informative error message (e.g. "HTTP 404").
  const status = getHttpStatus(error);
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
      {/* Red circular icon badge matching the destructive colour token. */}
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Failed to load data</p>
        <p className="text-xs text-muted-foreground">
          {/* Prefix the message with the HTTP status code when available so
              developers and power users can diagnose the cause at a glance. */}
          {status ? `HTTP ${status} — ` : ''}
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>
      {/* Retry button: calls React Query's `refetch` to re-attempt the query. */}
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 mt-1">
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}

/**
 * Renders an error state that can be placed either as a full-width `<div>` block
 * or as a `<tr><td>` spanning all columns inside an existing table body.
 *
 * The dual-mode design is needed because HTML tables require `<tr>` descendants
 * inside `<tbody>` — a bare `<div>` would be invalid HTML and cause browser
 * rendering issues. Pass `asTableRow={true}` when inside a `<table>`.
 *
 * @param props - See {@link QueryErrorProps}.
 *
 * @example
 * // Block mode (card or page section):
 * <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
 *
 * @example
 * // Table row mode:
 * <QueryError error={error} onRetry={refetch} asTableRow colSpan={6} />
 */
export function QueryError({ error, onRetry, asTableRow, colSpan = 10, className }: QueryErrorProps) {
  if (asTableRow) {
    // Wrap in a <tr><td> so it sits inside <tbody> without breaking HTML
    // table structure. The <td> spans all columns so the error is centred.
    return (
      <tr>
        <td colSpan={colSpan}>
          <ErrorContent error={error} onRetry={onRetry} />
        </td>
      </tr>
    );
  }
  // Non-table mode: render a plain div wrapper with any additional classes.
  return (
    <div className={className}>
      <ErrorContent error={error} onRetry={onRetry} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table skeletons — dense shimmer rows matching existing table layouts
// ---------------------------------------------------------------------------

/** Props for the {@link TableBodySkeleton} component. */
interface TableSkeletonProps {
  /** Number of actual data columns in the table. Controls how many `<td>` elements per row. */
  columns: number;
  /** Number of skeleton rows to render. Defaults to 8. */
  rows?: number;
  /**
   * Override the per-row column count. Useful when a logical column uses a
   * `colSpan` (e.g. a title column that spans 2) and the visual count differs
   * from the semantic column count.
   */
  colSpan?: number;
}

/**
 * Renders a set of shimmer `<tr>` rows directly inside an existing `<tbody>`.
 * Uses React's `Array.from` with a `length` to create the correct number of
 * rows without storing them in state.
 *
 * Width variation:
 * The per-cell skeleton width varies between 60% and 90% of the `<td>` width
 * using the formula `60 + ((i + j) % 3) * 15`. This creates a visually
 * diverse pattern that prevents all skeletons from looking identical — mimicking
 * the natural variation in real data.
 *
 * @param props.columns - Number of columns (determines `<td>` count per row).
 * @param props.rows    - Number of skeleton rows. Defaults to `8`.
 * @param props.colSpan - Override column count when visual and semantic counts differ.
 */
export function TableBodySkeleton({ columns, rows = 8, colSpan }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border/50 last:border-0">
          {Array.from({ length: colSpan ?? columns }).map((_, j) => (
            <td key={j} className="py-3 px-4">
              {/* Width varies between 60%–90% using index arithmetic for visual variety.
                  Formula: 60 + ((row + col) % 3) * 15 → 60%, 75%, or 90% */}
              <Skeleton className="h-4 w-full" style={{ width: `${60 + ((i + j) % 3) * 15}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Card skeletons — shimmer placeholders that match card grid layouts
// ---------------------------------------------------------------------------

/**
 * A single card-shaped skeleton matching the visual structure of framework /
 * vendor / AOC cards: a header row with two items, a title bar, two body text
 * lines, and a footer detail row with two short items.
 *
 * The internal proportions (1/3, 2/3, full, 5/6, 1/4) are chosen to roughly
 * match the lengths of real card content so the transition from skeleton to
 * content is smooth with no layout shift.
 *
 * @param className - Optional additional Tailwind classes for the card wrapper
 *                    (e.g. to adjust spacing in a specific context).
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card shadow-sm p-6 space-y-4 ${className ?? ''}`}>
      {/* Header row: short label left, badge right */}
      <div className="flex justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-16" />
      </div>
      {/* Card title — wider than the header label */}
      <Skeleton className="h-6 w-2/3" />
      {/* Body text: two lines at full and 5/6 width */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      {/* Footer detail row: two short metadata items */}
      <div className="flex gap-4 pt-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}

/**
 * Renders a responsive grid of {@link CardSkeleton} placeholders.
 * Used as the loading state for the Frameworks, Vendors, and AOCs pages.
 *
 * Column layout:
 * - `cols === 2` → `grid-cols-1 xl:grid-cols-2` (AOCs page: 2-column on xl+)
 * - `cols === 3` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (default: 3-column)
 *
 * @param count - Total number of skeleton cards to render. Defaults to `3`.
 * @param cols  - Number of columns: `2` or `3`. Defaults to `3`.
 */
export function CardGridSkeleton({ count = 3, cols = 3 }: { count?: number; cols?: number }) {
  // Choose grid class based on the requested column count.
  const gridClass =
    cols === 2
      ? 'grid grid-cols-1 xl:grid-cols-2 gap-6'
      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI / stat-card skeleton (dashboard)
// ---------------------------------------------------------------------------

/**
 * Skeleton matching the visual structure of the dashboard KPI stat cards.
 * Each real KPI card has: a label + icon row, a large number, and a sub-label.
 * The skeleton mirrors those three zones with proportional widths.
 *
 * Used in a 4-column grid at the top of the Dashboard page while the
 * `useGetDashboardSummary` query is in its loading state.
 */
export function KpiSkeleton() {
  return (
    <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
      {/* Label row with small circular icon placeholder on the right */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-1/2" />
        {/* Small circular icon placeholder (matches the icon size in real cards) */}
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      {/* Large metric number — taller to reflect the `text-3xl font-bold` real value */}
      <Skeleton className="h-8 w-1/3" />
      {/* Sub-label text below the number */}
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// List-item skeleton (activity feed)
// ---------------------------------------------------------------------------

/**
 * Skeleton for activity feed / list items. Matches the structure of each row
 * in the Activity Log page and the "Recent Activity" card on the Dashboard:
 * a circular avatar on the left, a title line + sub-line in the centre, and a
 * short timestamp placeholder on the right.
 *
 * The `divide-y` wrapper mimics the `divide-y divide-border` class on the real
 * list so the transition from skeleton to content is seamless.
 *
 * @param rows - Number of skeleton list items to render. Defaults to `6`.
 */
export function ListItemSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-start gap-4">
          {/* Circular avatar placeholder — `rounded-full` matches the real avatar. */}
          <Skeleton className="h-9 w-9 rounded-full shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            {/* Main activity text line — 3/4 width for a natural truncation look. */}
            <Skeleton className="h-4 w-3/4" />
            {/* Sub-line (e.g. target chip) — narrower than the title. */}
            <Skeleton className="h-3 w-1/2" />
          </div>
          {/* Right-aligned timestamp placeholder — short fixed width. */}
          <Skeleton className="h-3 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress-bar row skeleton (dashboard coverage section)
// ---------------------------------------------------------------------------

/**
 * Skeleton for the PCI DSS control-coverage progress rows on the Dashboard.
 * Each real row has: a monospace requirement ID on the left, a requirement name
 * in the centre, a percentage value on the right, and a full-width progress bar
 * below. The skeleton mirrors all four zones.
 *
 * The default of 12 rows matches the 12 PCI DSS principal requirements
 * (REQ-1 through REQ-12) returned by the `useGetControlCoverage` API.
 *
 * @param rows - Number of skeleton rows to render. Defaults to `12`.
 */
export function ProgressRowSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            {/* Short requirement ID (e.g. "REQ-1") — narrow fixed width */}
            <Skeleton className="h-3 w-16" />
            {/* Requirement name — flexible width, grows between the ID and pct */}
            <Skeleton className="h-3 w-24 flex-1 mx-4" />
            {/* Percentage value — very short */}
            <Skeleton className="h-3 w-8" />
          </div>
          {/* Progress bar track — full width, rounded like the real Progress component */}
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form-field skeleton (settings page)
// ---------------------------------------------------------------------------

/**
 * Skeleton for form fields on the Settings page. Each "field" consists of a
 * label line (short, above) and an input-height bar (full-width, below),
 * matching the visual structure of `<label> + <Input>` pairs in the real form.
 *
 * Used as the loading state for the Entity Profile and PCI DSS Configuration
 * cards while `useGetEntity` is fetching the entity object.
 *
 * @param fields - Number of label+input pairs to render. Defaults to `4`.
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Field label — short, above the input */}
          <Skeleton className="h-4 w-24" />
          {/* Input field — full width, h-9 matches the Input component height */}
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
