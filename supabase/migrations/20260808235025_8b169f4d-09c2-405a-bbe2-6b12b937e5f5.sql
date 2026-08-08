CREATE OR REPLACE FUNCTION public.comissao_gestor_mensal(p_ano integer, p_mes integer)
 RETURNS TABLE(equipe_id uuid, equipe_nome text, gestor_user_id uuid, vgv_equipe numeric, comissao_bruta_equipe numeric, faixa_percentual numeric, valor_gestor numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT e.id, e.nome, e.gestor_user_id,
           COALESCE(SUM(ve.valor * vc.participacao_percentual / 100), 0) AS vgv,
           COALESCE(SUM(ve.valor * vc.participacao_percentual / 100 * ve.comissao_percentual_bruta / 100), 0) AS bruta
    FROM public.equipes e
    LEFT JOIN public.corretores c
      ON c.equipe_id = e.id
     AND (e.gestor_user_id IS NULL OR c.user_id IS DISTINCT FROM e.gestor_user_id)
    LEFT JOIN public.venda_corretores vc ON vc.corretor_id = c.id
    LEFT JOIN public.vendas ve
      ON ve.id = vc.venda_id
     AND ve.status <> 'distrato'
     AND EXTRACT(year FROM ve.data_venda) = p_ano
     AND EXTRACT(month FROM ve.data_venda)::int = p_mes
     -- venda realizada pelo próprio gestor não gera comissão de gestor
     AND NOT EXISTS (
       SELECT 1 FROM public.venda_corretores vg
       JOIN public.corretores cg ON cg.id = vg.corretor_id
       WHERE vg.venda_id = ve.id
         AND e.gestor_user_id IS NOT NULL
         AND cg.user_id = e.gestor_user_id
     )
    WHERE e.ativo = true
      AND (public.has_role(auth.uid(),'diretor') OR e.gestor_user_id = auth.uid())
    GROUP BY e.id, e.nome, e.gestor_user_id
  )
  SELECT b.id, b.nome, b.gestor_user_id, b.vgv, b.bruta,
         COALESCE(f.percentual, 0),
         CASE WHEN COALESCE(f.base,'comissao_bruta') = 'vgv'
              THEN b.vgv * COALESCE(f.percentual,0) / 100
              ELSE b.bruta * COALESCE(f.percentual,0) / 100 END
  FROM base b
  LEFT JOIN public.gestor_faixas f ON f.ativo = true
    AND b.vgv >= f.faturamento_min
    AND (f.faturamento_max IS NULL OR b.vgv < f.faturamento_max);
$function$;