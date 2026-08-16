/**
 * @file policies.tsx
 * @description Policy Repository page (`/policies`).
 *
 * Fetches all governance and compliance policies for the active entity via
 * `useListPolicies` and renders them in a scrollable table. Policies are
 * entity-scoped because each business unit maintains its own document library
 * and review schedule.
 *
 * Table columns:
 *   ☐ | ID | Name | Version | Status | Frameworks (badges) | Owner | Next Review | Actions
 *
 * UI features:
 *   - **Row selection**: Each row has a checkbox. The header checkbox selects /
 *     deselects all visible rows. Selected IDs are tracked in `selectedIds` state.
 *   - **Bulk Delete**: When ≥1 row is selected a destructive button appears in
 *     the header. Clicking it opens an `AlertDialog` confirmation before issuing
 *     `DELETE /api/policies/bulk` with the selected IDs.
 *   - **Bulk Import**: An "Import" button opens a `Dialog` containing:
 *       - A JSON textarea where the user pastes or edits a policy array.
 *       - A "Download Template" link that generates a filled JSON example.
 *       - A "Preview" count so the user knows how many records will be inserted.
 *       - A "Import N Policies" submit button that posts to `POST /api/policies/bulk-import`.
 *   - **Status badge variant mapping**:
 *       "current"    → emerald green (inline style override on the default badge)
 *       "review-due" → `variant="secondary"` (amber/yellow)
 *       "overdue"    → `variant="destructive"` (red)
 *       other        → `variant="outline"` (neutral)
 *   - **Framework tags**: each framework code rendered as a small monospace
 *     outline badge so auditors see at a glance which frameworks a policy covers.
 *   - **Review date**: formatted to "MMM d, yyyy" using `date-fns format`.
 *     Shows a dash when `reviewDate` is null/undefined.
 *
 * Loading state: `TableBodySkeleton` (8 rows, 9 columns).
 * Error state:   `QueryError` rendered as a table row.
 * Empty state:   Single row with a centred message.
 */

import React, { useState, useCallback } from 'react';
import { useEntity } from '@/context/EntityContext';
import { useListPolicies, getListPoliciesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Plus, FileEdit, Upload, Trash2, Download, AlertTriangle } from 'lucide-react';
import { QueryError, TableBodySkeleton } from '@/components/query-states';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Template — shown in the import dialog and downloadable as a .json file
// ---------------------------------------------------------------------------

/**
 * JSON template string shown in the import textarea by default.
 * Demonstrates all required and optional fields. Users paste over this with
 * their real data, or download it to fill in offline.
 */
const IMPORT_TEMPLATE = JSON.stringify(
  [
    {
      code:          "POL-017",
      name:          "Remote Work Security Policy",
      owner:         "CISO",
      version:       "1.0",
      status:        "current",
      effectiveDate: "2025-01-01",
      reviewDate:    "2026-01-01",
      frameworks:    ["pci-dss-4", "soc2-t2"],
      entities:      ["gopuff", "bevmo", "liquorbarn"],
      description:   "Controls for securing remote employee access to corporate systems.",
      pages:         8,
    },
  ],
  null,
  2
);

// ---------------------------------------------------------------------------
// Helper: determine the next available POL-NNN code
// ---------------------------------------------------------------------------

/**
 * Parses existing policy codes (e.g. "POL-014") and returns the next code
 * (e.g. "POL-015"). Falls back to "POL-001" when no existing codes are found.
 *
 * @param existingCodes - Array of `code` strings from loaded policies.
 * @returns Next sequential code string, zero-padded to 3 digits.
 */
