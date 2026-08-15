/**
 * @file controls.tsx
 * @description Controls Library page (`/controls`).
 *
 * Fetches all compliance controls for the active entity via `useListControls`
 * and renders them in a dense, scrollable table. Controls are entity-scoped
 * because the finding status (in-place, not-tested, etc.) reflects each
 * business unit's specific implementation of the control.
 *
 * Table columns:
 *   Control Ref | Framework | Domain | Title + Description | Status (finding) | Actions
 *
 * UI features:
 *   - `h-[calc(100vh-8rem)]` viewport-height layout keeps the toolbar pinned
 *     above the table while only the table body scrolls. The `8rem` subtracts
 *     the Shell header height (3.5rem) plus the page header + toolbar (~4.5rem).
 *   - Sticky `<thead>` (`sticky top-0 z-10`) keeps column labels visible
 *     when scrolling through long control lists.
 *   - Row hover (`group-hover:opacity-100`) reveals the document icon button
 *     via opacity transition, reducing visual noise at rest.
 *   - Finding status is colour-coded via {@link getFindingColor} for immediate
 *     visual status recognition without reading the badge label.
 *   - Search input and Filters button are present as UI stubs (not yet wired).
 *   - CSV export button is a UI stub.
 *
 * Loading state: `TableBodySkeleton` (12 rows, 6 columns).
 * Error state:   `QueryError` rendered as a table row spanning 6 columns.
 * Empty state:   Single `<tr>` with a centred message.
 */

import React, { useState } from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListControls, getListControlsQueryKey } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Search, SlidersHorizontal, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryError, TableBodySkeleton } from '@/components/query-states';

/**
 * Controls Library page component.
 *
 * All data is scoped to `activeEntity`; switching the entity in the sidebar
 * triggers a fresh fetch (or cache hit) because `entityCode` is embedded in
 * the React Query cache key.
 *
 * @returns The Controls Library page JSX including the viewport-height table
 *          layout with sticky header, loading/error/data states.
 */
