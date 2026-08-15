/**
 * @file vendors.tsx
 * @description Third-Party Vendors (TPSP) page (`/vendors`).
 *
 * Fetches all third-party service providers scoped to the active entity via
 * `useListVendors` and renders them as a responsive 3-column card grid.
 * Vendors are entity-scoped because each business unit manages its own supplier
 * relationships and performs its own vendor risk assessments independently.
 *
 * Each vendor card displays:
 *   - **Status badge** – "active" → default (blue), otherwise secondary (muted).
 *   - **Risk level badge** – colour-coded via {@link getRiskColor}:
 *       critical → red | high → orange | medium → amber | low → slate
 *   - Vendor name with a Building2 icon, and service type description.
 *   - **PCI DSS certification banner**:
 *       Certified    → Green banner with Shield icon, expiry date formatted to
 *                      "MMM d, yyyy" (or "Unknown" when expiry is absent).
 *       Not certified → Amber warning banner with ShieldAlert icon, requiring
 *                       additional scrutiny note.
 *   - **Next review date** formatted to "MMM d, yyyy", or "Not scheduled".
 *   - **Primary contact**: name + optional email (rendered in primary colour
 *     when present).
 *
 * Loading state: `CardGridSkeleton` (3 cards, 3 columns).
 * Error state:   `QueryError` block.
 * Empty state:   Dashed bordered message spanning all 3 columns.
 */

import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListVendors, getListVendorsQueryKey } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, ShieldAlert, Calendar, Mail, Shield, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryError, CardGridSkeleton } from '@/components/query-states';

/**
 * Third-Party Vendors (TPSP) page component.
 *
 * Vendor data is entity-scoped: each business unit maintains its own third-party
 * supplier list and risk assessments. The `entityCode` is embedded in the React
 * Query cache key so switching entities loads the correct vendor set.
 *
 * @returns The Vendors page JSX including the page header and the
 *          loading/error/3-column card grid content area.
 */
export default function Vendors() {
  // Active entity from context — passed as `entityCode` to the API and query key.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch all third-party vendors for the active entity.
   *
   * React Query wiring:
   * - `entityCode: activeEntity` scopes the API response to the current entity.
   * - `queryKey: getListVendorsQueryKey({ entityCode: activeEntity })` → key like
   *   `["listVendors", { entityCode: "gopuff" }]`. Each entity's vendor list is
   *   cached separately, so switching entities does not show another entity's
   *   suppliers while loading.
   */
  const { data: vendors, isLoading, isError, error, refetch } = useListVendors(
    { entityCode: activeEntity },
    { query: { queryKey: getListVendorsQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Maps a vendor risk level string to Tailwind background + text colour classes
   * for the risk badge. The colour convention follows a severity gradient:
   *   - critical → red-500    (immediate action required)
   *   - high     → orange-500 (elevated risk, monitoring needed)
   *   - medium   → amber-500  (standard due diligence)
   *   - low      → slate-500  (minimal risk, routine review)
   *   - default  → slate-500  (fallback for unexpected values)
   *
   * @param risk - The vendor's risk level string from the API.
   * @returns Tailwind background + text colour utility class string.
   */
  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high':     return 'bg-orange-500 text-white';
      case 'medium':   return 'bg-amber-500 text-white';
      case 'low':      return 'bg-slate-500 text-white';
      default:         return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Third-Party Vendors (TPSP)</h1>
          <p className="text-sm text-muted-foreground">Manage service providers and their compliance status.</p>
        </div>
        {/* "Add Vendor" is a UI stub — no creation handler wired yet. */}
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content: skeleton / error / vendor card grid                        */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        /* 3 card-shaped skeletons in a 3-column layout while the vendors load. */
        <CardGridSkeleton count={3} cols={3} />
      ) : isError ? (
        /* Fetch failed: block-mode QueryError with a card border wrapper. */
        <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
      ) : (
        /* 3-column grid: collapses to 2 on md, 1 on sm. */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors?.map((vendor) => (
            <Card key={vendor.id} className="flex flex-col hover:border-primary/50 transition-colors shadow-sm">
              {/* Card header: status + risk badges, vendor name, service type.
                  Uses `bg-muted/10` background to visually separate header from body. */}
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
                <div className="flex justify-between items-start mb-2">
                  {/* Status badge:
                      - "active"   → `variant="default"` (primary blue)
                      - others     → `variant="secondary"` (muted grey) */}
                  <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                    {vendor.status}
                  </Badge>
                  {/* Risk badge: solid colour via getRiskColor(), no border transparency.
                      The label includes " Risk" suffix (e.g. "high Risk") for clarity. */}
                  <Badge className={cn("uppercase text-[10px] tracking-wider border-transparent shadow-none", getRiskColor(vendor.riskLevel))}>
                    {vendor.riskLevel} Risk
                  </Badge>
                </div>
                <CardTitle className="text-xl flex items-center gap-2">
                  {/* Building2 icon anchors the vendor name visually. */}
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  {vendor.name}
                </CardTitle>
                {/* Service type description (e.g. "Payment Processing", "Cloud Hosting"). */}
                <CardDescription className="text-sm text-muted-foreground font-medium mt-1">
                  {vendor.serviceType}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 py-4 space-y-5">
                {/* -------------------------------------------------------- */}
                {/* PCI DSS certification banner                              */}
                {/* Conditional: shows a green banner when the vendor holds   */}
                {/* current PCI DSS certification, or an amber warning when  */}
                {/* they do not. This is the most important compliance signal. */}
                {/* -------------------------------------------------------- */}
                {vendor.hasPciCertification ? (
                  /* Green banner: vendor is PCI certified.
                     Shows certification expiry formatted to "MMM d, yyyy".
                     Falls back to "Unknown" when the expiry date is absent. */
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-3 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-900 mb-0.5">PCI DSS Certified</h4>
                      <p className="text-xs text-emerald-700 font-mono">
                        {/* Format ISO expiry date or fall back to "Unknown". */}
                        Expires: {vendor.certificationExpiry ? format(new Date(vendor.certificationExpiry), 'MMM d, yyyy') : 'Unknown'}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Amber warning banner: vendor lacks PCI certification.
                     Signals that additional scrutiny and compensating controls
                     are needed when using this vendor within the CDE. */
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 mb-0.5">No PCI Certification</h4>
                      <p className="text-xs text-amber-700">Requires additional scrutiny</p>
                    </div>
                  </div>
                )}

                {/* Review schedule and contact details. */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Next Review Date</span>
                      <span className="font-mono font-medium">
                        {/* Format ISO date to "MMM d, yyyy" or show "Not scheduled" when absent. */}
                        {vendor.nextReviewDate ? format(new Date(vendor.nextReviewDate), 'MMM d, yyyy') : 'Not scheduled'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Primary Contact</span>
                      {/* Contact name or "No contact" fallback. */}
                      <span className="font-medium truncate">{vendor.contactName || 'No contact'}</span>
                      {/* Contact email is optional — only rendered when present.
                          Rendered in primary colour to signal it is a clickable link
                          in a future implementation. */}
                      {vendor.contactEmail && <span className="text-xs text-primary truncate">{vendor.contactEmail}</span>}
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
          {/* Empty state: no vendors configured for this entity.
              Spans all 3 grid columns so the message fills the full width. */}
          {vendors?.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
              No vendors found for this entity.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
