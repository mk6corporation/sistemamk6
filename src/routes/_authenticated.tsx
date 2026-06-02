import { createFileRoute, Outlet, Navigate, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: isVendedor, isLoading: checkingVendedor } = useQuery({
    queryKey: ["is-vendedor", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendedor_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  if (loading || (user && checkingVendedor)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (isVendedor) return <Navigate to="/v/painel" />;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-card/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-1 h-4 w-4" /> Sair
              </Button>
            </div>
          </header>
          <Outlet />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
