/**
 * @file assessments.tsx
 * @description Assessment Engagements page (`/assessments`).
 *
 * Fetches all audit / assessment engagements for the active entity via
 * `useListAssessments` and renders them as a vertical list of status-coded cards.
 * Assessments are entity-scoped: each business unit manages its own audit cycles.
 *
 * Each card displays:
 *   - A **left-edge colour strip** (2px on desktop, full-width on mobile) that
 *     encodes the current assessment phase using colour:
 *       planning  → slate-300 (light grey — not yet started)
 *       fieldwork → blue-500  (active work in progress)
 *       reporting → violet-500 (writing up findings)
 *       closed    → emerald-500 (completed)
 *   - A **phase icon** returned by {@link getStatusIcon}: dashed circle for
 *     planning, play circle for fieldwork, clipboard for reporting, checkmark
 *     for closed. Each icon uses the same colour convention as the strip.
 *   - Assessment name, framework code badge, QSA company, and lead assessor.
 *   - **Planned timeline**: start and end dates formatted to "MMM yyyy" (e.g.
 *     "Jan 2025") with "TBD" fallback when a date is null.
 *   - A **status badge** in secondary variant with uppercase tracking.
 *
 * Loading state: Custom inline skeleton (3 rows) that mirrors the card strip
 *   layout with shimmer divs rather than the generic `CardGridSkeleton`, since
 *   this page uses a list layout not a grid.
 * Error state:   `QueryError` block with card border.
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
 *
 * Assessments are entity-scoped: each business unit tracks its own audit cycles
 * and engagement history. The `entityCode` is embedded in the React Query cache
 * key so switching entities loads the correct engagement list.
 *
 * @returns The Assessment Engagements page JSX including the page header and
 *          the loading/error/card-list content area.
 */
export default function Assessments() {
  // Active entity from context — passed as `entityCode` to the API and query key.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch all assessment engagements for the current entity.
   *
   * React Query wiring:
   * - `entityCode: activeEntity` scopes the API request.
   * - `queryKey: getListAssessmentsQueryKey({ entityCode: activeEntity })` → key
   *   like `["listAssessments", { entityCode: "gopuff" }]`. Switching entities
   *   uses a different cache slot, so each entity's assessments are independent.
   */
  const { data: assessments, isLoading, isError, error, refetch } = useListAssessments(
    { entityCode: activeEntity },
    { query: { queryKey: getListAssessmentsQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Returns a phase-appropriate Lucide icon component for an assessment status.
   *
   * The icon colour matches the left-edge colour strip applied to each card so
   * both visual cues consistently encode the same phase meaning:
   *   - planning  → `CircleDashed`   (slate-400 — not yet started)
   *   - fieldwork → `PlayCircle`     (blue-500  — actively running)
   *   - reporting → `ClipboardEdit`  (violet-500 — writing findings)
   *   - closed    → `CheckCircle2`   (emerald-500 — completed)
   *
   * Returns `null` for any unrecognised status so the render tree is safe even
   * with unexpected API values.
   *
   * @param status - The assessment status string from the API.
   * @returns A sized React element (icon) or `null`.
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
        {/* "New Engagement" is a UI stub — no creation handler wired yet. */}
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Engagement
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content: inline skeleton / error / assessment card list             */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        /* Inline skeleton closely mirrors the card strip layout so the page
           layout does not reflow when real data arrives. Each skeleton row
           contains a coloured left strip placeholder, a circular icon placeholder,
           title + sub-title placeholders, and timeline + status placeholders. */
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <div className="flex">
                {/* Left colour strip placeholder — same width as the real strip (w-2). */}
                <div className="w-2 bg-muted shrink-0" />
                <div className="flex-1 p-6 flex items-center justify-between gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Circular icon placeholder — same size as phase icons (h-5 w-5). */}
                    <div className="w-5 h-5 rounded-full bg-muted mt-1 shrink-0" />
                    <div className="flex-1 space-y-2">
                      {/* Assessment name placeholder — half-width to approximate real names. */}
                      <div className="h-5 w-1/2 bg-muted rounded animate-pulse" />
                      {/* Sub-metadata placeholder — shorter than the name. */}
                      <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="flex gap-8">
                    {/* Timeline placeholder: label + date range. */}
                    <div className="space-y-1">
                      <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    {/* Status badge placeholder. */}
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
                {/* Left colour strip — 2px wide on desktop (md+), full-width thin bar on mobile.
                    Colour encodes the current assessment phase at a glance.
                    Uses a conditional `cn()` call mapping status → Tailwind bg colour. */}
                <div className={cn(
                  "w-full md:w-2 shrink-0", 
                  assessment.status === 'planning'  ? "bg-slate-300"   :
                  assessment.status === 'fieldwork' ? "bg-blue-500"    :
                  assessment.status === 'reporting' ? "bg-violet-500"  : "bg-emerald-500"
                )} />
                
                <CardContent className="flex-1 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  {/* Left section: phase icon + assessment name + metadata */}
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {/* Phase icon resolved from the status string via getStatusIcon(). */}
                      {getStatusIcon(assessment.status)}
                    </div>
                    <div>
                      {/* Assessment name turns primary on hover via `group-hover:text-primary`. */}
                      <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">{assessment.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {/* Framework code in a monospace outline badge. */}
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                          {assessment.frameworkCode}
                        </Badge>
                        <span>&bull;</span>
                        {/* QSA company or "Internal Assessor" when performed in-house. */}
                        <span className="font-medium">{assessment.qsaCompany || 'Internal Assessor'}</span>
                        <span>&bull;</span>
                        <span>Lead: {assessment.leadAssessor || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right section: planned timeline + status badge */}
                  <div className="flex items-center gap-8 text-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Timeline</span>
                      {/* Dates formatted to "MMM yyyy" (e.g. "Jan 2025") for compact display.
                          Falls back to "TBD" when a planned date has not been set yet.
                          Arrow HTML entity `→` separates start from end. */}
                      <span className="font-mono">
                        {assessment.plannedStart ? format(new Date(assessment.plannedStart), 'MMM yyyy') : 'TBD'} &rarr; {assessment.plannedEnd ? format(new Date(assessment.plannedEnd), 'MMM yyyy') : 'TBD'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Status</span>
                      {/* Status badge in secondary variant — uppercase tracking for consistent
                          label styling across all status values. */}
                      <Badge variant="secondary" className="uppercase text-[10px] tracking-wider shadow-none">
                        {assessment.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
          {/* Empty state: no assessment engagements exist for this entity. */}
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
