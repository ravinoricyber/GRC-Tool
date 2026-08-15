/**
 * @file dashboard.tsx
 * @description Compliance Dashboard page — the default landing route (`/`).
 *
 * Displays a high-level overview of the active entity's compliance posture via
 * four independent React Query fetches:
 *
 *   1. **Dashboard Summary** (`useGetDashboardSummary`) – KPI cards showing
 *      overall readiness %, controls passing out of total, open evidence count
 *      (with overdue and due-soon sub-counts), and the next AOC expiry date.
 *   2. **Control Coverage** (`useGetControlCoverage`) – An ordered array of
 *      per-requirement coverage percentages (REQ-1 through REQ-12) rendered as
 *      progress bars with monospace IDs and truncated requirement names.
 *   3. **Upcoming Milestones** (`useGetUpcomingMilestones`) – A date-card list
 *      of forthcoming compliance deadlines sorted by due date ascending, with
 *      priority badges (destructive for critical, secondary otherwise).
 *   4. **Recent Activity** (`useListActivity`) – The 5 most recent system/user
 *      events, rendered as a vertical timeline. The full log is at `/activity`.
 *
 * Each section is fetched and rendered independently so a failure in one
 * section does not block the others from displaying their data.
 *
 * Entity scoping:
 * All four queries include `entityCode` in both the API call parameters and
 * the React Query cache key. Switching the active entity in the sidebar causes
 * each query to refetch with the new `entityCode` while keeping the previous
 * entity's data in cache for instant re-display if the user switches back.
 *
 * Layout:
 * - Row 1: 4-column KPI card grid (collapses to 2 on md, 1 on sm).
 * - Row 2: 2/3 + 1/3 two-column grid:
 *   - Left  (lg:col-span-2): PCI DSS requirement coverage progress bars.
 *   - Right (lg:col-span-1): Upcoming Milestones + Recent Activity stacked.
 */

