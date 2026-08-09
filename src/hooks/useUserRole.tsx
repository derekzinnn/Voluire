import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "diretor" | "gerente" | "corretor";

interface UserRoleData {
  role: AppRole | null;
  corretorId: string | null;
  equipeIds: string[];
  isDiretor: boolean;
  isGestor: boolean;
  loading: boolean;
}

export function useUserRole(): UserRoleData {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [corretorId, setCorretorId] = useState<string | null>(null);
  const [equipeIds, setEquipeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setRole(null);
      setCorretorId(null);
      setEquipeIds([]);
      setLoading(false);
      return;
    }


    async function fetchData() {
      const [roleRes, corretorRes, equipesRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("corretores").select("id").eq("user_id", user!.id).maybeSingle(),
        supabase.from("equipes").select("id").eq("gestor_user_id", user!.id).eq("ativo", true),
      ]);

      // Um usuário pode ter várias funções (ex.: admin + diretor).
      // Vale sempre a de maior privilégio.
      const roles = (roleRes.data ?? []).map((r) => r.role as string);
      const prioridade: AppRole[] = ["diretor", "gerente", "corretor"];
      const efetiva =
        prioridade.find((p) => roles.includes(p)) ??
        (roles.includes("admin") ? "diretor" : null);

      setRole(efetiva);
      setCorretorId(corretorRes.data?.id ?? null);
      setEquipeIds((equipesRes.data ?? []).map((e) => e.id));
      setLoading(false);
    }

    fetchData();
  }, [user, authLoading]);

  return {
    role,
    corretorId,
    equipeIds,
    isDiretor: role === "diretor",
    isGestor: role === "diretor" || role === "gerente",
    loading,
  };
}

// Permission helpers
export function canAccessPage(role: AppRole | null, page: string): boolean {
  if (!role) return false;

  // Ficha do corretor: acesso governado por can_view_corretor no banco
  if (page.startsWith("/corretores/")) return true;

  // Gestão de usuários: somente diretores
  if (page === "/gestao-usuarios") return role === "diretor";

  // Parceiros: diretor e gerente
  if (page === "/parceiros") return role === "diretor" || role === "gerente";

  // Empreendimentos: diretor e gerente
  if (page === "/empreendimentos") return role === "diretor" || role === "gerente";

  // Área de gestão de pessoas: diretor e gerente
  if (page === "/minha-equipe") return role === "diretor" || role === "gerente";

  if (role === "diretor" || role === "gerente") return true;


  // Corretor allowed pages
  const corretorPages = ["/", "/vendas"];
  return corretorPages.includes(page);
}
