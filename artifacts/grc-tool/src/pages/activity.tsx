/**
 * @file activity.tsx
 * @description Activity Log page (`/activity`).
 *
 * Fetches the full audit trail for the active entity via `useListActivity` (up
 * to 100 most recent entries) and renders each event as a list item inside a
 * card. This page provides a complete view of system and user actions; a
 * condensed 5-item version of this feed also appears on the Dashboard.
 *
 * Each activity row shows:
 *   - An activity icon avatar
 *   - Actor name + action verb + target entity (monospace chip)
 *   - Absolute timestamp ("MMM d, HH:mm") and relative time ("3 minutes ago"),
 *     with the relative form hidden on very narrow screens via `hidden sm:inline`
 *
 * Loading state: `ListItemSkeleton` (10 rows).
 * Error state:   `QueryError` block inside the card.
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
 * Data is entity-scoped: each business unit has its own audit trail.
 * Fetches up to 100 entries — sufficient for the full-page log view.
 */
export default function Activity() {
  // Active entity drives the entityCode parameter on the API request.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch the 100 most recent activity entries for the active entity.
   * Using `limit: 100` here vs `limit: 5` on the Dashboard means they occupy
   * different cache slots and are fetched independently.
   */
  const { data: activities, isLoading, isError, error, refetch } = useListActivity(
    { entityCode: activeEntity, limit: 100 },
    { query: { queryKey: getListActivityQueryKey({ entityCode: activeEntity, limit: 100 }) } }
  );

  return (
    /* Max-width container centres the log on wide screens for readability. */
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Complete audit trail of system changes and user actions.</p>
      </div>

      <Card className="shadow-sm overflow-hidden">
        {/* Remove default card padding; each row manages its own padding. */}
        <CardContent className="p-0">
          {isLoading ? (
            <ListItemSkeleton rows={10} />
          ) : isError ? (
            <QueryError error={error} onRetry={refetch} />
          ) : (
            /* Divide rows with a border without needing explicit margin. */
            <div className="divide-y divide-border">
              {activities?.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-4">
                  {/* Circular icon avatar for visual rhythm. */}
                  <div className="mt-1 bg-muted rounded-full p-2 border border-border">
                    <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                      {/* Activity sentence: "Actor verb Target" */}
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">{activity.actor}</span>
                        {' '}
                        <span className="text-muted-foreground">{activity.action}</span>
                        {' '}
                        {/* Target rendered in a monospace chip for easy scanning. */}
                        <span className="font-mono font-medium bg-muted/50 px-1 py-0.5 rounded text-xs border border-border/50">
                          {activity.target}
                        </span>
                      </p>
                      {/* Timestamp: absolute + relative (relative hidden on xs). */}
                      <time className="text-xs text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                        {format(new Date(activity.createdAt), 'MMM d, HH:mm')} 
                        <span className="hidden sm:inline"> · </span>
                        {/* Relative time shown inline on sm+, block on xs. */}
                        <span className="block sm:inline">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                      </time>
                    </div>
                  </div>
                </div>
              ))}
              {/* Empty state: no activity recorded for this entity yet. */}
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