export default function Controls() {
  // Active entity from context — passed as `entityCode` to the API and query key.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch controls for the current entity.
   *
   * React Query wiring:
   * - `entityCode: activeEntity` scopes the API request.
   * - `queryKey: getListControlsQueryKey({ entityCode: activeEntity })` creates
   *   a key like `["listControls", { entityCode: "gopuff" }]`. Each entity's
   *   controls are cached independently, so switching back to a previously
   *   viewed entity shows the cached data instantly.
   */
  const { data: controls, isLoading, isError, error, refetch } = useListControls(
    { entityCode: activeEntity },
    { query: { queryKey: getListControlsQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Maps a control's finding value to Tailwind background + text colour classes
   * for the status badge. The colour system follows traffic-light conventions:
   *   - in-place       → emerald (green) — control is fully implemented.
   *   - not-applicable → slate (grey)    — control does not apply to this entity.
   *   - not-tested     → amber (yellow)  — control exists but hasn't been verified.
   *   - not-in-place   → destructive (red) — control is missing or failing.
   *   - null/other     → muted           — no finding assigned yet.
   *
   * @param finding - The control's finding string from the API, or null/undefined.
   * @returns A Tailwind utility class string for background and text colour.
   */
  const getFindingColor = (finding: string | null | undefined) => {
    switch(finding) {
      case 'in-place':       return 'bg-emerald-500 text-white';
      case 'not-applicable': return 'bg-slate-400 text-white';
      case 'not-tested':     return 'bg-amber-500 text-white';
      case 'not-in-place':   return 'bg-destructive text-white';
      // No finding assigned yet: subtle muted appearance to avoid false urgency.
      default:               return 'bg-muted text-muted-foreground border border-border';
    }
  };

  /**
   * Converts the hyphenated finding string to a human-readable display label
   * by replacing hyphens with spaces. Falls back to "unassigned" for null/undefined
   * values so the badge always contains meaningful text.
   *
   * Examples: `"not-in-place"` → `"not in place"`, `null` → `"unassigned"`.
   *
   * @param finding - Raw API finding string (e.g. `"not-in-place"`) or nullish.
   * @returns Display-friendly label string (e.g. `"not in place"`).
   */
  const formatFindingLabel = (finding: string | null | undefined) => {
    if (!finding) return 'unassigned';
    return finding.replace(/-/g, ' ');
  };

  return (
    // Viewport-height layout: the outer div fills the available height, with
    // `flex flex-col` allowing the table to take `flex-1` remaining space.
    // `8rem` accounts for the Shell top header + the page header + toolbar rows.
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Controls Library</h1>
          <p className="text-sm text-muted-foreground">Manage compliance controls, testing status, and findings.</p>
        </div>
        {/* CSV export — UI stub, no download handler wired yet. */}
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Search + Filter toolbar                                              */}
      {/* Both inputs are UI stubs — they render but have no event handlers.  */}
      {/* `shrink-0` prevents the toolbar from collapsing when the table is   */}
      {/* forced to flex-shrink in a tight viewport.                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by control ref or title..."
            className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {/* Filters button — UI stub. Would open a filter panel or popover. */}
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Controls Table                                                       */}
      {/* The outer div uses `overflow-hidden` to clip the inner scrollable   */}
      {/* div. The inner div is `overflow-auto flex-1` so only the table body */}
      {/* scrolls while the sticky header remains in place.                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-md border bg-card flex-1 overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left dense-table">
            {/* Sticky header: `sticky top-0 z-10` ensures it stays above
                the scrolling table body. `shadow-sm` adds a visual separation. */}
            <thead className="sticky top-0 bg-muted z-10 shadow-sm border-b border-border">
              <tr>
                <th className="w-32 py-3">Control Ref</th>
                <th className="w-24">Framework</th>
                <th className="w-32">Domain</th>
                <th>Title</th>
                <th className="w-36">Status</th>
                {/* Empty column header for the row-action icon button. */}
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {isLoading ? (
                /* 12 skeleton rows × 6 columns while the controls fetch is loading. */
                <TableBodySkeleton columns={6} rows={12} />
              ) : isError ? (
                /* Inline error state spanning all 6 columns with a retry button. */
                <QueryError error={error} onRetry={refetch} asTableRow colSpan={6} />
              ) : (
                <>
                  {controls?.map((control) => (
                    // `group` enables child elements to use `group-hover:*` utilities.
                    <tr key={control.id} className="group cursor-pointer hover:bg-muted/20 border-b border-border/50 last:border-0">
                      {/* Control reference (e.g. "PCI-1.1.1") in monospace for readability. */}
                      <td className="font-mono font-medium text-xs text-foreground whitespace-nowrap align-top py-3">
                        {control.ref}
                      </td>
                      {/* Framework code rendered as an outline badge for visual grouping. */}
                      <td className="align-top py-3">
                        <Badge variant="outline" className="font-mono text-[10px] bg-background shrink-0">
                          {control.frameworkCode}
                        </Badge>
                      </td>
                      {/* Domain: number prefix + first 15 chars + "..." to keep column narrow. */}
                      <td className="align-top py-3 text-muted-foreground text-xs">
                        {control.domainNumber}. {control.domain.substring(0, 15)}...
                      </td>
                      {/* Title (bold) + one-line description preview (muted, clamped).
                          Title turns primary colour on row hover via `group-hover:text-primary`. */}
                      <td className="align-top py-3">
                        <div className="font-medium mb-1 leading-snug group-hover:text-primary transition-colors">{control.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{control.description}</div>
                      </td>
                      {/* Finding status badge: fixed width (w-28) + centred text for
                          column alignment. Colour driven by getFindingColor(). */}
                      <td className="align-top py-3">
                        <Badge className={cn("text-[10px] uppercase font-bold tracking-wider border-transparent shadow-none w-28 justify-center", getFindingColor(control.finding))}>
                          {formatFindingLabel(control.finding)}
                        </Badge>
                      </td>
                      {/* Row action: document icon button, only visible on row hover via
                          `opacity-0 group-hover:opacity-100 transition-opacity`. */}
                      <td className="text-right align-top py-3">
                         <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                           <FileText className="h-4 w-4 text-muted-foreground" />
                         </Button>
                      </td>
                    </tr>
                  ))}
                  {/* Empty state: shown when the API returns an empty controls array
                      for this entity (e.g. a newly created entity with no controls). */}
                  {controls?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No controls found.
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
