import { PanelLeft } from 'lucide-react';
import { platformIcons } from '@/components/branding/platform-icons';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

const mainNavItems = [
  { title: 'Dashboard', url: '/', icon: platformIcons.dashboard },
  { title: 'Projects', url: '/projects', icon: platformIcons.projects },
  { title: 'Services', url: '/services', icon: platformIcons.services },
];

const infraItems = [
  { title: 'Workers', url: '/workers', icon: platformIcons.workers },
  { title: 'Environments', url: '/environments', icon: platformIcons.environments },
  { title: 'Runtime Profiles', url: '/runtime-profiles', icon: platformIcons.runtimeProfiles },
];

const managementItems = [
  { title: 'Teams', url: '/teams', icon: platformIcons.teams },
  { title: 'Identity Provider', url: '/identity-provider', icon: platformIcons.identity },
  { title: 'Governance', url: '/governance', icon: platformIcons.governance },
  { title: 'Settings', url: '/settings', icon: platformIcons.settings },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent className="px-2 pt-14">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/60 px-3 py-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/60 px-3 py-2">
            Infrastructure
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {infraItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/60 px-3 py-2">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarTrigger
          className="w-full justify-start gap-2 rounded-md text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0"
        >
          <PanelLeft className="h-4 w-4" />
          <div className="flex flex-col text-left group-data-[state=collapsed]:hidden">
            <span className="text-sm font-medium">Collapse sidebar</span>
            <span className="text-xs text-sidebar-foreground/60">Hide menu</span>
          </div>
        </SidebarTrigger>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
