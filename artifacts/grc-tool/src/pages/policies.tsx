/**
 * @file policies.tsx
 * @description Policy Repository page (`/policies`).
 *
 * Fetches all governance and compliance policies for the active entity via
 * `useListPolicies` and renders them in a scrollable table. Policies are
 * entity-scoped because each business unit maintains its own document library
 * and review schedule.
 *
 * Table columns:
 *   ID | Name | Version | Status | Frameworks (badges) | Owner | Next Review | Actions
 *
 * UI features:
 *   - **Status badge variant mapping**:
 *       "current"    → `variant="default"` with an inline green style override
 *       "review-due" → `variant="secondary"` (amber/yellow)
 *       "overdue"    → `variant="destructive"` (red)
 *       other        → `variant="outline"` (neutral)
 *     The inline `style` override on "current" is needed because the default
 *     badge variant uses the primary (blue) colour, but "current" should be
 *     green to signal a healthy state.
 *   - **Framework tags**: each framework code the policy satisfies is rendered
 *     as a small monospace outline badge so auditors can see at a glance which
 *     frameworks a policy covers.
 *   - **Review date**: formatted to "MMM d, yyyy" using `date-fns format`.
 *     Shows a dash when `reviewDate` is null/undefined.
 *   - **Row hover**: reveals a `FileEdit` icon button via opacity transition.
 *
 * Loading state: `TableBodySkeleton` (8 rows, 8 columns).
 * Error state:   `QueryError` rendered as a table row.
 * Empty state:   Single row with a centred message.
 */

import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListPolicies, getListPoliciesQueryKey } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Plus, FileEdit } from 'lucide-react';
import { QueryError, TableBodySkeleton } from '@/components/query-states';

/**
 * Policy Repository page component.
 *
 * Policies are entity-scoped: each business unit maintains its own set of
 * governance documents and review cycles. The `entityCode` is embedded in the
 * React Query cache key so switching entities fetches the correct policy set.
 *
 * @returns The Policy Repository page JSX including the viewport-height table
 *          layout, loading/error/data states.
 */
export default function Policies() {
  // Read the active entity from context to scope the API request.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch all policies for the active entity.
   *
   * React Query wiring:
   * - `entityCode: activeEntity` scopes the API response to the current entity.
   * - `queryKey: getListPoliciesQueryKey({ entityCode: activeEntity })` → key
   *   like `["listPolicies", { entityCode: "gopuff" }]`. Entity-specific caching
   *   ensures switching entities invalidates the current cache slot.
   */
  const { data: policies, isLoading, isError, error, refetch } = useListPolicies(
    { entityCode: activeEntity },
    { query: { queryKey: getListPoliciesQueryKey({ entityCode: activeEntity }) } }
  );

  return (
    // Viewport-height layout with internal scroll (same pattern as Controls page).
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Policy Repository</h1>
          <p className="text-sm text-muted-foreground">Centralized documentation for governance and compliance.</p>
        </div>
        {/* "New Policy" is a UI stub — no creation handler wired yet. */}
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Policy
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Policies Table                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-md border bg-card flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left dense-table">
            {/* Sticky header for long policy lists. */}
            <thead className="sticky top-0 bg-muted/50 z-10 shadow-sm">
              <tr>
                <th className="w-24">ID</th>
                <th>Name</th>
                <th className="w-24">Version</th>
                <th className="w-32">Status</th>
                <th className="w-40">Frameworks</th>
                <th className="w-32">Owner</th>
                <th className="w-32">Next Review</th>
                {/* Empty column for the row-action button. */}
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                /* 8 skeleton rows × 8 columns while the policies fetch is loading. */
                <TableBodySkeleton columns={8} rows={8} />
              ) : isError ? (
                /* Table-row error state spanning all 8 columns. */
                <QueryError error={error} onRetry={refetch} asTableRow colSpan={8} />
              ) : (
                <>
                  {policies?.map((policy) => (
                    // `group` enables `group-hover:*` on child elements.
                    <tr key={policy.id} className="group cursor-pointer">
                      {/* Policy code (e.g. "POL-001") in monospace. */}
                      <td className="font-mono text-xs">{policy.code}</td>
                      {/* Policy name prefixed with a document icon for visual anchoring. */}
                      <td className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {policy.name}
                      </td>
                      {/* Version prefixed with "v" convention (e.g. "v2.1"). */}
                      <td className="font-mono text-xs">v{policy.version}</td>
                      {/* Status badge with variant + optional inline style override:
                          - "current"    → default variant BUT green via inline style
                              (the default variant would be blue without the override)
                          - "review-due" → secondary (muted yellow/grey)
                          - "overdue"    → destructive (red)
                          - other        → outline (neutral border, no background) */}
                      <td>
                        <Badge variant={
                          policy.status === 'current' ? 'default' :
                          policy.status === 'review-due' ? 'secondary' :
                          policy.status === 'overdue' ? 'destructive' : 'outline'
                        } className="uppercase text-[10px] tracking-wider bg-opacity-10" style={
                          // Override the default variant's primary blue with emerald green
                          // for the "current" state to signal a healthy, valid policy.
                          policy.status === 'current' ? { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'rgb(16, 185, 129)', borderColor: 'rgba(16, 185, 129, 0.2)' } : undefined
                        }>
                          {/* Replace hyphen with space for display (e.g. "review-due" → "review due"). */}
                          {policy.status.replace('-', ' ')}
                        </Badge>
                      </td>
                      {/* Framework tags: iterate `policy.frameworks` array (e.g. ["PCI-DSS", "SOC2"]).
                          Each framework code rendered as a small monospace outline badge. */}
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {policy.frameworks?.map(fw => (
                             <Badge key={fw} variant="outline" className="text-[10px] font-mono py-0 px-1.5 bg-background">
                               {fw}
                             </Badge>
                          ))}
                        </div>
                      </td>
                      {/* Policy owner name in muted text. */}
                      <td className="text-muted-foreground">{policy.owner}</td>
                      {/* Next review date: formatted to "MMM d, yyyy" or "-" when absent. */}
                      <td className="font-mono text-xs text-muted-foreground">
                        {policy.reviewDate ? format(new Date(policy.reviewDate), 'MMM d, yyyy') : '-'}
                      </td>
                      {/* Row action: edit icon revealed on hover via opacity transition. */}
                      <td className="text-right">
                         <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                           <FileEdit className="h-4 w-4 text-muted-foreground" />
                         </Button>
                      </td>
                    </tr>
                  ))}
                  {/* Empty state: shown when the entity has no policies configured. */}
                  {policies?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground">
                        No policies found.
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