import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { 
  useGetDashboardSummary, 
  useGetControlCoverage, 
  useGetUpcomingMilestones,
  useListActivity,
  getGetDashboardSummaryQueryKey,
  getGetControlCoverageQueryKey,
  getGetUpcomingMilestonesQueryKey,
  getListActivityQueryKey
} from '@workspace/api-client-react';
import { 
  Activity as ActivityIcon, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import {
  QueryError,
  KpiSkeleton,
  ProgressRowSkeleton,
  ListItemSkeleton,
} from '@/components/query-states';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Dashboard page component. The default route (`/`).
 *
 * Fetches and renders the compliance overview for the entity currently selected
 * in the sidebar entity switcher. All data is read from the `activeEntity`
 * context value to ensure consistency with other pages.
 *
 * @returns The full Dashboard page JSX including KPI cards, coverage progress
 *          bars, milestone cards, and recent activity timeline.
 */
export default function Dashboard() {
  // Read the active entity code from context; all queries are scoped to it.
  const { activeEntity } = useEntity();
  
  /**
   * KPI summary query.
   *
   * Returns: overall readiness %, controls passing/total, open evidence count,
   * overdue/due-soon evidence sub-counts, and the next AOC expiry date string.
   *
   * React Query wiring:
   * - `entityCode: activeEntity` scopes the request to the current entity.
   * - `queryKey: getGetDashboardSummaryQueryKey({ entityCode: activeEntity })`
   *   creates a cache key like `["getDashboardSummary", { entityCode: "gopuff" }]`.
   *   Each entity gets its own cache slot so switching entities never serves
   *   another entity's KPIs.
   */
  const { data: summary, isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary, refetch: refetchSummary } = useGetDashboardSummary(
    { entityCode: activeEntity },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Per-requirement coverage query.
   *
   * Returns an array of `{ requirementId, requirementName, pct }` objects
   * representing the percentage of controls in-place for each PCI DSS
   * principal requirement (REQ-1 through REQ-12).
   *
   * React Query wiring: same entity-scoped key pattern as the summary query.
   */
  const { data: coverage, isLoading: isLoadingCoverage, isError: isErrorCoverage, error: errorCoverage, refetch: refetchCoverage } = useGetControlCoverage(
    { entityCode: activeEntity },
    { query: { queryKey: getGetControlCoverageQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Upcoming milestones query.
   *
   * Returns an array of compliance deadlines sorted by `dueDate` ascending.
   * Each item has: `id`, `title`, `description`, `dueDate`, and `priority`.
   *
   * React Query wiring: entity-scoped key pattern. Empty array default ensures
   * the `?.length === 0` empty-state check is safe before data arrives.
   */
  const { data: milestones, isLoading: isLoadingMilestones, isError: isErrorMilestones, error: errorMilestones, refetch: refetchMilestones } = useGetUpcomingMilestones(
    { entityCode: activeEntity },
    { query: { queryKey: getGetUpcomingMilestonesQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Recent activity query.
   *
   * Fetches only the 5 most recent activity entries (`limit: 5`) for the
   * Dashboard's condensed timeline. The full log at `/activity` uses `limit: 100`.
   * Both queries occupy separate cache entries because `limit` is part of the key.
   *
   * React Query wiring: `entityCode` + `limit` both included in the query key
   * to keep the Dashboard and Activity page caches independent.
   */
  const { data: activities, isLoading: isLoadingActivity, isError: isErrorActivity, error: errorActivity, refetch: refetchActivity } = useListActivity(
    { entityCode: activeEntity, limit: 5 },
    { query: { queryKey: getListActivityQueryKey({ entityCode: activeEntity, limit: 5 }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Compliance Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of compliance posture, tasks, and recent changes.</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                            */}
      {/* Four states:                                                         */}
      {/*   Loading → 4 × KpiSkeleton side by side (same grid as real cards). */}
      {/*   Error   → QueryError spanning all 4 columns.                       */}
      {/*   Data    → 4 real KPI cards.                                        */}
      {/* The 4-column grid collapses to 2 on md and 1 on sm for responsiveness. */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingSummary ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : isErrorSummary ? (
          /* Error spans all 4 columns so it fills the KPI row visually. */
          <div className="col-span-4">
            <QueryError error={errorSummary} onRetry={refetchSummary} className="rounded-lg border bg-card" />
          </div>
        ) : (
          <>
            {/* KPI 1: Overall Readiness % */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Overall Readiness</CardTitle>
                <ShieldAlert className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {/* `?? 0` guards against null/undefined from the API during a partial load. */}
                <div className="text-3xl font-bold font-mono">{summary?.overallReadinessPct ?? 0}%</div>
                <p className="text-xs text-muted-foreground mt-1">Across all frameworks</p>
              </CardContent>
            </Card>
            
            {/* KPI 2: Controls Passing — numerator / denominator format. */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Controls Passing</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">
                  {summary?.controlsPassing ?? 0}
                  {/* Total rendered smaller and muted to emphasise the passing count. */}
                  <span className="text-lg text-muted-foreground"> / {summary?.controlsTotal ?? 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Verified in-place</p>
              </CardContent>
            </Card>

            {/* KPI 3: Open Evidence — overdue count highlighted in destructive red. */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Evidence</CardTitle>
                <FileText className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">{summary?.openEvidenceCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {/* Overdue count draws attention via `text-destructive`. */}
                  <span className="text-destructive font-medium">{summary?.overdueEvidenceCount ?? 0} overdue</span>, {summary?.dueSoonEvidenceCount ?? 0} due soon
                </p>
              </CardContent>
            </Card>

            {/* KPI 4: Next AOC Expiry — ISO date string formatted to "MMM d, yyyy". */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Next AOC Expiry</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono text-base">
                  {/* `format` from date-fns converts ISO string to human-readable date.
                      Falls back to "N/A" when no AOC date is available for the entity. */}
                  {summary?.nextAocDate ? format(new Date(summary.nextAocDate), 'MMM d, yyyy') : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">PCI DSS Level 1</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Lower section: 2/3 + 1/3 two-column grid                           */}
      {/* On lg+: Coverage takes 2/3 of width, sidebar 1/3.                  */}
      {/* On smaller screens: stacks vertically.                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PCI DSS Requirement Coverage progress bars — occupies 2/3 of the row */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Requirement Coverage (PCI DSS)</CardTitle>
            <CardDescription>Progress across the 12 principal requirements</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCoverage ? (
              /* 12 rows matches the number of PCI DSS principal requirements. */
              <ProgressRowSkeleton rows={12} />
            ) : isErrorCoverage ? (
              <QueryError error={errorCoverage} onRetry={refetchCoverage} />
            ) : (
              <div className="space-y-4">
                {coverage?.map((req) => (
                  <div key={req.requirementId} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      {/* Monospace requirement ID (e.g. "REQ-1") for alignment. */}
                      <span className="font-mono text-muted-foreground mr-2">{req.requirementId}</span>
                      {/* Requirement name truncated with `flex-1 truncate` so the
                          percentage value always aligns to the right. */}
                      <span className="flex-1 truncate pr-4">{req.requirementName}</span>
                      {/* Percentage value in monospace for consistent column alignment. */}
                      <span className="font-mono">{req.pct}%</span>
                    </div>
                    {/* Radix UI Progress bar; `value` drives the CSS fill width. */}
                    <Progress value={req.pct} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right sidebar: Milestones and Recent Activity stacked vertically */}
        <div className="space-y-6">
          {/* Upcoming Milestones card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Upcoming Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingMilestones ? (
                /* Inline skeleton closely mirrors the date-card layout:
                   a small square date badge (w-10 h-10) + two text lines + a badge. */
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-10 h-10 rounded shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isErrorMilestones ? (
                <QueryError error={errorMilestones} onRetry={refetchMilestones} />
              ) : (
                <div className="space-y-4">
                  {milestones?.length === 0 && <p className="text-sm text-muted-foreground">No upcoming milestones.</p>}
                  {milestones?.map((milestone) => (
                    <div key={milestone.id} className="flex gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      {/* Date badge: two-line widget showing abbreviated month + numeric day.
                          Uses `format(date, 'MMM')` for the month (e.g. "Jan") and
                          `format(date, 'dd')` for the zero-padded day (e.g. "05"). */}
                      <div className="w-10 h-10 rounded bg-muted/50 flex flex-col items-center justify-center flex-shrink-0 border border-border/50">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">{format(new Date(milestone.dueDate), 'MMM')}</span>
                        <span className="text-sm font-bold font-mono leading-none">{format(new Date(milestone.dueDate), 'dd')}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium leading-none mb-1">{milestone.title}</h4>
                        <p className="text-xs text-muted-foreground mb-1">{milestone.description}</p>
                        {/* Priority badge:
                            - "critical" → `variant="destructive"` (red)
                            - all others → `variant="secondary"` (muted grey) */}
                        <Badge variant={milestone.priority === 'critical' ? 'destructive' : 'secondary'} className="text-[10px] py-0 px-1.5 font-mono">
                          {milestone.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity card — last 5 events in a vertical timeline layout */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingActivity ? (
                /* 4 skeleton rows to approximate the 5 fetched items (accounting
                   for varying content lengths the fifth may or may not appear). */
                <ListItemSkeleton rows={4} />
              ) : isErrorActivity ? (
                <QueryError error={errorActivity} onRetry={refetchActivity} />
              ) : (
                /* Vertical timeline layout:
                   - The `before:` pseudo-element on the container div draws a
                     thin gradient vertical line connecting the activity nodes.
                   - Each node has a small dot (the `w-1.5 h-1.5 rounded-full`).
                   - On md+ the timeline centres and alternates sides. */
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {activities?.map((activity) => (
                    <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      {/* Timeline node: small bordered circle with an inner dot. */}
                      <div className="flex items-center justify-center w-5 h-5 rounded-full border border-background bg-muted-foreground/20 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                      </div>
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] flex flex-col text-sm">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                          {/* Actor name in full foreground colour for visual hierarchy. */}
                          <span className="font-medium text-foreground">{activity.actor}</span>
                          <span>{activity.action}</span>
                        </div>
                        {/* Target entity in a monospace chip for easy identification. */}
                        <span className="font-mono text-xs truncate bg-muted/30 px-1 py-0.5 rounded text-foreground w-fit">{activity.target}</span>
                        {/* Relative timestamp using `date-fns formatDistanceToNow`:
                            e.g. "3 minutes ago", "about 2 hours ago". */}
                        <time className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
