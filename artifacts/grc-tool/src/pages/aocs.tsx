import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListAocs, getListAocsQueryKey } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ShieldCheck, Download, ExternalLink, Calendar, Building, FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Aocs() {
  const { activeEntity } = useEntity();
  
  const { data: aocs, isLoading } = useListAocs(
    { entityCode: activeEntity },
    { query: { queryKey: getListAocsQueryKey({ entityCode: activeEntity }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Attestations of Compliance (AOCs)</h1>
          <p className="text-sm text-muted-foreground">Official audit reports and certifications for this entity.</p>
        </div>
        <Button>Upload Document</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {aocs?.map((aoc) => (
          <Card key={aoc.id} className={cn("flex flex-col shadow-sm relative overflow-hidden", aoc.status === 'current' ? 'border-primary/50' : '')}>
            {aoc.status === 'current' && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />
            )}
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <Badge variant={aoc.status === 'current' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                  {aoc.status}
                </Badge>
                <div className="font-mono text-xs font-bold text-muted-foreground border border-border px-2 py-1 rounded bg-muted/20">
                  {aoc.frameworkCode}
                </div>
              </div>
              <CardTitle className="text-xl leading-tight flex gap-2 items-center">
                <ShieldCheck className={cn("h-5 w-5", aoc.status === 'current' ? "text-primary" : "text-muted-foreground")} />
                {aoc.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Issued Date
                    </div>
                    <div className="font-mono text-sm">
                      {aoc.issuedDate ? format(new Date(aoc.issuedDate), 'MMM d, yyyy') : 'Pending'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Expiry Date
                    </div>
                    <div className={cn("font-mono text-sm", aoc.status === 'current' ? "text-primary font-bold" : "")}>
                      {aoc.expiresDate ? format(new Date(aoc.expiresDate), 'MMM d, yyyy') : 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Building className="h-3 w-3" /> Assessor (QSA)
                    </div>
                    <div className="text-sm font-medium">
                      {aoc.qsaCompany || 'Internal Assessment'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <FileSignature className="h-3 w-3" /> Result
                    </div>
                    <div className="text-sm">
                      {aoc.result === 'Compliant' ? (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          Compliant
                        </span>
                      ) : (
                        <span>{aoc.result || 'Pending'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/30 rounded p-3 text-sm flex justify-between items-center border border-border/50">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Controls Evaluated</span>
                  <span className="font-mono font-bold">{aoc.controlsCovered || 0}</span>
                </div>
                <div className="w-px h-8 bg-border"></div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Findings</span>
                  <span className="font-mono font-bold">{aoc.findings || 0}</span>
                </div>
                <div className="w-px h-8 bg-border"></div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Period</span>
                  <span className="font-mono font-bold">{aoc.period || 'Annual'}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-4 bg-muted/10 flex gap-2">
              <Button className="w-full gap-2" variant="outline">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
              <Button className="w-full gap-2" variant="outline">
                <ExternalLink className="h-4 w-4" /> View Report
              </Button>
            </CardFooter>
          </Card>
        ))}
        {aocs?.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            No AOCs or reports found for this entity.
          </div>
        )}
      </div>
    </div>
  );
}
