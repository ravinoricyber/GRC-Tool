import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useGetEntity, getGetEntityQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Building2, Server, Key } from 'lucide-react';
import { QueryError, FormSkeleton } from '@/components/query-states';
import { Skeleton } from '@/components/ui/skeleton';

export default function Settings() {
  const { activeEntity } = useEntity();
  
  const { data: entityObj, isLoading, isError, error, refetch } = useGetEntity(activeEntity, {
    query: { enabled: !!activeEntity, queryKey: getGetEntityQueryKey(activeEntity) }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">Configure entity details and system preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="flex flex-col space-y-1">
          <Button variant="secondary" className="justify-start gap-2 h-9 px-3 text-left">
            <Building2 className="h-4 w-4" /> Entity Profile
          </Button>
          <Button variant="ghost" className="justify-start gap-2 h-9 px-3 text-left font-normal">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Compliance Config
          </Button>
          <Button variant="ghost" className="justify-start gap-2 h-9 px-3 text-left font-normal">
            <Server className="h-4 w-4 text-muted-foreground" /> Integrations
          </Button>
          <Button variant="ghost" className="justify-start gap-2 h-9 px-3 text-left font-normal">
            <Key className="h-4 w-4 text-muted-foreground" /> API Keys
          </Button>
        </div>

        {/* Content */}
        <div className="md:col-span-3 space-y-6">
          {isError ? (
            <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
          ) : (
            <>
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Entity Profile</CardTitle>
                  <CardDescription>
                    {isLoading
                      ? <Skeleton className="h-4 w-56 mt-1" />
                      : `Manage legal details and metadata for ${entityObj?.name || 'this entity'}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <FormSkeleton fields={3} />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Entity Name</label>
                        <Input defaultValue={entityObj?.name || ''} disabled className="bg-muted/50" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Entity Code</label>
                        <Input defaultValue={entityObj?.code || ''} disabled className="bg-muted/50 font-mono" />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <label className="text-sm font-medium">Legal Name</label>
                        <Input defaultValue={entityObj?.legalName || ''} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>PCI DSS Configuration</CardTitle>
                  <CardDescription>Specific details for PCI DSS assessment scope.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <FormSkeleton fields={4} />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Merchant Level</label>
                          <Input defaultValue={entityObj?.merchantLevel || ''} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">SAQ Type (if applicable)</label>
                          <Input defaultValue={entityObj?.saqType || ''} />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <label className="text-sm font-medium">CDE Scope Definition</label>
                          <textarea 
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={entityObj?.cdeScope || ''}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-4">
                        <Button>Save Changes</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
