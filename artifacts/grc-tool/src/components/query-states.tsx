import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

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

interface QueryErrorProps {
  error: unknown;
  onRetry: () => void;
  /** Wrap inside a table <tbody> row when true */
  asTableRow?: boolean;
  colSpan?: number;
  className?: string;
}

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

export function QueryError({ error, onRetry, asTableRow, colSpan = 10, className }: QueryErrorProps) {
  if (asTableRow) {
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

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  colSpan?: number;
}

/** Renders skeleton rows inside an existing <tbody>. */
export function TableBodySkeleton({ columns, rows = 8, colSpan }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border/50 last:border-0">
          {Array.from({ length: colSpan ?? columns }).map((_, j) => (
            <td key={j} className="py-3 px-4">
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

/** A single card-shaped skeleton. */
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

/** A grid of card skeletons. */
export function CardGridSkeleton({ count = 3, cols = 3 }: { count?: number; cols?: number }) {
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

export function KpiSkeleton() {
  return (
    <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// List-item skeleton (activity feed)
// ---------------------------------------------------------------------------

export function ListItemSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-start gap-4">
          <Skeleton className="h-9 w-9 rounded-full shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress-bar row skeleton (dashboard coverage section)
// ---------------------------------------------------------------------------

export function ProgressRowSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24 flex-1 mx-4" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form-field skeleton (settings page)
// ---------------------------------------------------------------------------

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
