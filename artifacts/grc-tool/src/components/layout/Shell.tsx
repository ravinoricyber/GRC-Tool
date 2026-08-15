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
 * The entity switcher uses `useListEntities` to fetch available business
 * entities from the API. While loading it shows a skeleton; on error it shows
 * a tooltip-decorated error state with a retry button.
 *
 * Active-route highlighting compares `useLocation()` against each nav item's
 * `href` using a prefix match (so `/frameworks/detail` still highlights the
 * Frameworks item), with a special case for `/` to prevent it matching all routes.
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
 * Application shell component wrapping every page with the sidebar and header.
 *
 * @param children - The active page component rendered in the main content area.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  // Current pathname used to compute active nav-item highlighting.
  const [location] = useLocation();
  // Active entity code and its setter from global context.
  const { activeEntity, setActiveEntity } = useEntity();
  
  /**
   * Fetch all available business entities for the entity switcher dropdown.
   * Query key is fully qualified so React Query caches the result independently
   * from any entity-scoped queries on individual pages.
   */
  const { data: entities = [], isLoading: isLoadingEntities, isError: isErrorEntities, refetch: refetchEntities } = useListEntities(
    { query: { queryKey: getListEntitiesQueryKey() } }
  );
  
  // Resolve the full entity object for the currently active entity code so we
  // can show the human-readable name in the switcher button and breadcrumb.
  const currentEntityObj = entities.find(e => e.code === activeEntity);

  /** Navigation items rendered in the sidebar. Order determines visual order. */
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
      {/* ------------------------------------------------------------------ */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-full flex-shrink-0">
        {/* App logo / wordmark */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border gap-2 text-sidebar-primary">
          <ShieldCheck className="h-6 w-6" />
          <span className="font-bold tracking-tight text-sidebar-foreground">Compliance OS</span>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Entity Switcher                                                   */}
        {/* Three conditional render states: loading skeleton, error with    */}
        {/* retry button, or a fully operational dropdown.                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Business Entity</div>
          {isLoadingEntities ? (
            /* Show a placeholder while the entity list is being fetched. */
            <Skeleton className="h-9 w-full rounded-md" />
          ) : isErrorEntities ? (
            /* API call failed: show a non-interactive error indicator with   */
            /* a tooltip explaining the situation and a retry button.         */
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
            /* Entities loaded: render the dropdown switcher.                 */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between bg-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/80 hover:text-sidebar-foreground text-sidebar-foreground"
                >
                  {/* Display the full name if resolved, else fall back to the code. */}
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
                    {/* Show a checkmark next to the currently active entity. */}
                    {activeEntity === entity.code && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Primary Navigation                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              /**
               * Active state logic:
               * - Exact match for the dashboard root `/` to avoid it matching
               *   every route via prefix.
               * - Prefix match for all other routes so nested paths (e.g.
               *   `/evidence/123`) keep their parent item highlighted.
               */
              const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
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
        {/* ---------------------------------------------------------------- */}
        <div className="p-4 border-t border-sidebar-border mt-auto">
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground mb-4">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          {/* Static user identity; would be replaced with real auth data. */}
          <div className="flex items-center gap-3 px-2">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">GR</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">Grace Hopper</span>
              <span className="text-xs text-sidebar-foreground/50">Director of GRC</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content area                                                    */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
             {/* Breadcrumb: "EntityName / PageLabel" derived from current route. */}
             <div className="text-sm text-muted-foreground font-medium breadcrumbs">
                {currentEntityObj?.name || '...'} <span className="mx-2">/</span> {navItems.find(i => location === i.href || (i.href !== '/' && location.startsWith(i.href)))?.label || 'Page'}
             </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Global search input — currently a UI-only stub. */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search controls, evidence, policies..."
                className="h-9 w-64 md:w-80 rounded-md border border-input bg-background pl-9 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button size="sm" className="gap-1.5 h-9">
              <Plus className="h-4 w-4" />
              New Action
            </Button>
          </div>
        </header>

        {/* Page Content: scrollable region that renders the active route. */}
        <div className="flex-1 overflow-auto bg-background p-6">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
