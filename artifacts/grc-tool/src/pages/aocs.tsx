/**
 * @file aocs.tsx
 * @description Attestations of Compliance (AOCs) page (`/aocs`).
 *
 * Fetches all AOC documents and certification reports for the active entity via
 * `useListAocs` and renders them as a 2-column card grid.
 *
 * Each AOC card displays:
 *   - Status badge (current / expired / pending) and framework code chip
 *   - AOC title with a ShieldCheck icon (primary colour when current)
 *   - Issued and expiry dates formatted to "MMM d, yyyy"
 *   - QSA / assessor company and compliance result
 *   - Summary stats: controls evaluated, findings count, assessment period
 *   - Download PDF and View Report action buttons
 *
 * Visual treatment:
 *   - Cards with `status === 'current'` receive a primary-tinted border and a
 *     decorative radial gradient accent in the top-right corner.
 *   - The expiry date is rendered in primary/bold for current AOCs to draw
 *     attention to the validity window.
 *
 * Loading state: `CardGridSkeleton` (4 cards, 2 columns).
 * Error state:   `QueryError` block.
 * Empty state:   Dashed bordered message spanning 2 columns.
 */

import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListAocs, getListAocsQueryKey } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ShieldCheck, Download, ExternalLink, Calendar, Building, FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryError, CardGridSkeleton } from '@/components/query-states';

/**
 * AOCs & Reports page component.
 * Data is entity-scoped: each business unit has its own certification history.
 */
export default function Aocs() {
  // Read the active entity from context to scope the API request.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch all AOC documents for the active entity.
   * `entityCode` is embedded in the query key so switching entities invalidates
   * the cached result and triggers a fresh fetch.
   */
  const { data: aocs, isLoading, isError, error, refetch } = useListAocs(
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

      {/* ------------------------------------------------------------------ */}
      {/* Content: skeleton / error / 2-column card grid                      */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        <CardGridSkeleton count={4} cols={2} />
      ) : isError ? (
        <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {aocs?.map((aoc) => (
            <Card
              key={aoc.id}
              className={cn(
                "flex flex-col shadow-sm relative overflow-hidden",
                // Highlight current AOCs with a primary-coloured border.
                aoc.status === 'current' ? 'border-primary/50' : ''
              )}
            >
              {/* Decorative radial gradient accent — only shown for current AOCs. */}
              {aoc.status === 'current' && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />
              )}

              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  {/* Status badge: default for current, secondary for others. */}
                  <Badge variant={aoc.status === 'current' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                    {aoc.status}
                  </Badge>
                  {/* Framework code chip — monospace for quick scanning. */}
                  <div className="font-mono text-xs font-bold text-muted-foreground border border-border px-2 py-1 rounded bg-muted/20">
                    {aoc.frameworkCode}
                  </div>
                </div>
                <CardTitle className="text-xl leading-tight flex gap-2 items-center">
                  {/* ShieldCheck icon is primary coloured for current, muted otherwise. */}
                  <ShieldCheck className={cn("h-5 w-5", aoc.status === 'current' ? "text-primary" : "text-muted-foreground")} />
                  {aoc.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 pb-4">
                {/* 2×2 detail grid: issued date, expiry, QSA, result. */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Issued Date
                      </div>
                      <div className="font-mono text-sm">
                        {/* Format ISO date to "MMM d, yyyy", fall back to "Pending". */}
                        {aoc.issuedDate ? format(new Date(aoc.issuedDate), 'MMM d, yyyy') : 'Pending'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Expiry Date
                      </div>
                      {/* Expiry date is bold/primary for current AOCs to flag the deadline. */}
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
                        {/* Fall back when assessment was performed internally. */}
                        {aoc.qsaCompany || 'Internal Assessment'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <FileSignature className="h-3 w-3" /> Result
                      </div>
                      <div className="text-sm">
                        {/* "Compliant" gets a green treatment; anything else is neutral. */}
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
                
                {/* Summary stats bar: controls evaluated, findings, period. */}
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

              {/* Card footer: download and view report action buttons. */}
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
          {/* Empty state: no AOCs exist for this entity. */}
          {aocs?.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              No AOCs or reports found for this entity.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
