/**
 * @file frameworks.tsx
 * @description Frameworks Library page (`/frameworks`).
 *
 * Fetches all compliance frameworks via `useListFrameworks` and renders them as
 * a responsive 3-column card grid. Frameworks are global (not entity-scoped)
 * because the same framework definitions (PCI DSS, SOC 2, ISO 27001, etc.)
 * apply across all business entities — only the control implementation and
 * evidence status differs per entity.
 *
 * Each card shows:
 *   - **Status badge** – "active" → default (blue), otherwise secondary.
 *   - **Priority badge** – "critical" → destructive, "high" → orange, others → secondary.
 *   - Framework name, framework code + version (monospace).
 *   - Summary text (truncated to 3 lines via `line-clamp-3`).
 *   - Domain count, owner, and next milestone date.
 *   - A "View Framework Details →" footer button.
 *
 * Loading state: `CardGridSkeleton` with 3 placeholder cards.
 * Error state:   `QueryError` block in the card grid area.
 * Empty state:   A dashed bordered message spanning all 3 columns.
 */

import React from 'react';
import { useListFrameworks, getListFrameworksQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Shield, BookOpen, Layers, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QueryError, CardGridSkeleton } from '@/components/query-states';

/**
 * Frameworks Library page component.
 *
 * Frameworks are not entity-scoped — the same library is shared across all
 * business entities. The query key produced by `getListFrameworksQueryKey()`
 * is therefore a simple `["listFrameworks"]` with no entity parameter, and the
 * result is cached for 30 seconds by the global `QueryClient` configuration.
 *
 * @returns The Frameworks Library page JSX including the page header and
 *          the loading/error/card-grid content area.
 */
export default function Frameworks() {
  /**
   * Fetch all frameworks from the API.
   *
   * React Query wiring:
   * - No entity filter is applied; the API returns all frameworks globally.
   * - `getListFrameworksQueryKey()` → `["listFrameworks"]`. Using the
   *   generated helper ensures this key is consistent with any cache
   *   invalidation calls in other parts of the codebase.
   * - The result is shared across all entities because the key contains no
   *   `entityCode`, so navigating between entities does not trigger a refetch.
   */
  const { data: frameworks, isLoading, isError, error, refetch } = useListFrameworks(
    { query: { queryKey: getListFrameworksQueryKey() } }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Frameworks Library</h1>
          <p className="text-sm text-muted-foreground">Manage active compliance frameworks and domain coverage.</p>
        </div>
        {/* "Add Framework" is a UI stub — no handler wired yet. */}
        <Button>Add Framework</Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content: skeleton / error / card grid                               */}
      {/* Three mutually exclusive render states determined by React Query's  */}
      {/* `isLoading` and `isError` flags.                                    */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        /* Show 3 card-shaped skeletons while the frameworks fetch is in flight.
           `cols={3}` → `md:grid-cols-2 lg:grid-cols-3` matches the real grid. */
        <CardGridSkeleton count={3} cols={3} />
      ) : isError ? (
        /* Fetch failed: show a centred error with a retry button. The `QueryError`
           block uses a card-style wrapper to match the page's visual language. */
        <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {frameworks?.map((fw) => (
            <Card key={fw.id} className="flex flex-col hover:border-primary/50 transition-colors shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  {/* Status badge:
                      - "active"   → `variant="default"` (blue)
                      - anything else → `variant="secondary"` (muted)
                      Uses `uppercase text-[10px] tracking-wider` for label styling. */}
                  <Badge variant={fw.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                    {fw.status}
                  </Badge>
                  {/* Priority badge:
                      - "critical" → `variant="destructive"` (red)
                      - "high"     → `variant="default"` but overridden with orange bg
                      - others     → `variant="secondary"` (muted)
                      Note: the `style` override on the Badge element is intentional —
                      Tailwind's bg-orange-500 class is applied via the `className` prop
                      but the variant prop still controls destructive/secondary behaviour. */}
                  <Badge variant={
                    fw.priority === 'critical' ? 'destructive' :
                    fw.priority === 'high' ? 'default' : 'secondary'
                  } className="bg-orange-500 hover:bg-orange-600 text-white border-transparent shadow-none" style={fw.priority === 'high' ? {} : undefined}>
                    {fw.priority}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{fw.name}</CardTitle>
                {/* Framework code + version in monospace for easy scanning.
                    Example: "PCI-DSS v4.0" */}
                <div className="font-mono text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                  <BookOpen className="h-3 w-3" />
                  {fw.code} v{fw.version}
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                {/* Summary truncated to 3 lines via Tailwind's `line-clamp-3` utility
                    so all cards remain the same height regardless of summary length. */}
                <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                  {fw.summary}
                </p>
                
                {/* Metadata grid: 2 columns for domains + owner, full width for milestone. */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Domains
                    </div>
                    {/* Domain count in monospace for consistent digit alignment. */}
                    <div className="font-medium font-mono">{fw.domainsCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Owner
                    </div>
                    {/* Fall back to "Unassigned" if no owner is set on this framework. */}
                    <div className="font-medium truncate">{fw.owner || 'Unassigned'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Next Milestone</div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {/* Format ISO date string to "MMMM d, yyyy" (e.g. "January 15, 2025")
                          or fall back to "None scheduled" when the field is null/empty. */}
                      {fw.nextMilestone ? format(new Date(fw.nextMilestone), 'MMMM d, yyyy') : 'None scheduled'}
                    </div>
                  </div>
                </div>
              </CardContent>
              {/* Card footer: single CTA button. Would navigate to a details page
                  in a full implementation. Uses HTML entity `→` for the arrow. */}
              <CardFooter className="border-t border-border/50 pt-4 bg-muted/10">
                <Button variant="ghost" size="sm" className="w-full text-primary hover:text-primary">
                  View Framework Details &rarr;
                </Button>
              </CardFooter>
            </Card>
          ))}
          {/* Empty state: shown when the API returns an empty array for frameworks.
              Spans all 3 grid columns so the message is centred across the full width. */}
          {frameworks?.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
              No frameworks found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
