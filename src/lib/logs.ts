import { supabase } from "@/integrations/supabase/client";

/**
 * Registra um evento no histórico do sistema.
 * Alterações em vendas, corretores, parcelas etc. já são registradas pelo banco.
 * Use isto para eventos que só existem no app: login, logout, troca de senha...
 */
export async function registrarLog(
  acao: string,
  opts: { entidade?: string; entidade_id?: string; descricao?: string; detalhes?: Record<string, unknown> } = {}
) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    await supabase.from("system_logs").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      acao,
      entidade: opts.entidade ?? "acesso",
      entidade_id: opts.entidade_id ?? null,
      descricao: opts.descricao ?? null,
      detalhes: (opts.detalhes ?? null) as any,
    });
  } catch {
    // log nunca deve quebrar o fluxo do usuário
  }
}
