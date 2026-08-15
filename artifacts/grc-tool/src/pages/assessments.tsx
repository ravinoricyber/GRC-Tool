/**
 * @file assessments.tsx
 * @description Assessment Engagements page (`/assessments`).
 *
 * Fetches all audit / assessment engagements for the active entity via
 * `useListAssessments` and renders them as a vertical list of status-coded cards.
 *
 * Each card displays:
 *   - A left-edge colour strip indicating the assessment phase (planning /
 *     fieldwork / reporting / closed).
 *   - A phase icon returned by `getStatusIcon`.
 *   - Assessment name, framework code, QSA company, and lead assessor.
 *   - Planned start → end timeline formatted to "MMM yyyy".
 *   - Status badge.
 *
 * Loading state: Inline skeleton (3 rows) matching the card strip layout.
 * Error state:   `QueryError` block.
 * Empty state:   Dashed bordered message.
 */

import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListAssessments, getListAssessmentsQueryKey } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlayCircle, CheckCircle2, CircleDashed, ClipboardEdit, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryError, CardGridSkeleton } from '@/components/query-states';

/**
 * Assessment Engagements page component.
 * Data is entity-scoped: each business unit tracks its own audit cycles.
 */
export default function Assessments() {
  // Active entity drives the entityCode parameter on the API request.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch all assessment engagements for the current entity.
   * `entityCode` in the query key keeps cache entries entity-specific.
   */
  const { data: assessments, isLoading, isError, error, refetch } = useListAssessments(
    { entityCode: activeEntity },
    { query: { queryKey: getListAssessmentsQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Maps an assessment status string to an appropriately coloured Lucide icon.
   * Returns `null` for unrecognised statuses so rendering is safe.
   *
   * @param status - The assessment status from the API.
   * @returns A React element (icon) or `null`.
   */
  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'planning':  return <CircleDashed className="h-5 w-5 text-slate-400" />;
      case 'fieldwork': return <PlayCircle className="h-5 w-5 text-blue-500" />;
      case 'reporting': return <ClipboardEdit className="h-5 w-5 text-violet-500" />;
      case 'closed':    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      default:          return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Assessment Engagements</h1>
          <p className="text-sm text-muted-foreground">Active and historical audit cycles.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Engagement
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content: inline skeleton / error / assessment list                  */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        /* Inline skeleton closely mirrors the card strip layout so the page  */
        /* does not reflow when real data arrives.                             */
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <div className="flex">
                {/* Left colour strip placeholder */}
                <div className="w-2 bg-muted shrink-0" />
                <div className="flex-1 p-6 flex items-center justify-between gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-5 h-5 rounded-full bg-muted mt-1 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-1/2 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <div className="space-y-1">
                      <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
      ) : (
        <div className="space-y-4">
          {assessments?.map((assessment) => (
            <Card key={assessment.id} className="shadow-sm hover:border-primary/50 transition-colors group cursor-pointer overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-stretch">
                {/* Left colour strip — width is 2px on desktop, full-width on mobile. */}
                {/* Colour encodes current phase at a glance.                          */}
                <div className={cn(
                  "w-full md:w-2 shrink-0", 
                  assessment.status === 'planning'  ? "bg-slate-300"   :
                  assessment.status === 'fieldwork' ? "bg-blue-500"    :
                  assessment.status === 'reporting' ? "bg-violet-500"  : "bg-emerald-500"
                )} />
                
                <CardContent className="flex-1 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  {/* Left section: phase icon + name + metadata */}
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {/* Phase icon resolved by getStatusIcon. */}
                      {getStatusIcon(assessment.status)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">{assessment.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {/* Framework badge in monospace. */}
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                          {assessment.frameworkCode}
                        </Badge>
                        <span>&bull;</span>
                        {/* QSA company or "Internal Assessor" fallback. */}
                        <span className="font-medium">{assessment.qsaCompany || 'Internal Assessor'}</span>
                        <span>&bull;</span>
                        <span>Lead: {assessment.leadAssessor || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right section: timeline + status badge */}
                  <div className="flex items-center gap-8 text-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Timeline</span>
                      {/* Format dates to "MMM yyyy" (e.g. "Jan 2025"); TBD when not set. */}
                      <span className="font-mono">
                        {assessment.plannedStart ? format(new Date(assessment.plannedStart), 'MMM yyyy') : 'TBD'} &rarr; {assessment.plannedEnd ? format(new Date(assessment.plannedEnd), 'MMM yyyy') : 'TBD'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Status</span>
                      <Badge variant="secondary" className="uppercase text-[10px] tracking-wider shadow-none">
                        {assessment.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
          {/* Empty state: no engagements exist for this entity. */}
          {assessments?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
              No assessment engagements found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
