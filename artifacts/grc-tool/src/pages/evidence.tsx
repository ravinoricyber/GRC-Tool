/**
 * @file evidence.tsx
 * @description Evidence Queue page (`/evidence`).
 *
 * Fetches compliance evidence requests for the active entity and renders them
 * in a filterable, scrollable table. Evidence is entity-scoped because each
 * business unit tracks its own audit evidence requests independently.
 *
 * Table columns:
 *   ID | Control Ref | Framework | Title | Assignee | Priority | Due Date | Status
 *
 * UI features:
 *   - **Status filter pills** above the table. Clicking a pill sets the
 *     `statusFilter` state which is passed to the API query so filtering is
 *     performed server-side. The "All" pill sets `statusFilter` to `null`.
 *     Each `(entityCode, status)` combination occupies a separate React Query
 *     cache entry so switching between filters uses cached data when available.
 *   - **Overdue due date styling**: a request is overdue when `dueDate` is in
 *     the past AND `status` is neither `"approved"` nor `"submitted"` (those
 *     are terminal/complete states). Overdue dates are shown in `text-destructive`
 *     bold with an `AlertCircle` icon prepended for immediate visual attention.
 *   - **Filter and Sort buttons** are UI stubs (not yet wired to handlers).
 *
 * Loading state: `TableBodySkeleton` (10 rows, 8 columns).
 * Error state:   `QueryError` rendered as a table row spanning 8 columns.
 * Empty state:   Single row with a centred message.
 */

import React, { useState } from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListEvidence, getListEvidenceQueryKey } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryError, TableBodySkeleton } from '@/components/query-states';

/**
 * Evidence Queue page component.
 *
 * Status filtering is performed server-side: the selected `statusFilter` value
 * is passed directly to the API request. React Query maintains a separate cache
 * entry for each `(entityCode, status)` combination, so switching between
 * filters with previously viewed data is instant (serves from cache until stale).
 *
 * @returns The Evidence Queue page JSX including filter pills, table, and
 *          loading/error/data states.
 */
