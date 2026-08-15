/**
 * @file settings.tsx
 * @description Organization Settings page (`/settings`).
 *
 * Fetches the full entity record for the currently active entity via
 * `useGetEntity` and renders a two-panel settings layout:
 *
 *   **Left panel** (1/4 width on md+):
 *     Vertical navigation with four sections:
 *     - Entity Profile (active — fully implemented)
 *     - Compliance Config (stub — no content wired)
 *     - Integrations (stub — no content wired)
 *     - API Keys (stub — no content wired)
 *     The active item uses `variant="secondary"` for a selected appearance;
 *     inactive items use `variant="ghost"` for subtle hover feedback.
 *
 *   **Right panel** (3/4 width on md+):
 *     Two settings cards stacked vertically:
 *     1. **Entity Profile** – Read-only entity name and code (disabled inputs),
 *        plus an editable legal name field.
 *     2. **PCI DSS Configuration** – Merchant level, SAQ type, and a textarea
 *        for the CDE scope definition. A "Save Changes" button is present
 *        but not yet wired to a mutation handler.
 *
 * Loading behaviour:
 *   - The right panel card descriptions use an inline `<Skeleton>` component
 *     while data loads so the layout does not shift.
 *   - Each card's form area is replaced by `<FormSkeleton>` during loading
 *     (3 fields for Entity Profile, 4 fields for PCI DSS Config).
 *   - `enabled: !!activeEntity` guards the query so it never fires with an
 *     empty string `entityCode`. This prevents a spurious API call during
 *     the brief window before the EntityContext settles on its initial value.
 *
 * Error state: `QueryError` block spanning the full right-panel column (3/4
 *   width). The left navigation is still rendered during error so users can
 *   switch sections or navigate away.
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
 *
 * Loads the active entity's full record (including PCI DSS-specific fields:
 * `merchantLevel`, `saqType`, `cdeScope`) and exposes form fields for editing.
 * The entity name and code are read-only because those are managed server-side
 * and changing them would require cascading updates across all related records.
 *
 * @returns The Organization Settings page JSX including the 4-column grid
 *          layout with sidebar navigation and settings cards.
 */
export default function Settings() {
  // Active entity code used both to scope the query and to guard it.
  const { activeEntity } = useEntity();
  
  /**
   * Fetch the complete entity object for the active entity code.
   *
   * React Query wiring:
   * - `activeEntity` (a string like `"gopuff"`) is the path parameter.
   * - `enabled: !!activeEntity` prevents the query from firing if `activeEntity`
   *   is an empty string. This is a safe guard for the initial render cycle
   *   before the EntityContext has settled on a value.
   * - `queryKey: getGetEntityQueryKey(activeEntity)` → `["getEntity", "gopuff"]`.
   *   Switching entities changes the key, causing a new fetch for the new entity.
   * - The response includes entity-specific PCI DSS config fields (`merchantLevel`,
   *   `saqType`, `cdeScope`) in addition to the base `name`, `code`, `legalName`.
   */
  const { data: entityObj, isLoading, isError, error, refetch } = useGetEntity(activeEntity, {
    query: { enabled: !!activeEntity, queryKey: getGetEntityQueryKey(activeEntity) }
  });

  return (
    /* Max-width container for comfortable reading on wide screens.
       `max-w-5xl` is slightly narrower than the Shell's `max-w-7xl` since
       settings forms do not benefit from full-width display. */
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">Configure entity details and system preferences.</p>
      </div>

      {/* 4-column grid: 1-column sidebar nav + 3-column content panel. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* ---------------------------------------------------------------- */}
        {/* Left sidebar navigation (1/4 width on md+)                       */}
        {/* Only "Entity Profile" is active; others are visual stubs for     */}
        {/* future sections. `justify-start` aligns icon + label left.       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col space-y-1">
          {/* Active nav item uses "secondary" variant for a selected background. */}
          <Button variant="secondary" className="justify-start gap-2 h-9 px-3 text-left">
            <Building2 className="h-4 w-4" /> Entity Profile
          </Button>
          {/* Inactive items use "ghost" variant — hover shows a subtle background. */}
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
        {/* Right content panel (3/4 width on md+)                           */}
        {/* Shows QueryError spanning the full panel on fetch failure.        */}
        {/* On success shows two cards: Entity Profile + PCI DSS Config.     */}
        {/* ---------------------------------------------------------------- */}
        <div className="md:col-span-3 space-y-6">
          {/* Error state: spans the full right panel. Left nav is still rendered
              so users can try other sections or navigate away from the page. */}
          {isError ? (
            <QueryError error={error} onRetry={refetch} className="rounded-lg border bg-card" />
          ) : (
            <>
              {/* -------------------------------------------------------------- */}
              {/* Card 1: Entity Profile                                          */}
              {/* Shows name, code (both read-only), and editable legal name.    */}
              {/* -------------------------------------------------------------- */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Entity Profile</CardTitle>
                  <CardDescription>
                    {/* While loading: render a skeleton in the description slot so the
                        card header height is stable and doesn't shift when text arrives. */}
                    {isLoading
                      ? <Skeleton className="h-4 w-56 mt-1" />
                      : `Manage legal details and metadata for ${entityObj?.name || 'this entity'}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    /* 3 label+input skeleton rows while entity data is loading. */
                    <FormSkeleton fields={3} />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Entity name: read-only (disabled) with muted background.
                          Managed server-side; changing it requires a separate admin
                          process to update all downstream references. */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Entity Name</label>
                        <Input defaultValue={entityObj?.name || ''} disabled className="bg-muted/50" />
                      </div>
                      {/* Entity code: immutable identifier. Monospace font helps auditors
                          match this code to API references and report headers. */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Entity Code</label>
                        <Input defaultValue={entityObj?.code || ''} disabled className="bg-muted/50 font-mono" />
                      </div>
                      {/* Legal name: editable; spans both grid columns for full width.
                          Used in formal compliance documents and AOC reports. */}
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
              {/* Merchant level, SAQ type, and CDE scope definition.             */}
              {/* -------------------------------------------------------------- */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>PCI DSS Configuration</CardTitle>
                  <CardDescription>Specific details for PCI DSS assessment scope.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    /* 4 label+input skeleton rows while entity data is loading. */
                    <FormSkeleton fields={4} />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Merchant Level: e.g. "Level 1" (>6M Visa transactions/year).
                            Determines whether a full QSA assessment or a SAQ is required. */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Merchant Level</label>
                          <Input defaultValue={entityObj?.merchantLevel || ''} />
                        </div>
                        {/* SAQ Type: only applicable to lower merchant levels (L2–L4).
                            e.g. "SAQ-A", "SAQ-D". Empty for Level 1 merchants who
                            must undergo a full QSA assessment. */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">SAQ Type (if applicable)</label>
                          <Input defaultValue={entityObj?.saqType || ''} />
                        </div>
                        {/* CDE Scope Definition: free-form textarea describing which
                            systems, networks, and components are in scope for PCI DSS.
                            Spans both columns for maximum editing space. */}
                        <div className="space-y-2 col-span-2">
                          <label className="text-sm font-medium">CDE Scope Definition</label>
                          <textarea 
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={entityObj?.cdeScope || ''}
                          />
                        </div>
                      </div>
                      {/* Save button: right-aligned via `flex justify-end`.
                          Currently a UI stub — no mutation handler is wired.
                          A full implementation would call `useUpdateEntity` here. */}
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
