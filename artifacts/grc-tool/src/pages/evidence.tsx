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
import { EvidenceDetailSheet } from '@/components/evidence-detail-sheet';
import { CreateEvidenceDialog } from '@/components/create-evidence-dialog';

export default function Evidence() {
  const { activeEntity } = useEntity();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Omit `status` from query params when filter is null so the generated URL
  // builder does not append `status=null` (string) to the request, which would
  // return zero results instead of all statuses.
  const queryParams = statusFilter
    ? { entityCode: activeEntity, status: statusFilter }
    : { entityCode: activeEntity };

  const { data: evidenceList, isLoading, isError, error, refetch } = useListEvidence(
    queryParams,
    { query: { queryKey: getListEvidenceQueryKey(queryParams) } }
  );

  const statuses = ['requested', 'in-progress', 'submitted', 'approved', 'rejected'];

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
    <>
      <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">Evidence Queue</h1>
            <p className="text-sm text-muted-foreground">Manage and track compliance evidence requests.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Request Evidence</Button>
        </div>

        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            <Badge 
              variant="outline" 
              className={cn("cursor-pointer px-3 py-1", statusFilter === null ? "bg-secondary" : "hover:bg-secondary/50")}
              onClick={() => setStatusFilter(null)}
            >
              All
            </Badge>
            {statuses.map(status => (
              <Badge 
                key={status}
                variant="outline" 
                className={cn("cursor-pointer px-3 py-1 capitalize", statusFilter === status ? "bg-secondary" : "hover:bg-secondary/50")}
                onClick={() => setStatusFilter(status)}
              >
                {status.replace('-', ' ')}
              </Badge>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Filter className="h-3.5 w-3.5" /> Filter
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Sort
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-card flex-1 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm text-left dense-table">
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
                  <TableBodySkeleton columns={8} rows={10} />
                ) : isError ? (
                  <QueryError error={error} onRetry={refetch} asTableRow colSpan={8} />
                ) : (
                  <>
                    {evidenceList?.map((req) => (
                      <tr
                        key={req.id}
                        className="group cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setSelectedId(req.id)}
                      >
                        <td className="font-mono text-xs">{req.code}</td>
                        <td className="font-mono text-xs">{req.controlRef}</td>
                        <td>
                          <Badge variant="outline" className="font-mono text-[10px] bg-background">
                            {req.frameworkCode}
                          </Badge>
                        </td>
                        <td className="font-medium group-hover:text-primary transition-colors">
                          {req.title}
                        </td>
                        <td className="text-muted-foreground">{req.assignee || 'Unassigned'}</td>
                        <td>
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", getPriorityColor(req.priority))}>
                            {req.priority}
                          </span>
                        </td>
                        <td className={cn(
                          "font-mono text-xs", 
                          req.dueDate && new Date(req.dueDate) < new Date() && req.status !== 'approved' && req.status !== 'submitted' 
                            ? "text-destructive font-bold flex items-center gap-1.5" 
                            : ""
                        )}>
                          {req.dueDate && new Date(req.dueDate) < new Date() && req.status !== 'approved' && req.status !== 'submitted' && (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {req.dueDate ? format(new Date(req.dueDate), 'MMM d, yyyy') : '-'}
                        </td>
                        <td>
                          <Badge className={cn("text-[10px] uppercase font-bold tracking-wider text-white border-transparent", getStatusColor(req.status))}>
                            {req.status.replace('-', ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
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

      <EvidenceDetailSheet
        evidenceId={selectedId}
        onClose={() => setSelectedId(null)}
      />

      <CreateEvidenceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}
