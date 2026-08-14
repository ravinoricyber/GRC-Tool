import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListAssessments, getListAssessmentsQueryKey } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlayCircle, CheckCircle2, CircleDashed, ClipboardEdit, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Assessments() {
  const { activeEntity } = useEntity();
  
  const { data: assessments, isLoading } = useListAssessments(
    { entityCode: activeEntity },
    { query: { queryKey: getListAssessmentsQueryKey({ entityCode: activeEntity }) } }
  );

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'planning': return <CircleDashed className="h-5 w-5 text-slate-400" />;
      case 'fieldwork': return <PlayCircle className="h-5 w-5 text-blue-500" />;
      case 'reporting': return <ClipboardEdit className="h-5 w-5 text-violet-500" />;
      case 'closed': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Assessment Engagements</h1>
          <p className="text-sm text-muted-foreground">Active and historical audit cycles.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Engagement
        </Button>
      </div>

      <div className="space-y-4">
        {assessments?.map((assessment) => (
          <Card key={assessment.id} className="shadow-sm hover:border-primary/50 transition-colors group cursor-pointer overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-stretch">
              {/* Left col - Status color strip */}
              <div className={cn(
                "w-full md:w-2 shrink-0", 
                assessment.status === 'planning' ? "bg-slate-300" :
                assessment.status === 'fieldwork' ? "bg-blue-500" :
                assessment.status === 'reporting' ? "bg-violet-500" : "bg-emerald-500"
              )} />
              
              <CardContent className="flex-1 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getStatusIcon(assessment.status)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">{assessment.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="font-mono text-[10px] bg-background">
                        {assessment.frameworkCode}
                      </Badge>
                      <span>&bull;</span>
                      <span className="font-medium">{assessment.qsaCompany || 'Internal Assessor'}</span>
                      <span>&bull;</span>
                      <span>Lead: {assessment.leadAssessor || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 text-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Timeline</span>
                    <span className="font-mono">
                      {assessment.plannedStart ? format(new Date(assessment.plannedStart), 'MMM yyyy') : 'TBD'} &rarr; {assessment.plannedEnd ? format(new Date(assessment.plannedEnd), 'MMM yyyy') : 'TBD'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Status</span>
                    <Badge variant="secondary" className="uppercase text-[10px] tracking-wider shadow-none">
                      {assessment.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
        {assessments?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
            No assessment engagements found.
          </div>
        )}
      </div>
    </div>
  );
}
