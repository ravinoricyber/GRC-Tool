/**
 * @file vendors.tsx
 * @description Third-Party Vendors (TPSP) page (`/vendors`).
 *
 * Fetches all third-party service providers scoped to the active entity via
 * `useListVendors` and renders them as a responsive card grid.
 *
 * Each vendor card displays:
 *   - Status badge (active / inactive) and risk-level badge (colour-coded)
 *   - Vendor name, service type description
 *   - PCI DSS certification status banner (green if certified, amber if not)
 *     with certification expiry date when applicable
 *   - Next review date and primary contact details
 *
 * Risk level colour mapping (via `getRiskColor`):
 *   critical → red | high → orange | medium → amber | low → slate
 *
 * Loading state: `CardGridSkeleton` (3 cards, 3 columns).
 * Error state:   `QueryError` block.
 * Empty state:   Dashed bordered message spanning 3 columns.
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
 * Vendors (TPSP) page component.
 * Vendors are entity-scoped: each business unit manages its own supplier list.
 */
export default function Vendors() {
  // Active entity drives the entityCode parameter on the API request.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch all third-party vendors for the active entity.
   * The query key includes `entityCode` so the cache is invalidated on entity
   * switch and each entity's vendor list is stored independently.
   */
  const { data: vendors, isLoading, isError, error, refetch } = useListVendors(
    { entityCode: activeEntity },
    { query: { queryKey: getListVendorsQueryKey({ entityCode: activeEntity }) } }
  );

  /**
   * Maps a vendor risk level string to Tailwind background + text colour classes
   * for the risk badge.
   *
   * @param risk - The vendor's risk level string from the API.
   * @returns Tailwind utility class string.
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
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content: skeleton / error / vendor card grid                        */}
      {/* ------------------------------------------------------------------ */}
      {isLoading ? (
        <CardGridSkeleton count={3} cols={3} />
      ) : isError ? (
        <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors?.map((vendor) => (
            <Card key={vendor.id} className="flex flex-col hover:border-primary/50 transition-colors shadow-sm">
              {/* Card header: status + risk badges, vendor name and service type. */}
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
                <div className="flex justify-between items-start mb-2">
                  {/* Status badge: default for active, secondary for inactive. */}
                  <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                    {vendor.status}
                  </Badge>
                  {/* Risk badge: colour driven by getRiskColor(). */}
                  <Badge className={cn("uppercase text-[10px] tracking-wider border-transparent shadow-none", getRiskColor(vendor.riskLevel))}>
                    {vendor.riskLevel} Risk
                  </Badge>
                </div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  {vendor.name}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground font-medium mt-1">
                  {vendor.serviceType}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 py-4 space-y-5">
                {/* -------------------------------------------------------- */}
                {/* PCI DSS certification banner                              */}
                {/* Green banner when certified, amber warning when not.      */}
                {/* -------------------------------------------------------- */}
                {vendor.hasPciCertification ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-3 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-900 mb-0.5">PCI DSS Certified</h4>
                      <p className="text-xs text-emerald-700 font-mono">
                        {/* Format certification expiry or fall back to "Unknown". */}
                        Expires: {vendor.certificationExpiry ? format(new Date(vendor.certificationExpiry), 'MMM d, yyyy') : 'Unknown'}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Amber warning: vendor lacks PCI certification. */
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 mb-0.5">No PCI Certification</h4>
                      <p className="text-xs text-amber-700">Requires additional scrutiny</p>
                    </div>
                  </div>
                )}

                {/* Contact details and review schedule. */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Next Review Date</span>
                      <span className="font-mono font-medium">
                        {/* Format ISO date or show "Not scheduled" when absent. */}
                        {vendor.nextReviewDate ? format(new Date(vendor.nextReviewDate), 'MMM d, yyyy') : 'Not scheduled'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Primary Contact</span>
                      <span className="font-medium truncate">{vendor.contactName || 'No contact'}</span>
                      {/* Contact email is optional — only rendered when present. */}
                      {vendor.contactEmail && <span className="text-xs text-primary truncate">{vendor.contactEmail}</span>}
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
          {/* Empty state: no vendors configured for this entity. */}
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
