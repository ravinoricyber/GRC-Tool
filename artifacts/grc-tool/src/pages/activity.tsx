/**
 * @file activity.tsx
 * @description Activity Log page (`/activity`).
 *
 * Fetches the full audit trail for the active entity via `useListActivity` (up
 * to 100 most recent entries) and renders each event as a list item inside a
 * card. This page provides a complete view of system and user actions; a
 * condensed 5-item version of this feed also appears on the Dashboard.
 *
 * Relationship to the Dashboard's "Recent Activity" card:
 * - Dashboard fetches `limit: 5`  → query key includes `{ limit: 5 }`.
 * - This page fetches `limit: 100` → query key includes `{ limit: 100 }`.
 * - Both use `getListActivityQueryKey` with different arguments, so they occupy
 *   separate React Query cache entries and are fetched independently.
 *
 * Each activity row shows:
 *   - A circular icon avatar (`ActivityIcon` in a rounded muted background) for
 *     visual rhythm and to anchor the eye to the left side.
 *   - **Actor name** (semibold, full foreground) + **action verb** (muted) +
 *     **target entity** (monospace chip with muted bg + border) forming a
 *     natural language sentence: "Grace Hopper updated EV-001".
 *   - **Timestamp**: absolute time in `"MMM d, HH:mm"` format (e.g. "Jan 5, 14:30")
 *     followed by a relative time in `"3 minutes ago"` format (from `date-fns
 *     formatDistanceToNow`). The separator dot and relative time are hidden on
 *     extra-small screens via `hidden sm:inline` to prevent overflow.
 *
 * Loading state: `ListItemSkeleton` (10 rows).
 * Error state:   `QueryError` block inside the card (no `asTableRow` needed).
 * Empty state:   Centred message inside the list container.
 */

import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListActivity, getListActivityQueryKey } from '@workspace/api-client-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Activity as ActivityIcon } from 'lucide-react';
import { QueryError, ListItemSkeleton } from '@/components/query-states';

/**
 * Activity Log page component.
 *
 * Fetches and displays the full audit trail for the currently active entity.
 * The page is intentionally constrained to a `max-w-4xl` container so the
 * log is comfortable to read on wide monitors without lines spanning the full
 * viewport width.
 *
 * @returns The Activity Log page JSX including the page header and the card
 *          containing the full list of activity events.
 */
export default function Activity() {
  // Active entity from context — scopes the API request to the selected entity.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch the 100 most recent activity entries for the active entity.
   *
   * React Query wiring:
   * - `entityCode: activeEntity` scopes the API request.
   * - `limit: 100` fetches up to 100 entries — enough for the full-page log.
   * - `queryKey: getListActivityQueryKey({ entityCode: activeEntity, limit: 100 })`
   *   ensures this query's cache entry is separate from the Dashboard's
   *   `{ entityCode: activeEntity, limit: 5 }` entry. Both can coexist in the
   *   cache simultaneously, keeping the Dashboard's condensed view intact.
   */
  const { data: activities, isLoading, isError, error, refetch } = useListActivity(
    { entityCode: activeEntity, limit: 100 },
    { query: { queryKey: getListActivityQueryKey({ entityCode: activeEntity, limit: 100 }) } }
  );

  return (
    /* Max-width container centres the log on wide screens for comfortable reading.
       `max-w-4xl mx-auto` limits the content width while keeping it left-anchored
       within the Shell's `max-w-7xl` page container. */
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Complete audit trail of system changes and user actions.</p>
      </div>

      {/* The entire log lives inside a single Card so it has a consistent
          border and background. `p-0` removes default CardContent padding
          since each row manages its own padding. */}
      <Card className="shadow-sm overflow-hidden">
        {/* Remove default card padding; each row manages its own p-4. */}
        <CardContent className="p-0">
          {isLoading ? (
            /* 10 skeleton rows while the activity fetch is in progress. */
            <ListItemSkeleton rows={10} />
          ) : isError ? (
            /* Block-mode QueryError (no asTableRow needed — we're not in a table). */
            <QueryError error={error} onRetry={refetch} />
          ) : (
            /* `divide-y divide-border` draws a 1px separator between rows without
               needing explicit margin-top on each item. */
            <div className="divide-y divide-border">
              {activities?.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-4">
                  {/* Circular icon avatar: provides visual rhythm and a clear
                      left-anchor for the eye when scanning the log. */}
                  <div className="mt-1 bg-muted rounded-full p-2 border border-border">
                    <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                      {/* Activity sentence: "Actor verb Target" natural language format.
                          Actor is semibold foreground, verb is muted, target is a chip. */}
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">{activity.actor}</span>
                        {' '}
                        <span className="text-muted-foreground">{activity.action}</span>
                        {' '}
                        {/* Target entity rendered in a monospace chip for easy identification.
                            The small border + muted background visually separates it from prose. */}
                        <span className="font-mono font-medium bg-muted/50 px-1 py-0.5 rounded text-xs border border-border/50">
                          {activity.target}
                        </span>
                      </p>
                      {/* Timestamp row: absolute time + relative time.
                          - Absolute: "Jan 5, 14:30" using `date-fns format`.
                          - Separator dot (·) hidden on xs screens via `hidden sm:inline`.
                          - Relative: "3 minutes ago" using `date-fns formatDistanceToNow`.
                            Rendered `block sm:inline` so on xs it drops to a new line. */}
                      <time className="text-xs text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                        {format(new Date(activity.createdAt), 'MMM d, HH:mm')} 
                        <span className="hidden sm:inline"> · </span>
                        {/* Relative time hidden behind `block sm:inline` so it shows
                            below the absolute time on xs, and inline on sm+. */}
                        <span className="block sm:inline">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                      </time>
                    </div>
                  </div>
                </div>
              ))}
              {/* Empty state: no activity recorded for this entity yet.
                  This is expected for a newly onboarded entity with no history. */}
              {activities?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No activity recorded yet.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