function nextPolicyCode(existingCodes: string[]): string {
  const nums = existingCodes
    .map(c => parseInt(c.replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `POL-${String(max + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * Policy Repository page component.
 *
 * Policies are entity-scoped: each business unit maintains its own set of
 * governance documents and review cycles. The `entityCode` is embedded in the
 * React Query cache key so switching entities fetches the correct policy set.
 *
 * @returns The Policy Repository page JSX including the viewport-height table
 *          layout, loading/error/data states, and bulk action toolbar.
 */
export default function Policies() {
  const { activeEntity } = useEntity();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Server state ──────────────────────────────────────────────────────────

  const { data: policies = [], isLoading, isError, error, refetch } = useListPolicies(
    { entityCode: activeEntity },
    { query: { queryKey: getListPoliciesQueryKey({ entityCode: activeEntity }) } }
  );

  // ── Local UI state ────────────────────────────────────────────────────────

  /** Set of policy UUIDs currently checked in the table. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /** Whether the bulk-delete AlertDialog is open. */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  /** Whether the import Dialog is open. */
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  /** Raw JSON text the user has typed or pasted in the import textarea. */
  const [importJson, setImportJson] = useState(IMPORT_TEMPLATE);

  /** `true` while a bulk-import or bulk-delete network request is in flight. */
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Selection helpers ─────────────────────────────────────────────────────

  /**
   * Toggles a single policy's membership in `selectedIds`.
   *
   * @param id - The policy UUID to toggle.
   */
  const toggleOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  /**
   * Selects all loaded policies, or deselects all if every row is already
   * selected (toggle-all behaviour matching most data-table conventions).
   */
  const toggleAll = useCallback(() => {
    if (selectedIds.size === policies.length && policies.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(policies.map(p => p.id)));
    }
  }, [selectedIds.size, policies]);

  const allSelected = policies.length > 0 && selectedIds.size === policies.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // ── Bulk delete ───────────────────────────────────────────────────────────

  /**
   * Issues `DELETE /api/policies/bulk` with the currently selected IDs.
   * On success, clears selection and invalidates the React Query cache so the
   * table refetches without the deleted rows.
   */
  async function handleBulkDelete() {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/policies/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server responded ${res.status}`);
      }
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      await queryClient.invalidateQueries({
        queryKey: getListPoliciesQueryKey({ entityCode: activeEntity }),
      });
      toast({ title: `${count} ${count === 1 ? 'policy' : 'policies'} deleted` });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Bulk import ───────────────────────────────────────────────────────────

  /**
   * Parses `importJson` as a JSON array. Returns the parsed array on success
   * or `null` when the text is not valid JSON or is not an array.
   *
   * Used both to drive the live "N records" preview count in the dialog and
   * to validate the payload before submission.
   */
  function parsedImport(): unknown[] | null {
    try {
      const val = JSON.parse(importJson);
      return Array.isArray(val) ? val : null;
    } catch {
      return null;
    }
  }

  /**
   * Posts the parsed import array to `POST /api/policies/bulk-import`.
   * On success, closes the dialog, resets the textarea to the template, and
   * invalidates the policies cache so new rows appear immediately.
   */
  async function handleImport() {
    const records = parsedImport();
    if (!records) {
      toast({ title: 'Invalid JSON', description: 'The input must be a valid JSON array.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/policies/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies: records }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Server responded ${res.status}`);
      setImportDialogOpen(false);
      setImportJson(IMPORT_TEMPLATE);
      await queryClient.invalidateQueries({
        queryKey: getListPoliciesQueryKey({ entityCode: activeEntity }),
      });
      toast({ title: `${body.inserted} ${body.inserted === 1 ? 'policy' : 'policies'} imported` });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Triggers a browser download of the current import template as a `.json`
   * file so the user can fill it in offline and paste it back.
   *
   * Uses `nextPolicyCode` to pre-fill the `code` field with the next logical
   * sequential code given what's already in the table.
   */
  function downloadTemplate() {
    const nextCode = nextPolicyCode(policies.map(p => p.code));
    const template = JSON.stringify(
      [{ ...JSON.parse(IMPORT_TEMPLATE)[0], code: nextCode }],
      null,
      2
    );
    const blob = new Blob([template], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'policies-import-template.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const parsed = parsedImport();
  const importCount = parsed?.length ?? 0;

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Policy Repository</h1>
          <p className="text-sm text-muted-foreground">Centralized documentation for governance and compliance.</p>
        </div>

        {/* Action buttons — right-aligned */}
        <div className="flex items-center gap-2">
          {/* Bulk-delete button: only visible when ≥1 row is selected */}
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete {selectedIds.size} selected
            </Button>
          )}

          {/* Bulk import */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>

          {/* Single-policy create (stub) */}
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New Policy
          </Button>
        </div>
      </div>

      {/* ── Policies table ───────────────────────────────────────────────── */}
      <div className="rounded-md border bg-card flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left dense-table">
            <thead className="sticky top-0 bg-muted/50 z-10 shadow-sm">
              <tr>
                {/* Select-all checkbox */}
                <th className="w-10 px-3">
                  <Checkbox
                    checked={allSelected}
                    // `indeterminate` state when only some rows are selected
                    ref={(el) => {
                      if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected;
                    }}
                    onCheckedChange={toggleAll}
                    aria-label="Select all policies"
                    disabled={isLoading || isError}
                  />
                </th>
                <th className="w-24">ID</th>
                <th>Name</th>
                <th className="w-24">Version</th>
                <th className="w-32">Status</th>
                <th className="w-40">Frameworks</th>
                <th className="w-32">Owner</th>
                <th className="w-32">Next Review</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableBodySkeleton columns={9} rows={8} />
              ) : isError ? (
                <QueryError error={error} onRetry={refetch} asTableRow colSpan={9} />
              ) : (
                <>
                  {policies.map((policy) => {
                    const isSelected = selectedIds.has(policy.id);
                    return (
                      <tr
                        key={policy.id}
                        className={cn(
                          "group cursor-pointer",
                          isSelected && "bg-primary/5"
                        )}
                        onClick={() => toggleOne(policy.id)}
                      >
                        {/* Row checkbox — stops propagation so clicking the
                            checkbox itself doesn't also trigger the row click */}
                        <td className="px-3" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(policy.id)}
                            aria-label={`Select ${policy.name}`}
                          />
                        </td>
                        <td className="font-mono text-xs">{policy.code}</td>
                        <td className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            {policy.name}
                          </div>
                        </td>
                        <td className="font-mono text-xs">v{policy.version}</td>
                        <td>
                          <Badge
                            variant={
                              policy.status === 'current'    ? 'default' :
                              policy.status === 'review-due' ? 'secondary' :
                              policy.status === 'overdue'    ? 'destructive' : 'outline'
                            }
                            className="uppercase text-[10px] tracking-wider"
                            style={
                              policy.status === 'current'
                                ? { backgroundColor: 'rgba(16,185,129,0.1)', color: 'rgb(16,185,129)', borderColor: 'rgba(16,185,129,0.2)' }
                                : undefined
                            }
                          >
                            {policy.status.replace('-', ' ')}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {policy.frameworks?.map(fw => (
                              <Badge key={fw} variant="outline" className="text-[10px] font-mono py-0 px-1.5 bg-background">
                                {fw}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="text-muted-foreground">{policy.owner}</td>
                        <td className="font-mono text-xs text-muted-foreground">
                          {policy.reviewDate ? format(new Date(policy.reviewDate), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="text-right" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <FileEdit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {policies.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-muted-foreground">
                        No policies found.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Selection status bar — only shown when rows are selected */}
        {selectedIds.size > 0 && (
          <div className="border-t px-4 py-2 bg-primary/5 flex items-center justify-between text-sm shrink-0">
            <span className="text-muted-foreground">
              {selectedIds.size} of {policies.length} {policies.length === 1 ? 'policy' : 'policies'} selected
            </span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* ── Bulk-delete confirmation dialog ──────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete {selectedIds.size} {selectedIds.size === 1 ? 'policy' : 'policies'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected {selectedIds.size === 1 ? 'policy record' : 'policy records'} from
              the database. Evidence requests or framework mappings that reference these
              policies may be left with orphaned references. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              onClick={handleBulkDelete}
            >
              {isSubmitting ? 'Deleting…' : `Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'policy' : 'policies'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk-import dialog ───────────────────────────────────────────── */}
      <Dialog open={importDialogOpen} onOpenChange={v => { setImportDialogOpen(v); if (!v) setImportJson(IMPORT_TEMPLATE); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Policies</DialogTitle>
            <DialogDescription>
              Paste a JSON array of policy objects below. Each object must include{' '}
              <code className="font-mono text-xs bg-muted px-1 rounded">code</code>,{' '}
              <code className="font-mono text-xs bg-muted px-1 rounded">name</code>,{' '}
              <code className="font-mono text-xs bg-muted px-1 rounded">owner</code>, and{' '}
              <code className="font-mono text-xs bg-muted px-1 rounded">version</code>.
              IDs are assigned by the server.
            </DialogDescription>
          </DialogHeader>

          {/* Template download link */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {parsed
                ? <span className="text-foreground font-medium">{importCount} {importCount === 1 ? 'record' : 'records'} ready to import</span>
                : <span className="text-destructive">Invalid JSON — fix before importing</span>
              }
            </span>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" />
              Download template
            </Button>
          </div>

          {/* JSON textarea */}
          <textarea
            className={cn(
              "w-full h-72 font-mono text-xs rounded-md border bg-muted/30 p-3 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              !parsed && importJson.trim() !== '' && "border-destructive focus-visible:ring-destructive"
            )}
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
            placeholder="Paste JSON array here…"
            spellCheck={false}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setImportDialogOpen(false); setImportJson(IMPORT_TEMPLATE); }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!parsed || importCount === 0 || isSubmitting}
            >
              {isSubmitting ? 'Importing…' : `Import ${importCount > 0 ? importCount : ''} ${importCount === 1 ? 'policy' : 'policies'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
