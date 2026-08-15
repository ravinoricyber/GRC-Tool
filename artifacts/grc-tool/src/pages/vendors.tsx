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

export default function Vendors() {
  const { activeEntity } = useEntity();
  
  const { data: vendors, isLoading, isError, error, refetch } = useListVendors(
    { entityCode: activeEntity },
    { query: { queryKey: getListVendorsQueryKey({ entityCode: activeEntity }) } }
  );

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-slate-500 text-white';
      default: return 'bg-slate-500 text-white';
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

      {isLoading ? (
        <CardGridSkeleton count={3} cols={3} />
      ) : isError ? (
        <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors?.map((vendor) => (
            <Card key={vendor.id} className="flex flex-col hover:border-primary/50 transition-colors shadow-sm">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                    {vendor.status}
                  </Badge>
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
                
                {vendor.hasPciCertification ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-3 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-900 mb-0.5">PCI DSS Certified</h4>
                      <p className="text-xs text-emerald-700 font-mono">
                        Expires: {vendor.certificationExpiry ? format(new Date(vendor.certificationExpiry), 'MMM d, yyyy') : 'Unknown'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 mb-0.5">No PCI Certification</h4>
                      <p className="text-xs text-amber-700">Requires additional scrutiny</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Next Review Date</span>
                      <span className="font-mono font-medium">
                        {vendor.nextReviewDate ? format(new Date(vendor.nextReviewDate), 'MMM d, yyyy') : 'Not scheduled'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Primary Contact</span>
                      <span className="font-medium truncate">{vendor.contactName || 'No contact'}</span>
                      {vendor.contactEmail && <span className="text-xs text-primary truncate">{vendor.contactEmail}</span>}
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
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
