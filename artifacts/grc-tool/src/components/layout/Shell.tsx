/**
 * @file Shell.tsx
 * @description Persistent application chrome rendered on every route.
 *
 * The Shell is composed of three regions:
 *   1. **Sidebar** – Fixed-width left panel containing the app logo, an entity
 *      switcher (loaded via React Query), primary navigation links, a settings
 *      link, and a static user avatar.
 *   2. **Top Header** – Breadcrumb showing the active entity + current page, a
 *      global search input, and a "New Action" CTA button.
 *   3. **Page Content** – Scrollable main area where the active route renders.
 *
 * Entity switcher behaviour:
 * - `useListEntities` fetches the list of available business entities from the
 *   API. The query key is fully qualified via `getListEntitiesQueryKey()` so
 *   React Query caches it independently from any entity-scoped page queries.
 * - While loading it shows a `<Skeleton>` placeholder.
 * - On error it shows a tooltip-decorated "Unavailable" state with a retry button
 *   that calls `refetchEntities()` from React Query.
 * - Once loaded, a `<DropdownMenu>` lets users select their active entity. The
 *   current selection shows a `<Check>` icon inside the dropdown.
 *
 * Active-route highlighting:
 * - `useLocation()` from Wouter provides the current pathname.
 * - Each nav item's `isActive` flag uses a prefix match:
 *   `location === item.href || (item.href !== '/' && location.startsWith(item.href))`
 * - The special case for `'/'` prevents the Dashboard item from matching every
 *   route (since all paths start with `/`).
 * - Active items receive `bg-sidebar-accent text-sidebar-foreground`; inactive
 *   items receive a lower-opacity muted colour with a hover accent.
 *
 * Breadcrumb construction:
 * - Iterates `navItems` with the same prefix-match logic to find the label for
 *   the current route. Falls back to `"Page"` for unrecognised paths.
 * - Prefixes the page label with the human-readable entity name from the fetched
 *   entity list (falls back to `"..."` while loading).
 */

