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

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { activeEntity, setActiveEntity } = useEntity();
  
  const { data: entities = [], isLoading: isLoadingEntities, isError: isErrorEntities, refetch: refetchEntities } = useListEntities(
    { query: { queryKey: getListEntitiesQueryKey() } }
  );
  
  const currentEntityObj = entities.find(e => e.code === activeEntity);

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
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-full flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border gap-2 text-sidebar-primary">
          <ShieldCheck className="h-6 w-6" />
          <span className="font-bold tracking-tight text-sidebar-foreground">Compliance OS</span>
        </div>

        {/* Entity Switcher */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Business Entity</div>
          {isLoadingEntities ? (
            <Skeleton className="h-9 w-full rounded-md" />
          ) : isErrorEntities ? (
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between bg-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/80 hover:text-sidebar-foreground text-sidebar-foreground"
                >
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
                    {activeEntity === entity.code && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
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

        {/* Settings & User */}
        <div className="p-4 border-t border-sidebar-border mt-auto">
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground mb-4">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
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

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
             <div className="text-sm text-muted-foreground font-medium breadcrumbs">
                {currentEntityObj?.name || '...'} <span className="mx-2">/</span> {navItems.find(i => location === i.href || (i.href !== '/' && location.startsWith(i.href)))?.label || 'Page'}
             </div>
          </div>
          <div className="flex items-center gap-4">
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

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-background p-6">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
