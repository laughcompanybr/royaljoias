import { Link, useRouterState } from "@tanstack/react-router";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { RoyalLogo } from "@/components/brand/RoyalLogo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_ITEMS, type NavItem } from "./nav-config";

const GROUP_LABELS: Record<NavItem["group"], string> = {
  operação: "Operação",
  gestão: "Gestão",
  sistema: "Sistema",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const groups = (["operação", "gestão", "sistema"] as const).map((group) => ({
    group,
    items: NAV_ITEMS.filter((i) => i.group === group),
  }));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://www.instagram.com/royaljoiasmg?igsh=aHN3N3hwb2ZqdTFs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visitar instagram oficial da Royal Joias"
                className="inline-flex rounded-md outline-none transition-all duration-200 hover:opacity-80 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar cursor-pointer"
              >
                <RoyalLogo size={32} showWordmark={!collapsed} />
              </a>
            </TooltipTrigger>
            <TooltipContent side="right" className="hidden md:block">
              Visitar instagram da Royal Joias
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarHeader>
      <SidebarContent className="gap-1 px-2 py-3">
        {groups.map(({ group, items }) => (
          <SidebarGroup key={group}>
            {!collapsed ? (
              <SidebarGroupLabel className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
                {GROUP_LABELS[group]}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const active =
                    currentPath === item.to || currentPath.startsWith(item.to + "/");
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="h-10 rounded-lg data-[active=true]:bg-sidebar-accent data-[active=true]:text-gold"
                      >
                        <Link to={item.to} className="flex items-center gap-3">
                          <item.icon className="size-4 shrink-0" />
                          {!collapsed && <span className="text-sm">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