export default function Evidence() {
  // Active entity from context — scopes all API requests on this page.
  const { activeEntity } = useEntity();

  /**
   * Currently selected status filter value.
   *
   * `null` means "all statuses" — no filter parameter is sent to the API.
   * A string value (e.g. `"requested"`) narrows the response to that status.
   *
   * State change: clicking a filter pill calls `setStatusFilter(value)` which
   * triggers a new React Query fetch (or cache hit) because `status` is part
   * of the query key via `getListEvidenceQueryKey`.
   */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  /**
   * Fetch evidence requests, optionally filtered by status.
   *
   * React Query wiring:
   * - Both `entityCode` and `status` are included in the query key so each
   *   unique `(entity, status)` combination has its own cache slot.
   * - `status: statusFilter` — passes the current filter value; React Query
   *   automatically refetches when this value changes.
   * - `data: evidenceList` defaults to `undefined`; safe to use with optional
   *   chaining (`evidenceList?.map`).
   */
  const { data: evidenceList, isLoading, isError, error, refetch } = useListEvidence(
    { entityCode: activeEntity, status: statusFilter },
    { query: { queryKey: getListEvidenceQueryKey({ entityCode: activeEntity, status: statusFilter }) } }
  );

  /**
   * All possible evidence status values, ordered by workflow progression.
   * Used to render the filter pill row above the table.
   */
  const statuses = ['requested', 'in-progress', 'submitted', 'approved', 'rejected'];

  /**
   * Maps an evidence request status string to Tailwind background colour classes
   * for the status badge in each table row. Follows a consistent colour convention:
   *   - requested   → slate (neutral / new)
   *   - in-progress → blue (active work)
   *   - submitted   → violet (awaiting review)
   *   - approved    → emerald (complete / green)
   *   - rejected    → red (action required)
   *
   * @param status - The evidence request status string from the API.
   * @returns Tailwind bg and hover-bg utility class string.
   */
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'requested':   return 'bg-slate-500 hover:bg-slate-600';
      case 'in-progress': return 'bg-blue-500 hover:bg-blue-600';
      case 'submitted':   return 'bg-violet-500 hover:bg-violet-600';
      case 'approved':    return 'bg-emerald-500 hover:bg-emerald-600';
      case 'rejected':    return 'bg-red-500 hover:bg-red-600';
      default:            return 'bg-slate-500';
    }
  };

  /**
   * Maps a priority level string to Tailwind text, background, and border colour
   * classes for the inline priority chip in each table row. Uses tinted chip
   * styling (bg-{colour}/10 + border-{colour}-200) to keep the table light.
   *
   * @param priority - The evidence request priority string from the API.
   * @returns Tailwind text/bg/border utility class string.
   */
  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-200';
      case 'high':     return 'text-orange-500 bg-orange-500/10 border-orange-200';
      case 'medium':   return 'text-amber-500 bg-amber-500/10 border-amber-200';
      case 'low':      return 'text-slate-500 bg-slate-500/10 border-slate-200';
      default:         return 'text-slate-500';
    }
  };

  return (
    // Viewport-height layout: `h-[calc(100vh-8rem)]` keeps the toolbar visible
    // while only the table body scrolls. `flex flex-col` allows `flex-1` on the table.
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Evidence Queue</h1>
          <p className="text-sm text-muted-foreground">Manage and track compliance evidence requests.</p>
        </div>
        {/* "Request Evidence" is a UI stub — no handler wired. */}
        <Button>Request Evidence</Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Status filter pills + action buttons                                 */}
      {/* `overflow-x-auto hide-scrollbar` allows the pill row to scroll      */}
      {/* horizontally on narrow viewports without showing a scrollbar.       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {/* "All" pill: clears the status filter by setting it to null.
              Active state (`statusFilter === null`) uses `bg-secondary` background. */}
          <Badge 
            variant="outline" 
            className={cn("cursor-pointer px-3 py-1", statusFilter === null ? "bg-secondary" : "hover:bg-secondary/50")}
            onClick={() => setStatusFilter(null)}
          >
            All
          </Badge>
          {/* One pill per status value. Clicking calls setStatusFilter(status)
              which updates the React Query key and triggers a refetch/cache-hit. */}
          {statuses.map(status => (
            <Badge 
              key={status}
              variant="outline" 
              className={cn("cursor-pointer px-3 py-1 capitalize", statusFilter === status ? "bg-secondary" : "hover:bg-secondary/50")}
              onClick={() => setStatusFilter(status)}
            >
              {/* Display value: replace hyphens with spaces (e.g. "in-progress" → "in progress"). */}
              {status.replace('-', ' ')}
            </Badge>
          ))}
        </div>
        
        {/* Filter / Sort action buttons — UI stubs, no handlers wired. */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Filter className="h-3.5 w-3.5" /> Filter
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Sort
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Evidence Table                                                       */}
      {/* `overflow-hidden` clips the scrollable inner div.                   */}
      {/* Sticky `<thead>` remains visible while the body scrolls.            */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-md border bg-card flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left dense-table">
            {/* Sticky header so column labels are always visible on long lists. */}
            <thead className="sticky top-0 bg-muted/50 z-10 shadow-sm">
              <tr>
                <th className="w-24">ID</th>
                <th className="w-28">Control Ref</th>
                <th className="w-32">Framework</th>
                <th>Title</th>
                <th className="w-32">Assignee</th>
                <th className="w-24">Priority</th>
                <th className="w-32">Due Date</th>
                <th className="w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                /* 10 skeleton rows × 8 columns while the evidence fetch loads. */
                <TableBodySkeleton columns={8} rows={10} />
              ) : isError ? (
                /* Table-row error state spanning all 8 columns with retry button. */
                <QueryError error={error} onRetry={refetch} asTableRow colSpan={8} />
              ) : (
                <>
                  {evidenceList?.map((req) => (
                    // `group` enables child hover effects (e.g. title colour change).
                    <tr key={req.id} className="group cursor-pointer">
                      {/* Evidence request code (e.g. "EV-001") in monospace. */}
                      <td className="font-mono text-xs">{req.code}</td>
                      {/* Control reference this evidence request maps to. */}
                      <td className="font-mono text-xs">{req.controlRef}</td>
                      <td>
                        {/* Framework code in an outline badge for consistent styling. */}
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                          {req.frameworkCode}
                        </Badge>
                      </td>
                      {/* Title highlighted on row hover via `group-hover:text-primary`. */}
                      <td className="font-medium group-hover:text-primary transition-colors">
                        {req.title}
                      </td>
                      {/* Assignee or "Unassigned" fallback. */}
                      <td className="text-muted-foreground">{req.assignee || 'Unassigned'}</td>
                      <td>
                        {/* Priority chip: border + tinted background pattern for readability.
                            Uses `getPriorityColor` for the specific colour combination. */}
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", getPriorityColor(req.priority))}>
                          {req.priority}
                        </span>
                      </td>
                      {/* Due Date cell: conditional overdue styling.
                          A request is overdue when ALL of:
                          1. `req.dueDate` is not null/undefined.
                          2. The due date is in the past (`new Date(req.dueDate) < new Date()`).
                          3. The status is not "approved" or "submitted" — those are terminal
                             states that indicate the request is complete regardless of date.
                          Overdue cells get `text-destructive font-bold` + an `AlertCircle` icon. */}
                      <td className={cn(
                        "font-mono text-xs", 
                        req.dueDate && new Date(req.dueDate) < new Date() && req.status !== 'approved' && req.status !== 'submitted' 
                          ? "text-destructive font-bold flex items-center gap-1.5" 
                          : ""
                      )}>
                        {/* Only render the alert icon when the request is overdue. */}
                        {req.dueDate && new Date(req.dueDate) < new Date() && req.status !== 'approved' && req.status !== 'submitted' && (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {/* Format ISO date string to "MMM d, yyyy" (e.g. "Jan 5, 2025")
                            or show a dash placeholder when the field is absent. */}
                        {req.dueDate ? format(new Date(req.dueDate), 'MMM d, yyyy') : '-'}
                      </td>
                      {/* Status badge: solid colour background, white text.
                          Colour driven by `getStatusColor(req.status)`. */}
                      <td>
                        <Badge className={cn("text-[10px] uppercase font-bold tracking-wider text-white border-transparent", getStatusColor(req.status))}>
                          {/* Replace hyphen in status for display (e.g. "in-progress" → "in progress"). */}
                          {req.status.replace('-', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {/* Empty state: no requests match the active status filter
                      (or the entity genuinely has no evidence requests yet). */}
                  {evidenceList?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground">
                        No evidence requests found.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
