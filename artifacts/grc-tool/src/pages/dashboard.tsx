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

export default function Dashboard() {
  const { activeEntity } = useEntity();
  
  const { data: summary, isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary, refetch: refetchSummary } = useGetDashboardSummary(
    { entityCode: activeEntity },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ entityCode: activeEntity }) } }
  );

  const { data: coverage, isLoading: isLoadingCoverage, isError: isErrorCoverage, error: errorCoverage, refetch: refetchCoverage } = useGetControlCoverage(
    { entityCode: activeEntity },
    { query: { queryKey: getGetControlCoverageQueryKey({ entityCode: activeEntity }) } }
  );

  const { data: milestones, isLoading: isLoadingMilestones, isError: isErrorMilestones, error: errorMilestones, refetch: refetchMilestones } = useGetUpcomingMilestones(
    { entityCode: activeEntity },
    { query: { queryKey: getGetUpcomingMilestonesQueryKey({ entityCode: activeEntity }) } }
  );

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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingSummary ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : isErrorSummary ? (
          <div className="col-span-4">
            <QueryError error={errorSummary} onRetry={refetchSummary} className="rounded-lg border bg-card" />
          </div>
        ) : (
          <>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Overall Readiness</CardTitle>
                <ShieldAlert className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">{summary?.overallReadinessPct ?? 0}%</div>
                <p className="text-xs text-muted-foreground mt-1">Across all frameworks</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Controls Passing</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">
                  {summary?.controlsPassing ?? 0} <span className="text-lg text-muted-foreground">/ {summary?.controlsTotal ?? 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Verified in-place</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Evidence</CardTitle>
                <FileText className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono">{summary?.openEvidenceCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-destructive font-medium">{summary?.overdueEvidenceCount ?? 0} overdue</span>, {summary?.dueSoonEvidenceCount ?? 0} due soon
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Next AOC Expiry</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono text-base">
                  {summary?.nextAocDate ? format(new Date(summary.nextAocDate), 'MMM d, yyyy') : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">PCI DSS Level 1</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coverage */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Requirement Coverage (PCI DSS)</CardTitle>
            <CardDescription>Progress across the 12 principal requirements</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCoverage ? (
              <ProgressRowSkeleton rows={12} />
            ) : isErrorCoverage ? (
              <QueryError error={errorCoverage} onRetry={refetchCoverage} />
            ) : (
              <div className="space-y-4">
                {coverage?.map((req) => (
                  <div key={req.requirementId} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="font-mono text-muted-foreground mr-2">{req.requirementId}</span>
                      <span className="flex-1 truncate pr-4">{req.requirementName}</span>
                      <span className="font-mono">{req.pct}%</span>
                    </div>
                    <Progress value={req.pct} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar right */}
        <div className="space-y-6">
          {/* Milestones */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Upcoming Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingMilestones ? (
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
                      <div className="w-10 h-10 rounded bg-muted/50 flex flex-col items-center justify-center flex-shrink-0 border border-border/50">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">{format(new Date(milestone.dueDate), 'MMM')}</span>
                        <span className="text-sm font-bold font-mono leading-none">{format(new Date(milestone.dueDate), 'dd')}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium leading-none mb-1">{milestone.title}</h4>
                        <p className="text-xs text-muted-foreground mb-1">{milestone.description}</p>
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

          {/* Recent Activity */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingActivity ? (
                <ListItemSkeleton rows={4} />
              ) : isErrorActivity ? (
                <QueryError error={errorActivity} onRetry={refetchActivity} />
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {activities?.map((activity) => (
                    <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-5 h-5 rounded-full border border-background bg-muted-foreground/20 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                      </div>
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] flex flex-col text-sm">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                          <span className="font-medium text-foreground">{activity.actor}</span>
                          <span>{activity.action}</span>
                        </div>
                        <span className="font-mono text-xs truncate bg-muted/30 px-1 py-0.5 rounded text-foreground w-fit">{activity.target}</span>
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
