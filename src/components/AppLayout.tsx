import { useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import logo from "@/assets/logo.jpg";
import {
  LayoutDashboard, ShoppingCart, Users,
  Wallet, Menu, X, LogOut, Settings, Building, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useUserRole, canAccessPage } from "@/hooks/useUserRole";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import ParcelasVencidasDialog, { useParcelasVencidasCount } from "@/components/ParcelasVencidasDialog";


const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/vendas", icon: ShoppingCart, label: "Vendas" },
  { to: "/corretores", icon: Users, label: "Corretores" },
  
  { to: "/empreendimentos", icon: Building, label: "Empreendimentos" },
  { to: "/financeiro", icon: Wallet, label: "Financeiro" },
  
  { to: "/gestao-usuarios", icon: Settings, label: "Gestão Usuários", group: "Gestão" },
];


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avisosOpen, setAvisosOpen] = useState(false);
  const location = useLocation();
  const { role, permissions, loading: roleLoading, isGestor, can } = useUserRole();
  const qtdAtrasadas = useParcelasVencidasCount();


  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Filter nav items based on role
  const visibleNavItems = navItems.filter(item => canAccessPage(role, item.to, permissions));

  // Block access to unauthorized pages
  if (!canAccessPage(role, location.pathname, permissions)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
          <img src={logo} alt="Voluire" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-lg font-bold">Voluire</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {visibleNavItems.map((item, index) => (
            <div key={item.to}>
              {item.group && visibleNavItems[index - 1]?.group !== item.group && (
                <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {item.group}
                </p>
              )}
              <Link
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === item.to
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            </div>
          ))}

        </nav>
        <div className="p-4 border-t border-sidebar-border space-y-1">
          {isGestor && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={() => setAvisosOpen(true)}
            >
              <Bell className="h-5 w-5" />
              Parcelas em atraso
              {qtdAtrasadas > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
                  {qtdAtrasadas}
                </span>
              )}
            </Button>
          )}
          <ChangePasswordDialog />
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
            Sair
          </Button>
        </div>

      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {navItems.find(i => i.to === location.pathname)?.label || "Voluire CRM"}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
      <ParcelasVencidasDialog />
      <ParcelasVencidasDialog open={avisosOpen} onOpenChange={setAvisosOpen} />

    </div>
  );
}
