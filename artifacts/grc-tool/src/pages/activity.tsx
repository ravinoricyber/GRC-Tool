import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListActivity, getListActivityQueryKey } from '@workspace/api-client-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Activity as ActivityIcon, User, Database } from 'lucide-react';

export default function Activity() {
  const { activeEntity } = useEntity();
  
  const { data: activities, isLoading } = useListActivity(
    { entityCode: activeEntity, limit: 100 },
    { query: { queryKey: getListActivityQueryKey({ entityCode: activeEntity, limit: 100 }) } }
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Complete audit trail of system changes and user actions.</p>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {activities?.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-4">
                <div className="mt-1 bg-muted rounded-full p-2 border border-border">
                  <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                    <p className="text-sm">
                      <span className="font-semibold text-foreground">{activity.actor}</span>
                      {' '}
                      <span className="text-muted-foreground">{activity.action}</span>
                      {' '}
                      <span className="font-mono font-medium bg-muted/50 px-1 py-0.5 rounded text-xs border border-border/50">
                        {activity.target}
                      </span>
                    </p>
                    <time className="text-xs text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                      {format(new Date(activity.createdAt), 'MMM d, HH:mm')} 
                      <span className="hidden sm:inline"> · </span>
                      <span className="block sm:inline">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                    </time>
                  </div>
                </div>
              </div>
            ))}
            {activities?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No activity recorded yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
