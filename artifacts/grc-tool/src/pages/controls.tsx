import React, { useState } from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListControls, getListControlsQueryKey } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Search, SlidersHorizontal, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Controls() {
  const { activeEntity } = useEntity();
  
  const { data: controls, isLoading } = useListControls(
    { entityCode: activeEntity },
    { query: { queryKey: getListControlsQueryKey({ entityCode: activeEntity }) } }
  );

  const getFindingColor = (finding: string | null | undefined) => {
    switch(finding) {
      case 'in-place': return 'bg-emerald-500 text-white';
      case 'not-applicable': return 'bg-slate-400 text-white';
      case 'not-tested': return 'bg-amber-500 text-white';
      case 'not-in-place': return 'bg-destructive text-white';
      default: return 'bg-muted text-muted-foreground border border-border';
    }
  };

  const formatFindingLabel = (finding: string | null | undefined) => {
    if (!finding) return 'unassigned';
    return finding.replace(/-/g, ' ');
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Controls Library</h1>
          <p className="text-sm text-muted-foreground">Manage compliance controls, testing status, and findings.</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex items-center justify-between shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by control ref or title..."
            className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card flex-1 overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left dense-table">
            <thead className="sticky top-0 bg-muted z-10 shadow-sm border-b border-border">
              <tr>
                <th className="w-32 py-3">Control Ref</th>
                <th className="w-24">Framework</th>
                <th className="w-32">Domain</th>
                <th>Title</th>
                <th className="w-36">Status</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {controls?.map((control) => (
                <tr key={control.id} className="group cursor-pointer hover:bg-muted/20 border-b border-border/50 last:border-0">
                  <td className="font-mono font-medium text-xs text-foreground whitespace-nowrap align-top py-3">
                    {control.ref}
                  </td>
                  <td className="align-top py-3">
                    <Badge variant="outline" className="font-mono text-[10px] bg-background shrink-0">
                      {control.frameworkCode}
                    </Badge>
                  </td>
                  <td className="align-top py-3 text-muted-foreground text-xs">
                    {control.domainNumber}. {control.domain.substring(0, 15)}...
                  </td>
                  <td className="align-top py-3">
                    <div className="font-medium mb-1 leading-snug group-hover:text-primary transition-colors">{control.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{control.description}</div>
                  </td>
                  <td className="align-top py-3">
                    <Badge className={cn("text-[10px] uppercase font-bold tracking-wider border-transparent shadow-none w-28 justify-center", getFindingColor(control.finding))}>
                      {formatFindingLabel(control.finding)}
                    </Badge>
                  </td>
                  <td className="text-right align-top py-3">
                     <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                       <FileText className="h-4 w-4 text-muted-foreground" />
                     </Button>
                  </td>
                </tr>
              ))}
              {controls?.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No controls found.
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
