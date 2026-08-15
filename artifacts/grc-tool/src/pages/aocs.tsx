/**
 * @file aocs.tsx
 * @description Attestations of Compliance (AOCs) page (`/aocs`).
 *
 * Fetches all AOC documents and certification reports for the active entity via
 * `useListAocs` and renders them as a 2-column card grid. AOCs are entity-scoped
 * because each business unit has its own PCI DSS compliance certification cycle.
 *
 * Each AOC card displays:
 *   - **Status badge** – "current" → default (blue), others → secondary (muted).
 *   - **Framework code chip** – monospace badge in the top-right corner.
 *   - **AOC title** with a ShieldCheck icon (primary colour for "current" AOCs,
 *     muted for all others).
 *   - **Issued and expiry dates** formatted to "MMM d, yyyy" using `date-fns`.
 *     The expiry date is rendered in `text-primary font-bold` for "current" AOCs
 *     to draw attention to the validity window.
 *   - **QSA / assessor company** — falls back to "Internal Assessment" when the
 *     audit was performed by the entity's own security team.
 *   - **Compliance result** — "Compliant" gets a green text treatment;
 *     all other values are rendered neutrally.
 *   - **Summary stats bar** — controls evaluated count, findings count, and
 *     assessment period in a 3-column muted stats row.
 *   - **Action buttons** — "Download PDF" and "View Report" (UI stubs).
 *
 * Visual treatment for "current" AOCs:
 *   - Primary-tinted card border (`border-primary/50`).
 *   - A decorative radial gradient accent in the top-right corner (`bg-primary/5
 *     rounded-bl-full`). The accent uses `position: absolute` and `-z-10` to sit
 *     behind the card content without affecting layout.
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
 *
 * AOC data is entity-scoped: each business unit has its own certification
 * history. The `entityCode` is embedded in the React Query cache key so
 * switching entities loads the correct AOC history.
 *
 * @returns The AOCs & Reports page JSX including the page header and the
 *          loading/error/2-column card grid content area.
 */
export default function Aocs() {
  // Read the active entity from context to scope the API request.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch all AOC documents for the active entity.
   *
   * React Query wiring:
   * - `entityCode: activeEntity` scopes the API response.
   * - `queryKey: getListAocsQueryKey({ entityCode: activeEntity })` → key like
   *   `["listAocs", { entityCode: "gopuff" }]`. Each entity's AOC history is
   *   cached independently; switching entities fetches the new entity's AOCs
   *   while keeping the previous entity's data available in the background cache.
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
        {/* "Upload Document" is a UI stub — no upload handler wired yet. */}
        <Button>Upload Document</Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content: skeleton / error / 2-column card grid                      */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        /* 4 card-shaped skeletons in a 2-column layout while the AOCs load. */
        <CardGridSkeleton count={4} cols={2} />
      ) : isError ? (
        /* Fetch failed: block-mode QueryError with a card border wrapper. */
        <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
      ) : (
        /* 2-column grid: collapses to 1 column below `xl` breakpoint. */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {aocs?.map((aoc) => (
            <Card
              key={aoc.id}
              className={cn(
                "flex flex-col shadow-sm relative overflow-hidden",
                // Current AOCs get a primary-tinted border to distinguish them
                // from expired or pending AOCs at a glance.
                aoc.status === 'current' ? 'border-primary/50' : ''
              )}
            >
              {/* Decorative radial gradient accent — only shown for current AOCs.
                  Positioned absolutely in the top-right corner using a negative
                  z-index (-z-10) so it renders behind the card content.
                  `overflow-hidden` on the Card clips the overflow of this element. */}
              {aoc.status === 'current' && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />
              )}

              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  {/* Status badge:
                      - "current" → `variant="default"` (primary blue)
                      - others    → `variant="secondary"` (muted grey) */}
                  <Badge variant={aoc.status === 'current' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                    {aoc.status}
                  </Badge>
                  {/* Framework code chip: monospace, muted border, small text.
                      Positioned at the top-right for quick framework identification. */}
                  <div className="font-mono text-xs font-bold text-muted-foreground border border-border px-2 py-1 rounded bg-muted/20">
                    {aoc.frameworkCode}
                  </div>
                </div>
                <CardTitle className="text-xl leading-tight flex gap-2 items-center">
                  {/* ShieldCheck icon: primary colour for "current" (healthy/valid),
                      muted for expired/pending to reflect the AOC's validity state. */}
                  <ShieldCheck className={cn("h-5 w-5", aoc.status === 'current' ? "text-primary" : "text-muted-foreground")} />
                  {aoc.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 pb-4">
                {/* 2×2 detail grid: issued date, expiry, QSA company, result. */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Issued Date
                      </div>
                      <div className="font-mono text-sm">
                        {/* Format ISO date to "MMM d, yyyy" or "Pending" when absent
                            (e.g. an AOC that is in progress but not yet finalised). */}
                        {aoc.issuedDate ? format(new Date(aoc.issuedDate), 'MMM d, yyyy') : 'Pending'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Expiry Date
                      </div>
                      {/* Expiry date is bold/primary for current AOCs to draw attention
                          to the approaching validity deadline; neutral for others. */}
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
                        {/* Fall back to "Internal Assessment" when the audit was
                            performed by the entity's own team rather than a QSA firm. */}
                        {aoc.qsaCompany || 'Internal Assessment'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <FileSignature className="h-3 w-3" /> Result
                      </div>
                      <div className="text-sm">
                        {/* "Compliant" result gets emerald green text to reinforce
                            the positive outcome. Other results (e.g. "Non-Compliant",
                            "Pending") are rendered without special styling. */}
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
                
                {/* Summary stats bar: a compact 3-column muted panel showing
                    quantitative assessment metrics for quick comparison. */}
                <div className="bg-muted/30 rounded p-3 text-sm flex justify-between items-center border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">Controls Evaluated</span>
                    {/* Font-mono for digit alignment across cards. */}
                    <span className="font-mono font-bold">{aoc.controlsCovered || 0}</span>
                  </div>
                  {/* Vertical divider between stats columns. */}
                  <div className="w-px h-8 bg-border"></div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">Findings</span>
                    <span className="font-mono font-bold">{aoc.findings || 0}</span>
                  </div>
                  <div className="w-px h-8 bg-border"></div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">Period</span>
                    {/* Falls back to "Annual" when the period field is not set. */}
                    <span className="font-mono font-bold">{aoc.period || 'Annual'}</span>
                  </div>
                </div>
              </CardContent>

              {/* Card footer: download and view report buttons.
                  Both are UI stubs — no file download or navigation handler wired. */}
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
          {/* Empty state: no AOCs or reports exist for this entity.
              Spans both grid columns so the message fills the full width. */}
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
