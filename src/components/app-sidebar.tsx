import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ChevronDown,
  Rss,
  CalendarClock,
  KanbanSquare,
  BarChart3,
  Star,
  Link2,
  MessageSquare,
  AlertTriangle,
  Repeat,
  TrendingUp,
  Settings,
} from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const operacionalItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Minha Rotina", url: "/minha-rotina", icon: CalendarClock, exact: false },
  { title: "Jornada (Kanban)", url: "/kanban", icon: KanbanSquare, exact: false },
  { title: "Clientes (Base)", url: "/clientes", icon: Users, exact: false },
  { title: "Feed de mudanças", url: "/feed", icon: Rss, exact: false },
  { title: "Desempenho do cliente", url: "/desempenho", icon: TrendingUp, exact: false },
  { title: "Métricas (admin)", url: "/admin-metricas", icon: BarChart3, exact: false },
  { title: "Funil de Renovação", url: "/admin-renovacao", icon: Repeat, exact: false },
  { title: "Configurações", url: "/configuracoes", icon: Settings, exact: false },
];

const npsItems = [
  { title: "Dashboard", url: "/nps", icon: LayoutDashboard, exact: true },
  { title: "Links de NPS", url: "/nps/links", icon: Link2, exact: false },
  { title: "Respostas", url: "/nps/respostas", icon: MessageSquare, exact: false },
  { title: "Detratores", url: "/nps/detratores", icon: AlertTriangle, exact: false },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const isOperacionalActive = operacionalItems.some((i) =>
    i.exact ? currentPath === i.url : currentPath.startsWith(i.url),
  ) && !currentPath.startsWith("/nps");
  const isNpsActive = currentPath === "/nps" || currentPath.startsWith("/nps/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex h-12 items-center gap-2 px-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Painel</span>
              <span className="text-[10px] text-muted-foreground">Gestão de clientes</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <Collapsible defaultOpen={isOperacionalActive} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Operacional
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {operacionalItems.map((item) => {
                    const active = item.exact
                      ? currentPath === item.url
                      : currentPath.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <Link to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen={isNpsActive} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  NPS
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {npsItems.map((item) => {
                    const active = item.exact
                      ? currentPath === item.url
                      : currentPath.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <Link to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
    </Sidebar>
  );
}
