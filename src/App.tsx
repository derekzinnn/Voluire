import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Fechamento from "@/pages/Fechamento";
import Vendas from "@/pages/Vendas";
import Corretores from "@/pages/Corretores";
import Empreendimentos from "@/pages/Empreendimentos";
import CorretorDetalhe from "@/pages/CorretorDetalhe";
import Financeiro from "@/pages/Financeiro";
import GestaoUsuarios from "@/pages/GestaoUsuarios";
import MinhaEquipe from "@/pages/MinhaEquipe";
import Logs from "@/pages/Logs";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/fechamento" element={<Fechamento />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/corretores" element={<Corretores />} />
        <Route path="/corretores/:id" element={<CorretorDetalhe />} />
        <Route path="/empreendimentos" element={<Empreendimentos />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/minha-equipe" element={<MinhaEquipe />} />
        <Route path="/gestao-usuarios" element={<GestaoUsuarios />} />
        <Route path="/logs" element={<Logs />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
