import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListPolicies, getListPoliciesQueryKey } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Plus, FileEdit } from 'lucide-react';

export default function Policies() {
  const { activeEntity } = useEntity();
  
  const { data: policies, isLoading } = useListPolicies(
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
              {policies?.map((policy) => (
                <tr key={policy.id} className="group cursor-pointer">
                  <td className="font-mono text-xs">{policy.code}</td>
                  <td className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {policy.name}
                  </td>
                  <td className="font-mono text-xs">v{policy.version}</td>
                  <td>
                    <Badge variant={
                      policy.status === 'current' ? 'default' :
                      policy.status === 'review-due' ? 'secondary' :
                      policy.status === 'overdue' ? 'destructive' : 'outline'
                    } className="uppercase text-[10px] tracking-wider bg-opacity-10" style={
                      policy.status === 'current' ? { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'rgb(16, 185, 129)', borderColor: 'rgba(16, 185, 129, 0.2)' } : undefined
                    }>
                      {policy.status.replace('-', ' ')}
                    </Badge>
                  </td>
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
                  <td className="font-mono text-xs text-muted-foreground">
                    {policy.reviewDate ? format(new Date(policy.reviewDate), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="text-right">
                     <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                       <FileEdit className="h-4 w-4 text-muted-foreground" />
                     </Button>
                  </td>
                </tr>
              ))}
              {policies?.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    No policies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
