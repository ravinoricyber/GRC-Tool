/**
 * @file policies.tsx
 * @description Policy Repository page (`/policies`).
 *
 * Fetches all governance and compliance policies for the active entity via
 * `useListPolicies` and renders them in a scrollable table.
 *
 * Table columns:
 *   ID | Name | Version | Status | Frameworks (badges) | Owner | Next Review | Actions
 *
 * UI features:
 *   - Status badge variant is mapped: current → custom green, review-due →
 *     secondary, overdue → destructive, otherwise outline.
 *   - Framework tags are rendered as individual monospace outline badges so
 *     auditors can see which frameworks a policy satisfies at a glance.
 *   - Next Review date is formatted to "MMM d, yyyy" using date-fns.
 *   - Row hover reveals a "FileEdit" icon button for inline editing.
 *
 * Loading state: `TableBodySkeleton` (8 rows, 8 columns).
 * Error state:   `QueryError` rendered as a table row.
 * Empty state:   Single row with centred message.
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
 * Policies are entity-scoped: each business unit maintains its own policy
 * documents and review schedule.
 */
export default function Policies() {
  // Read the active entity from context to scope the API request.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch all policies for the active entity.
   * `entityCode` is embedded in the query key so the cache is invalidated
   * automatically when the user switches entities.
   */
  const { data: policies, isLoading, isError, error, refetch } = useListPolicies(
    { entityCode: activeEntity },
    { query: { queryKey: getListPoliciesQueryKey({ entityCode: activeEntity }) } }
  );

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Policy Repository</h1>
          <p className="text-sm text-muted-foreground">Centralized documentation for governance and compliance.</p>
        </div>
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
            <thead className="sticky top-0 bg-muted/50 z-10 shadow-sm">
              <tr>
                <th className="w-24">ID</th>
                <th>Name</th>
                <th className="w-24">Version</th>
                <th className="w-32">Status</th>
                <th className="w-40">Frameworks</th>
                <th className="w-32">Owner</th>
                <th className="w-32">Next Review</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableBodySkeleton columns={8} rows={8} />
              ) : isError ? (
                <QueryError error={error} onRetry={refetch} asTableRow colSpan={8} />
              ) : (
                <>
                  {policies?.map((policy) => (
                    <tr key={policy.id} className="group cursor-pointer">
                      {/* Policy code in monospace for easy cross-referencing. */}
                      <td className="font-mono text-xs">{policy.code}</td>
                      {/* Name prefixed with a document icon. */}
                      <td className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {policy.name}
                      </td>
                      {/* Version string prefixed with "v" for convention. */}
                      <td className="font-mono text-xs">v{policy.version}</td>
                      {/* Status badge:                                            */}
                      {/* - "current"    → custom green tint via inline style     */}
                      {/* - "review-due" → secondary (yellow-ish)                 */}
                      {/* - "overdue"    → destructive (red)                      */}
                      {/* - other        → default outline                        */}
                      <td>
                        <Badge variant={
                          policy.status === 'current' ? 'default' :
                          policy.status === 'review-due' ? 'secondary' :
                          policy.status === 'overdue' ? 'destructive' : 'outline'
                        } className="uppercase text-[10px] tracking-wider bg-opacity-10" style={
                          // Override the "default" variant's blue for "current" with green.
                          policy.status === 'current' ? { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'rgb(16, 185, 129)', borderColor: 'rgba(16, 185, 129, 0.2)' } : undefined
                        }>
                          {/* Replace hyphens in status for display readability. */}
                          {policy.status.replace('-', ' ')}
                        </Badge>
                      </td>
                      {/* Framework tags — each framework the policy satisfies. */}
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {policy.frameworks?.map(fw => (
                             <Badge key={fw} variant="outline" className="text-[10px] font-mono py-0 px-1.5 bg-background">
                               {fw}
                             </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="text-muted-foreground">{policy.owner}</td>
                      {/* Format ISO review date to "MMM d, yyyy" or show dash. */}
                      <td className="font-mono text-xs text-muted-foreground">
                        {policy.reviewDate ? format(new Date(policy.reviewDate), 'MMM d, yyyy') : '-'}
                      </td>
                      {/* Row action: edit button revealed on hover. */}
                      <td className="text-right">
                         <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                           <FileEdit className="h-4 w-4 text-muted-foreground" />
                         </Button>
                      </td>
                    </tr>
                  ))}
                  {/* Empty state message when no policies are returned. */}
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
