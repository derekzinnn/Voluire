CREATE OR REPLACE FUNCTION public.resumo_dashboard_anual(p_ano integer)
RETURNS TABLE(mes integer, vgv numeric, comissao_bruta numeric, corretores numeric, gestores numeric, voluire numeric, qtd_vendas bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH v AS (
    SELECT EXTRACT(month FROM data_venda)::int AS mes,
           SUM(valor) AS vgv,
           COUNT(*) AS qtd
    FROM public.vendas
    WHERE status <> 'distrato' AND EXTRACT(year FROM data_venda) = p_ano
      AND public.can_view_venda(id)
    GROUP BY 1
  ),
  c AS (
    SELECT EXTRACT(month FROM ve.data_venda)::int AS mes,
           SUM(co.valor_total) AS bruta,
           SUM(co.valor_corretores) AS corret
    FROM public.comissoes co
    JOIN public.vendas ve ON ve.id = co.venda_id
    WHERE ve.status <> 'distrato' AND EXTRACT(year FROM ve.data_venda) = p_ano
      AND public.can_view_venda(ve.id)
    GROUP BY 1
  ),
  g AS (
    SELECT m.mes, COALESCE(SUM(gm.valor_gestor), 0) AS gestores
    FROM generate_series(1,12) AS m(mes)
    LEFT JOIN LATERAL public.comissao_gestor_mensal(p_ano, m.mes) gm ON true
    GROUP BY m.mes
  )
  SELECT m.mes,
         COALESCE(v.vgv, 0),
         COALESCE(c.bruta, 0),
         COALESCE(c.corret, 0),
         COALESCE(g.gestores, 0),
         COALESCE(c.bruta, 0) - COALESCE(c.corret, 0) - COALESCE(g.gestores, 0),
         COALESCE(v.qtd, 0)
  FROM generate_series(1,12) AS m(mes)
  LEFT JOIN v ON v.mes = m.mes
  LEFT JOIN c ON c.mes = m.mes
  LEFT JOIN g ON g.mes = m.mes
  ORDER BY m.mes;
$$;

GRANT EXECUTE ON FUNCTION public.resumo_dashboard_anual(integer) TO authenticated;