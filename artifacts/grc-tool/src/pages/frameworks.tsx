import React from 'react';
import { useListFrameworks, getListFrameworksQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Shield, BookOpen, Layers, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QueryError, CardGridSkeleton } from '@/components/query-states';

export default function Frameworks() {
  const { data: frameworks, isLoading, isError, error, refetch } = useListFrameworks(
    { query: { queryKey: getListFrameworksQueryKey() } }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Frameworks Library</h1>
          <p className="text-sm text-muted-foreground">Manage active compliance frameworks and domain coverage.</p>
        </div>
        <Button>Add Framework</Button>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={3} cols={3} />
      ) : isError ? (
        <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {frameworks?.map((fw) => (
            <Card key={fw.id} className="flex flex-col hover:border-primary/50 transition-colors shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={fw.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                    {fw.status}
                  </Badge>
                  <Badge variant={
                    fw.priority === 'critical' ? 'destructive' :
                    fw.priority === 'high' ? 'default' : 'secondary'
                  } className="bg-orange-500 hover:bg-orange-600 text-white border-transparent shadow-none" style={fw.priority === 'high' ? {} : undefined}>
                    {fw.priority}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{fw.name}</CardTitle>
                <div className="font-mono text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                  <BookOpen className="h-3 w-3" />
                  {fw.code} v{fw.version}
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                  {fw.summary}
                </p>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Domains
                    </div>
                    <div className="font-medium font-mono">{fw.domainsCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Owner
                    </div>
                    <div className="font-medium truncate">{fw.owner || 'Unassigned'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Next Milestone</div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {fw.nextMilestone ? format(new Date(fw.nextMilestone), 'MMMM d, yyyy') : 'None scheduled'}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/50 pt-4 bg-muted/10">
                <Button variant="ghost" size="sm" className="w-full text-primary hover:text-primary">
                  View Framework Details &rarr;
                </Button>
              </CardFooter>
            </Card>
          ))}
          {frameworks?.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
              No frameworks found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
