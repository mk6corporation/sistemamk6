import { createFileRoute, Outlet, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, LayoutDashboard, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">Painel</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-medium bg-muted text-foreground" }} activeOptions={{ exact: true }}>
              Dashboard
            </Link>
            <Link to="/clientes" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-medium bg-muted text-foreground" }}>
              <Users className="mr-1 inline h-4 w-4" /> Clientes
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
