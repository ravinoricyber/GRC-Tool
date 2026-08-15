/**
 * @file settings.tsx
 * @description Organization Settings page (`/settings`).
 *
 * Fetches the full entity record for the currently active entity via
 * `useGetEntity` and renders a two-panel settings layout:
 *
 *   Left panel  – Vertical navigation (Entity Profile, Compliance Config,
 *                 Integrations, API Keys). Currently only Entity Profile is
 *                 active; the others are visual stubs.
 *   Right panel – Two settings cards:
 *     1. Entity Profile  – Read-only entity name/code fields + editable legal name.
 *     2. PCI DSS Config  – Merchant level, SAQ type, and CDE scope definition.
 *
 * Loading behaviour:
 *   - The card description uses an inline `<Skeleton>` while data loads.
 *   - Each card's form area is replaced by `<FormSkeleton>` during loading.
 *   - `enabled: !!activeEntity` guards the query so it never fires with an
 *     empty entity code.
 *
 * Error state: `QueryError` block spanning the full right-panel column.
 */

import React from 'react';
import { useEntity } from '@/context/EntityContext';
import { useGetEntity, getGetEntityQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Building2, Server, Key } from 'lucide-react';
import { QueryError, FormSkeleton } from '@/components/query-states';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Organization Settings page component.
 * Loads the active entity's full record (including PCI DSS-specific fields)
 * and exposes form fields for editing.
 */
export default function Settings() {
  // Active entity code used both to scope the query and to guard it.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch the complete entity object for the active entity code.
   * `enabled: !!activeEntity` prevents the query from firing when the entity
   * code is an empty string (e.g. during initial render before context settles).
   */
  const { data: entityObj, isLoading, isError, error, refetch } = useGetEntity(activeEntity, {
    query: { enabled: !!activeEntity, queryKey: getGetEntityQueryKey(activeEntity) }
  });

  return (
    /* Max-width container for comfortable reading on wide screens. */
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">Configure entity details and system preferences.</p>
      </div>

      {/* 4-column grid: 1 col sidebar nav + 3 col content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* ---------------------------------------------------------------- */}
        {/* Left sidebar navigation                                           */}
        {/* Only "Entity Profile" is active; others are visual stubs.        */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col space-y-1">
          {/* Active nav item uses "secondary" variant for selected state. */}
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

        {/* ---------------------------------------------------------------- */}
        {/* Right content panel                                               */}
        {/* ---------------------------------------------------------------- */}
        <div className="md:col-span-3 space-y-6">
          {/* Show error spanning the full right panel on fetch failure. */}
          {isError ? (
            <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
          ) : (
            <>
              {/* -------------------------------------------------------------- */}
              {/* Card 1: Entity Profile                                          */}
              {/* -------------------------------------------------------------- */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Entity Profile</CardTitle>
                  <CardDescription>
                    {/* Show a skeleton in the description while entity name loads. */}
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
                      {/* Entity name is read-only (managed server-side). */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Entity Name</label>
                        <Input defaultValue={entityObj?.name || ''} disabled className="bg-muted/50" />
                      </div>
                      {/* Entity code is immutable — shown in monospace for clarity. */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Entity Code</label>
                        <Input defaultValue={entityObj?.code || ''} disabled className="bg-muted/50 font-mono" />
                      </div>
                      {/* Legal name spans both columns and is editable. */}
                      <div className="space-y-2 col-span-2">
                        <label className="text-sm font-medium">Legal Name</label>
                        <Input defaultValue={entityObj?.legalName || ''} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* -------------------------------------------------------------- */}
              {/* Card 2: PCI DSS Configuration                                   */}
              {/* -------------------------------------------------------------- */}
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
                        {/* Merchant Level (e.g. "Level 1", "Level 2"). */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Merchant Level</label>
                          <Input defaultValue={entityObj?.merchantLevel || ''} />
                        </div>
                        {/* SAQ type only applies to lower merchant levels. */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">SAQ Type (if applicable)</label>
                          <Input defaultValue={entityObj?.saqType || ''} />
                        </div>
                        {/* CDE scope spans both columns; free-form textarea. */}
                        <div className="space-y-2 col-span-2">
                          <label className="text-sm font-medium">CDE Scope Definition</label>
                          <textarea 
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={entityObj?.cdeScope || ''}
                          />
                        </div>
                      </div>
                      {/* Save button right-aligned, wired to a future submit handler. */}
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
