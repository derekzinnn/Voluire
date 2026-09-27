import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "diretor" | "gerente" | "corretor" | "financeiro" | "administrativo";

export const ROLE_LABELS: Record<string, string> = {
  diretor: "Diretor",
  gerente: "Gestão",
  corretor: "Corretor",
  financeiro: "Financeiro",
  administrativo: "Administrativo",
};

/** Cargos com permissões configuráveis (diretor sempre tem tudo) */
export const ROLES_CONFIGURAVEIS: AppRole[] = [
  "financeiro",
  "administrativo",
  "gerente",
  "corretor",
];

export const PERMISSOES: { key: string; label: string; descricao: string }[] = [
  { key: "dashboard.ver", label: "Ver dashboard", descricao: "Acessa a página inicial com os números" },
  { key: "vendas.ver_todas", label: "Ver todas as vendas", descricao: "Vê vendas de qualquer corretor" },
  { key: "vendas.gerenciar", label: "Registrar e editar vendas", descricao: "Cria contratos, parcelas e recebimentos" },
  { key: "financeiro.ver", label: "Ver financeiro", descricao: "Acessa o mês gerencial e o fluxo de caixa" },
  { key: "financeiro.gerenciar", label: "Lançar despesas e comissões", descricao: "Edita despesas e comissões" },
  { key: "corretores.ver_todos", label: "Ver todos os corretores", descricao: "Vê a lista completa de corretores" },
  { key: "corretores.gerenciar", label: "Cadastrar e editar corretores", descricao: "Cria e altera fichas de corretor" },
  
  { key: "empreendimentos.gerenciar", label: "Gerenciar imóveis", descricao: "Cadastra empreendimentos e imóveis" },
  { key: "fechamento.ver_todos", label: "Fechamento de todos", descricao: "Vê o fechamento de todos os corretores" },
  { key: "rankings.ver", label: "Ver rankings", descricao: "Vê rankings de premiação no Fechamento" },
  { key: "usuarios.gerenciar", label: "Gerenciar usuários e cargos", descricao: "Convida usuários e altera permissões" },
];

interface UserRoleData {
  role: AppRole | null;
  roles: string[];
  permissions: string[];
  corretorId: string | null;
  equipeIds: string[];
  isDiretor: boolean;
  isGestor: boolean;
  can: (permission: string) => boolean;
  loading: boolean;
}

export function useUserRole(): UserRoleData {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
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
      setRoles([]);
      setPermissions([]);
      setCorretorId(null);
      setEquipeIds([]);
      setLoading(false);
      return;
    }

    async function fetchData() {
      const [roleRes, corretorRes, equipesRes, permRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("corretores").select("id").eq("user_id", user!.id).maybeSingle(),
        supabase.from("equipes").select("id").eq("gestor_user_id", user!.id).eq("ativo", true),
        supabase.from("role_permissions").select("role, permission, allowed").eq("allowed", true),
      ]);

      // Um usuário pode ter várias funções (ex.: admin + diretor).
      // Vale sempre a de maior privilégio.
      const userRoles = (roleRes.data ?? []).map((r) => r.role as string);
      const prioridade: AppRole[] = ["diretor", "gerente", "financeiro", "administrativo", "corretor"];
      const efetiva =
        prioridade.find((p) => userRoles.includes(p)) ??
        (userRoles.includes("admin") ? "diretor" : null);

      const perms = (permRes.data ?? [])
        .filter((p: any) => userRoles.includes(p.role))
        .map((p: any) => p.permission as string);

      setRoles(userRoles);
      setRole(efetiva);
      setPermissions(Array.from(new Set(perms)));
      setCorretorId(corretorRes.data?.id ?? null);
      setEquipeIds((equipesRes.data ?? []).map((e) => e.id));
      setLoading(false);
    }

    fetchData();
  }, [user, authLoading]);

  const isDiretor = role === "diretor";
  const isGestor = role === "diretor" || role === "gerente";

  const can = (permission: string) => {
    if (isDiretor) return true;
    // Gerente sempre administra a própria equipe (escopo garantido no banco)
    if (role === "gerente" && (permission === "vendas.gerenciar" || permission === "vendas.ver_todas")) return true;
    return permissions.includes(permission);
  };

  return {
    role,
    roles,
    permissions,
    corretorId,
    equipeIds,
    isDiretor,
    isGestor,
    can,
    loading,
  };
}

// Permission helpers
export function canAccessPage(role: AppRole | null, page: string, permissions: string[] = []): boolean {
  if (!role) return false;
  if (role === "diretor") return true;

  const has = (p: string) => permissions.includes(p);

  // Ficha do corretor: acesso governado por can_view_corretor no banco
  if (page.startsWith("/corretores/")) return true;

  if (page === "/") return role === "corretor" || has("dashboard.ver");
  if (page === "/fechamento") return role === "corretor" || has("fechamento.ver_todos");
  if (page === "/vendas") return role === "corretor" || has("vendas.ver_todas") || has("vendas.gerenciar");
  if (page === "/corretores") return has("corretores.ver_todos") || has("corretores.gerenciar");
  if (page === "/financeiro") return has("financeiro.ver") || has("financeiro.gerenciar");
  
  if (page === "/imoveis" || page === "/empreendimentos") return has("empreendimentos.gerenciar");
  if (page === "/minha-equipe") return role === "gerente";
  if (page === "/gestao-usuarios") return has("usuarios.gerenciar");
  if (page === "/logs") return false; // histórico do sistema: só diretor

  return false;
}
