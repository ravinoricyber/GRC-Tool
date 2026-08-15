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
 * Exported components:
 *   - {@link QueryError}         – Inline error state with HTTP status and retry.
 *   - {@link TableBodySkeleton}  – Shimmer rows for `<tbody>` elements.
 *   - {@link CardSkeleton}       – Single card-shaped shimmer placeholder.
 *   - {@link CardGridSkeleton}   – Configurable grid of card skeletons.
 *   - {@link KpiSkeleton}        – Stat card skeleton for the dashboard KPI row.
 *   - {@link ListItemSkeleton}   – Avatar + text row skeletons for activity feeds.
 *   - {@link ProgressRowSkeleton}– Label + progress bar skeletons for coverage sections.
 *   - {@link FormSkeleton}       – Label + input field skeletons for settings forms.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to extract an HTTP status code from an unknown error value.
 * Checks common shapes returned by fetch-based API clients:
 *   - `error.status`
 *   - `error.statusCode`
 *   - `error.response.status`
 *
 * @param error - The raw error value thrown by a React Query fetch.
 * @returns The numeric HTTP status code, or `null` if none was found.
 */
function getHttpStatus(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e['status'] === 'number') return e['status'];
    if (typeof e['statusCode'] === 'number') return e['statusCode'];
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

/** Props for {@link QueryError}. */
interface QueryErrorProps {
  /** The error value from React Query's `isError` state. */
  error: unknown;
  /** Callback to re-trigger the failed query (pass React Query's `refetch`). */
  onRetry: () => void;
  /** Wrap inside a table `<tbody>` row when true. */
  asTableRow?: boolean;
  /** Number of columns to span when rendered as a table row. Defaults to 10. */
  colSpan?: number;
  /** Additional class names applied to the wrapping `<div>` (non-table mode). */
  className?: string;
}

/**
 * Inner error content shared between table-row and block rendering modes.
 * Displays an alert icon, a descriptive message (including the HTTP status when
 * available), and a retry button.
 *
 * @param props - `error` to display and `onRetry` callback.
 */
function ErrorContent({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = getHttpStatus(error);
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Failed to load data</p>
        <p className="text-xs text-muted-foreground">
          {/* Prefix the message with the HTTP status code when available. */}
          {status ? `HTTP ${status} — ` : ''}
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 mt-1">
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}

/**
 * Renders an error state that can be placed either as a full-width `<div>` block
 * or as a `<tr><td>` inside an existing table body.
 *
 * @param props - See {@link QueryErrorProps}.
 *
 * @example
 * // Block mode (card or page section):
 * <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
 *
 * // Table row mode:
 * <QueryError error={error} onRetry={refetch} asTableRow colSpan={6} />
 */
export function QueryError({ error, onRetry, asTableRow, colSpan = 10, className }: QueryErrorProps) {
  if (asTableRow) {
    // Wrap in a <tr><td> so it sits inside <tbody> without breaking HTML structure.
    return (
      <tr>
        <td colSpan={colSpan}>
          <ErrorContent error={error} onRetry={onRetry} />
        </td>
      </tr>
    );
  }
  return (
    <div className={className}>
      <ErrorContent error={error} onRetry={onRetry} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table skeletons — dense shimmer rows matching existing table layouts
// ---------------------------------------------------------------------------

/** Props for {@link TableBodySkeleton}. */
interface TableSkeletonProps {
  /** Number of actual data columns in the table. */
  columns: number;
  /** Number of skeleton rows to render. Defaults to 8. */
  rows?: number;
  /** Override the per-row column count (e.g. when a column has a colSpan). */
  colSpan?: number;
}

/**
 * Renders a set of shimmer `<tr>` rows directly inside an existing `<tbody>`.
 * The skeleton cell widths vary pseudo-randomly so rows look naturally different.
 *
 * @param props - See {@link TableSkeletonProps}.
 */
export function TableBodySkeleton({ columns, rows = 8, colSpan }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border/50 last:border-0">
          {Array.from({ length: colSpan ?? columns }).map((_, j) => (
            <td key={j} className="py-3 px-4">
              {/* Width varies between 60%–90% using index arithmetic for visual variety. */}
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
 * A single card-shaped skeleton matching the structure of framework / vendor /
 * AOC cards: a header row, a title, body text lines, and a footer detail row.
 *
 * @param className - Optional additional class names for the card wrapper.
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card shadow-sm p-6 space-y-4 ${className ?? ''}`}>
      <div className="flex justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-4 pt-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}

/**
 * Renders a responsive grid of {@link CardSkeleton} placeholders.
 *
 * @param count - Total number of skeleton cards to render. Defaults to 3.
 * @param cols  - Number of columns: `2` (xl:2-up) or `3` (md:2-up, lg:3-up).
 *                Defaults to 3.
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
 * Skeleton matching the dashboard KPI cards: label row, large number, sub-label.
 * Used in the 4-column KPI grid at the top of the dashboard page.
 */
export function KpiSkeleton() {
  return (
    <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-1/2" />
        {/* Small circular icon placeholder */}
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      {/* Large metric number */}
      <Skeleton className="h-8 w-1/3" />
      {/* Sub-label text */}
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// List-item skeleton (activity feed)
// ---------------------------------------------------------------------------

/**
 * Skeleton for activity feed / list items: circular avatar, title line,
 * sub-line, and a right-aligned timestamp placeholder.
 *
 * @param rows - Number of skeleton list items to render. Defaults to 6.
 */
export function ListItemSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-start gap-4">
          {/* Circular avatar placeholder */}
          <Skeleton className="h-9 w-9 rounded-full shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {/* Timestamp placeholder */}
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
 * Skeleton for the control-coverage progress rows: requirement ID, name, and a
 * full-width progress bar for each PCI DSS requirement.
 *
 * @param rows - Number of skeleton rows to render. Defaults to 12 (matching the
 *               12 PCI DSS principal requirements).
 */
export function ProgressRowSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            {/* Requirement ID (short) */}
            <Skeleton className="h-3 w-16" />
            {/* Requirement name (flexible) */}
            <Skeleton className="h-3 w-24 flex-1 mx-4" />
            {/* Percentage value */}
            <Skeleton className="h-3 w-8" />
          </div>
          {/* Progress bar track */}
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
 * Skeleton for form fields: a label line above a full-width input-height bar.
 * Used on the settings page while entity details are being fetched.
 *
 * @param fields - Number of label+input pairs to render. Defaults to 4.
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Field label */}
          <Skeleton className="h-4 w-24" />
          {/* Input field */}
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
