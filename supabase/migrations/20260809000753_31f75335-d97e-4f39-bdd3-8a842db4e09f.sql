DROP FUNCTION IF EXISTS public.resumo_dashboard_anual(integer);

CREATE FUNCTION public.resumo_dashboard_anual(p_ano integer)
 RETURNS TABLE(mes integer, vgv numeric, vgv_quitado numeric, comissao_bruta numeric, corretores numeric, gestores numeric, voluire numeric, qtd_vendas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS (
    SELECT EXTRACT(month FROM data_venda)::int AS mes,
           SUM(valor) AS vgv,
           COUNT(*) AS qtd
    FROM public.vendas
    WHERE status <> 'distrato' AND EXTRACT(year FROM data_venda) = p_ano
      AND public.can_view_venda(id)
    GROUP BY 1
  ),
  qz AS (
    SELECT EXTRACT(month FROM ve.data_venda)::int AS mes,
           SUM(
             CASE
               WHEN EXISTS (SELECT 1 FROM public.venda_parcelas p WHERE p.venda_id = ve.id)
                 THEN COALESCE((SELECT SUM(p.valor) FROM public.venda_parcelas p
                                WHERE p.venda_id = ve.id AND p.status = 'recebida'), 0)
               WHEN EXISTS (SELECT 1 FROM public.comissoes co2
                            WHERE co2.venda_id = ve.id AND co2.status = 'recebido')
                 THEN ve.valor
               ELSE 0
             END
           ) AS quitado
    FROM public.vendas ve
    WHERE ve.status <> 'distrato' AND EXTRACT(year FROM ve.data_venda) = p_ano
      AND public.can_view_venda(ve.id)
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
         COALESCE(qz.quitado, 0),
         COALESCE(c.bruta, 0),
         COALESCE(c.corret, 0),
         COALESCE(g.gestores, 0),
         COALESCE(c.bruta, 0) - COALESCE(c.corret, 0) - COALESCE(g.gestores, 0),
         COALESCE(v.qtd, 0)
  FROM generate_series(1,12) AS m(mes)
  LEFT JOIN v ON v.mes = m.mes
  LEFT JOIN qz ON qz.mes = m.mes
  LEFT JOIN c ON c.mes = m.mes
  LEFT JOIN g ON g.mes = m.mes
  ORDER BY m.mes;
$function$;