import React from 'react';
import { Link, useLocation } from 'wouter';
import { useEntity } from '@/context/EntityContext';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Library, 
  Files, 
  BookOpen, 
  ShieldCheck, 
  ClipboardCheck, 
  ListChecks, 
  Building2, 
  Activity, 
  Settings,
  Search,
  Plus,
  ChevronsUpDown,
  Check,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useListEntities, getListEntitiesQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Application shell component. Renders the persistent sidebar, top header, and
 * main content area on every route. This component is always mounted — it never
 * unmounts on route transitions, so sidebar state (e.g. entity selection) is
 * preserved across navigation.
 *
 * @param children - The active page component rendered in the main content area.
 *                   Provided by the `<Router>` in App.tsx as the matched route's
 *                   component tree.
 * @returns The full-viewport layout with sidebar, header, and page content.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  // Current pathname from Wouter. Used for active nav-item highlighting and
  // for the breadcrumb label in the top header.
  const [location] = useLocation();
  // Active entity code and its setter from global context.
  const { activeEntity, setActiveEntity } = useEntity();
  
  /**
   * Fetch all available business entities for the entity switcher dropdown.
   *
   * React Query wiring:
   * - `getListEntitiesQueryKey()` produces a stable, fully qualified cache key
   *   (`["listEntities"]`). This is important because page-level queries use
   *   entity-scoped keys (e.g. `["listControls", { entityCode: "gopuff" }]`),
   *   and we need the entities list to be cached independently.
   * - `isLoadingEntities`, `isErrorEntities`, and `refetchEntities` are
   *   destructured to drive the three render states in the sidebar.
   * - `data: entities = []` defaults to an empty array so `.find()` below is
   *   safe before the first successful fetch.
   */
  const { data: entities = [], isLoading: isLoadingEntities, isError: isErrorEntities, refetch: refetchEntities } = useListEntities(
    { query: { queryKey: getListEntitiesQueryKey() } }
  );
  
  // Resolve the full entity object for the currently active entity code so we
  // can show the human-readable name in the switcher button and the breadcrumb.
  // Returns `undefined` while the entity list is loading or on error.
  const currentEntityObj = entities.find(e => e.code === activeEntity);

  /**
   * Navigation items rendered in the sidebar primary nav.
   *
   * Each item pairs a route `href` with a Lucide icon component and a
   * human-readable label. Order in this array determines visual order in the
   * sidebar. The `href` values match the route paths defined in `App.tsx`.
   */
  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/frameworks', icon: Library, label: 'Frameworks' },
    { href: '/evidence', icon: Files, label: 'Evidence Queue' },
    { href: '/policies', icon: BookOpen, label: 'Policies' },
    { href: '/aocs', icon: ShieldCheck, label: 'AOCs & Reports' },
    { href: '/assessments', icon: ClipboardCheck, label: 'Assessments' },
    { href: '/controls', icon: ListChecks, label: 'Controls Library' },
    { href: '/vendors', icon: Building2, label: 'Vendors (TPSPs)' },
    { href: '/activity', icon: Activity, label: 'Activity Log' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                              */}
      {/* Fixed-width (256px) left panel. Uses flex-col so the footer (user   */}
      {/* avatar) always sits at the bottom regardless of nav item count.     */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-full flex-shrink-0">
        {/* App logo — Gopuff wordmark, always visible at the top of the sidebar. */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <img
            src="/gopuff-logo-1.png"
            alt="Gopuff"
            className="h-7 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Entity Switcher                                                   */}
        {/* Three conditional render states:                                  */}
        {/*   1. Loading  → skeleton placeholder (matches button height)      */}
        {/*   2. Error    → non-interactive "Unavailable" chip + retry button  */}
        {/*   3. Loaded   → fully operational DropdownMenu                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Business Entity</div>
          {isLoadingEntities ? (
            /* Show a placeholder while the entity list is being fetched.
               Height (h-9) matches the DropdownMenu trigger button so the
               sidebar layout does not shift when data arrives. */
            <Skeleton className="h-9 w-full rounded-md" />
          ) : isErrorEntities ? (
            /* API call failed: show a non-interactive error indicator with
               a Radix tooltip explaining the situation, and a retry button
               that calls `refetchEntities()` from React Query. The flex
               layout keeps the error chip and retry button side-by-side. */
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1 flex items-center gap-1.5 rounded-md border border-destructive/50 bg-sidebar-accent px-3 py-2 text-sm opacity-80 cursor-not-allowed min-w-0">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="truncate text-destructive text-sm">Unavailable</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Could not load entities. Click retry to try again.</p>
                </TooltipContent>
              </Tooltip>
              {/* Retry button triggers a manual refetch of the entities query. */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetchEntities()}
                className="h-9 w-9 shrink-0 bg-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground"
                aria-label="Retry loading entities"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            /* Entities loaded: render the dropdown switcher.
               Selecting an item calls `setActiveEntity(entity.code)` which
               updates the EntityContext, causing all page-level queries to
               refetch with the new entityCode. */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between bg-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/80 hover:text-sidebar-foreground text-sidebar-foreground"
                >
                  {/* Display the full human-readable name if resolved, else fall
                      back to the raw entity code (e.g. "gopuff") while resolving. */}
                  <span className="truncate">{currentEntityObj?.name || activeEntity}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                {entities.map(entity => (
                  <DropdownMenuItem
                    key={entity.code}
                    onClick={() => setActiveEntity(entity.code)}
                    className="flex items-center justify-between"
                  >
                    {entity.name}
                    {/* Show a checkmark next to the currently active entity so
                        users know which one is selected at a glance. */}
                    {activeEntity === entity.code && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Primary Navigation                                                */}
        {/* `flex-1 overflow-y-auto` allows the nav to scroll independently  */}
        {/* if there are more items than fit in the viewport height.         */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              /**
               * Active state logic per nav item:
               *
               * - Exact match (`location === item.href`) handles the root `/`
               *   case so the Dashboard item is only highlighted on the exact
               *   root path.
               * - Prefix match (`location.startsWith(item.href)`) with the
               *   `item.href !== '/'` guard highlights parent items for nested
               *   routes (e.g. `/evidence/123` highlights "Evidence Queue").
               * - The `item.href !== '/'` guard is critical: without it, the
               *   Dashboard would match every route since every path starts with '/'.
               */
              const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    // Active: full accent background + full foreground colour.
                    // Inactive: muted opacity with hover accent on mouse over.
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Settings link + User identity footer                             */}
        {/* `mt-auto` pushes this section to the bottom of the flex column.  */}
        {/* ---------------------------------------------------------------- */}
        <div className="p-4 border-t border-sidebar-border mt-auto">
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground mb-4">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          {/* User identity block — Ravi Nori, Cybersecurity team. */}
          <div className="flex items-center gap-3 px-2">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">RN</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">Ravi Nori</span>
              <span className="text-xs text-sidebar-foreground/50">Cybersecurity</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content area                                                    */}
      {/* `flex-1 min-w-0` ensures this column takes all remaining width      */}
      {/* without overflowing its flex parent. `overflow-hidden` keeps the    */}
      {/* header from scrolling off-screen.                                   */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header: breadcrumb, global search, and "New Action" CTA. */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
             {/* Breadcrumb: "EntityName / PageLabel" derived from current route.
                 - EntityName comes from `currentEntityObj.name` (falls back to '...' while loading).
                 - PageLabel is found by matching `location` against `navItems` using
                   the same prefix-match logic as the active sidebar item. Falls
                   back to "Page" for any route not listed in navItems. */}
             <div className="text-sm text-muted-foreground font-medium breadcrumbs">
                {currentEntityObj?.name || '...'} <span className="mx-2">/</span> {navItems.find(i => location === i.href || (i.href !== '/' && location.startsWith(i.href)))?.label || 'Page'}
             </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Global search input — UI-only stub. The placeholder communicates
                what can be searched but the input is not yet wired to a handler.
                Full implementation would dispatch a search action or navigate
                to a search results route. */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search controls, evidence, policies..."
                className="h-9 w-64 md:w-80 rounded-md border border-input bg-background pl-9 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {/* "New Action" CTA — UI stub. Would open a command palette or
                creation dialog in a full implementation. */}
            <Button size="sm" className="gap-1.5 h-9">
              <Plus className="h-4 w-4" />
              New Action
            </Button>
          </div>
        </header>

        {/* Page Content: scrollable region that renders the active route.
            `overflow-auto` enables vertical scroll when page content exceeds
            the viewport height. `p-6` provides consistent padding around every
            page. The inner div caps content width at 7xl for readability. */}
        <div className="flex-1 overflow-auto bg-background p-6">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
