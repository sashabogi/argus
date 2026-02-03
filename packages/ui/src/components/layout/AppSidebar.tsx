import {
  BarChart3,
  FolderTree,
  GitBranch,
  Search,
  Upload,
  X,
  FolderOpen,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Tab = 'analysis' | 'files' | 'search' | 'graph';

interface AppSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasSnapshot: boolean;
  fileCount?: number;
  importCount?: number;
  onClear?: () => void;
  currentProjectPath?: string;
}

const navItems = [
  {
    id: 'analysis' as Tab,
    label: 'Analysis',
    icon: BarChart3,
    description: 'Dependency analysis',
  },
  {
    id: 'graph' as Tab,
    label: 'Graph',
    icon: GitBranch,
    description: 'Dependency graph',
  },
  {
    id: 'files' as Tab,
    label: 'Files',
    icon: FolderTree,
    description: 'File explorer',
  },
  {
    id: 'search' as Tab,
    label: 'Search',
    icon: Search,
    description: 'Search codebase',
  },
];

export function AppSidebar({
  activeTab,
  onTabChange,
  hasSnapshot,
  fileCount = 0,
  importCount = 0,
  onClear,
  currentProjectPath,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="12" r="10" fillOpacity="0.2" />
              <circle cx="12" cy="12" r="3" />
              <path
                d="M12 2v4M12 18v4M2 12h4M18 12h4"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Argus</span>
            <span className="text-xs text-muted-foreground">Codebase Explorer</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeTab === item.id}
                    onClick={() => onTabChange(item.id)}
                    tooltip={item.label}
                    disabled={!hasSnapshot && item.id !== 'analysis'}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasSnapshot && (
          <SidebarGroup>
            <SidebarGroupLabel>Snapshot Info</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 space-y-2 group-data-[collapsible=icon]:hidden">
                {currentProjectPath && (
                  <div className="flex items-start gap-2 text-sm">
                    <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-xs font-mono break-all leading-relaxed">
                      {currentProjectPath}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Files</span>
                  <Badge variant="secondary">{fileCount.toLocaleString()}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Imports</span>
                  <Badge variant="secondary">{importCount.toLocaleString()}</Badge>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {hasSnapshot ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 group-data-[collapsible=icon]:justify-center"
            onClick={onClear}
          >
            <X className="h-4 w-4 mr-2 group-data-[collapsible=icon]:mr-0" />
            <span className="group-data-[collapsible=icon]:hidden">Clear Snapshot</span>
          </Button>
        ) : (
          <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <Upload className="h-3 w-3" />
              <span>Drop snapshot to load</span>
            </div>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
