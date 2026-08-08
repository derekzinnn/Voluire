import { supabase } from "@/integrations/supabase/client";

/**
 * Uma venda pode ter 1 ou 2 corretores. Esta função devolve uma linha por
 * participação de corretor, com o valor já proporcional à sua participação.
 */
export type VendaCorretorFlat = {
  id: string;
  corretor_id: string;
  valor: number;
  valor_venda: number;
  data_venda: string;
  status: string;
  participacao_percentual: number;
  percentual_corretor: number;
};

export async function fetchVendasPorCorretor(ids?: string[]): Promise<VendaCorretorFlat[]> {
  let q = supabase
    .from("venda_corretores")
    .select("corretor_id, participacao_percentual, percentual_corretor, vendas(id, valor, data_venda, status)");
  if (ids && ids.length > 0) q = q.in("corretor_id", ids);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).flatMap((r: any) => {
    const v = r.vendas;
    if (!v) return [];
    const part = Number(r.participacao_percentual) || 100;
    return [{
      id: v.id,
      corretor_id: r.corretor_id,
      valor: (Number(v.valor) || 0) * part / 100,
      valor_venda: Number(v.valor) || 0,
      data_venda: v.data_venda,
      status: v.status,
      participacao_percentual: part,
      percentual_corretor: Number(r.percentual_corretor) || 0,
    }];
  });
}

export const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  a_vista: "À vista",
  parcelado: "Parcelado",
  financiamento: "Financiamento",
};
