/**
 * @file controls.tsx
 * @description Controls Library page (`/controls`).
 *
 * Fetches all compliance controls for the active entity via `useListControls`
 * and renders them in a dense, scrollable table. Controls are entity-scoped
 * because finding status (in-place, not-tested, etc.) varies per business unit.
 *
 * Table columns:
 *   Control Ref | Framework | Domain | Title + Description | Status (finding) | Actions
 *
 * UI features:
 *   - Sticky table header so column labels remain visible when scrolling.
 *   - Row hover reveals a "view document" icon button.
 *   - Finding status is colour-coded via `getFindingColor`.
 *   - Search input and Filters button are present as UI stubs (not yet wired).
 *   - CSV export button present as a UI stub.
 *
 * Loading state: `TableBodySkeleton` (12 rows, 6 columns).
 * Error state:   `QueryError` rendered as a table row spanning all columns.
 * Empty state:   Single row with centred message.
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
 * All data is scoped to `activeEntity`; switching the entity in the sidebar
 * triggers a fresh fetch because `entityCode` is embedded in the query key.
 */
export default function Controls() {
  // Active entity drives the entityCode parameter on the API request.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch controls for the current entity.
   * The explicit `queryKey` ensures React Query separates cache entries per
   * entity rather than sharing a single "all controls" bucket.
   */
  const { data: controls, isLoading, isError, error, refetch } = useListControls(
    { entityCode: activeEntity },
    { query: { queryKey: getListControlsQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Returns the appropriate Tailwind background+text classes for a control's
   * finding value.
   *
   * @param finding - The control's finding string from the API, or null/undefined.
   * @returns A string of Tailwind utility classes.
   */
  const getFindingColor = (finding: string | null | undefined) => {
    switch(finding) {
      case 'in-place':       return 'bg-emerald-500 text-white';
      case 'not-applicable': return 'bg-slate-400 text-white';
      case 'not-tested':     return 'bg-amber-500 text-white';
      case 'not-in-place':   return 'bg-destructive text-white';
      // No finding assigned yet: subtle muted appearance.
      default:               return 'bg-muted text-muted-foreground border border-border';
    }
  };

  /**
   * Converts the hyphenated finding string to a human-readable label by
   * replacing hyphens with spaces. Falls back to "unassigned" for nullish values.
   *
   * @param finding - Raw API finding string (e.g. `"not-in-place"`).
   * @returns Display label (e.g. `"not in place"`).
   */
  const formatFindingLabel = (finding: string | null | undefined) => {
    if (!finding) return 'unassigned';
    return finding.replace(/-/g, ' ');
  };

  return (
    // The outer div uses a calculated height so the table fills the viewport
    // without causing the page to scroll — only the table body scrolls.
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Controls Library</h1>
          <p className="text-sm text-muted-foreground">Manage compliance controls, testing status, and findings.</p>
        </div>
        {/* CSV export — UI stub, no handler wired. */}
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Search + Filter toolbar (UI stubs — logic not yet implemented)      */}
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
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Controls Table                                                       */}
      {/* The outer div is `overflow-hidden` so only the inner div scrolls.   */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-md border bg-card flex-1 overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left dense-table">
            {/* Sticky header stays visible as the user scrolls the table body. */}
            <thead className="sticky top-0 bg-muted z-10 shadow-sm border-b border-border">
              <tr>
                <th className="w-32 py-3">Control Ref</th>
                <th className="w-24">Framework</th>
                <th className="w-32">Domain</th>
                <th>Title</th>
                <th className="w-36">Status</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {isLoading ? (
                /* Show 12 shimmer rows while data loads. */
                <TableBodySkeleton columns={6} rows={12} />
              ) : isError ? (
                /* Inline error spanning all columns with a retry button. */
                <QueryError error={error} onRetry={refetch} asTableRow colSpan={6} />
              ) : (
                <>
                  {controls?.map((control) => (
                    <tr key={control.id} className="group cursor-pointer hover:bg-muted/20 border-b border-border/50 last:border-0">
                      {/* Monospace control reference (e.g. "PCI-1.1.1") */}
                      <td className="font-mono font-medium text-xs text-foreground whitespace-nowrap align-top py-3">
                        {control.ref}
                      </td>
                      {/* Framework code badge */}
                      <td className="align-top py-3">
                        <Badge variant="outline" className="font-mono text-[10px] bg-background shrink-0">
                          {control.frameworkCode}
                        </Badge>
                      </td>
                      {/* Domain number + truncated name */}
                      <td className="align-top py-3 text-muted-foreground text-xs">
                        {control.domainNumber}. {control.domain.substring(0, 15)}...
                      </td>
                      {/* Title + one-line description preview */}
                      <td className="align-top py-3">
                        <div className="font-medium mb-1 leading-snug group-hover:text-primary transition-colors">{control.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{control.description}</div>
                      </td>
                      {/* Finding status badge — colour driven by getFindingColor() */}
                      <td className="align-top py-3">
                        <Badge className={cn("text-[10px] uppercase font-bold tracking-wider border-transparent shadow-none w-28 justify-center", getFindingColor(control.finding))}>
                          {formatFindingLabel(control.finding)}
                        </Badge>
                      </td>
                      {/* Row action: revealed on hover via opacity transition */}
                      <td className="text-right align-top py-3">
                         <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                           <FileText className="h-4 w-4 text-muted-foreground" />
                         </Button>
                      </td>
                    </tr>
                  ))}
                  {/* Empty state when the API returns an empty controls array. */}
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
