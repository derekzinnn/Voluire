CREATE OR REPLACE FUNCTION public.fechamento_is_gestao()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'gerente')
      OR public.has_permission('dashboard.ver') OR public.has_permission('financeiro.ver')
$$;

CREATE OR REPLACE FUNCTION public.fechamento_corretores(p_ini date, p_fim date)
RETURNS TABLE(corretor_id uuid, corretor_nome text, realizado numeric, quitado numeric, a_receber numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gestao boolean := public.fechamento_is_gestao(); v_me uuid := public.get_my_corretor_id();
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT v_gestao AND v_me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH f AS (SELECT * FROM public.vw_vgv_corretor WHERE v_gestao OR vw_vgv_corretor.corretor_id = v_me),
  q AS (
    SELECT f.corretor_id,
      sum(CASE WHEN p.data_recebimento BETWEEN p_ini AND p_fim THEN p.vgv_quitado * f.fatia ELSE 0 END) AS q_periodo,
      sum(CASE WHEN p.data_recebimento <= p_fim THEN p.vgv_quitado * f.fatia ELSE 0 END) AS q_ate
    FROM f JOIN public.vw_vgv_parcelas p ON p.venda_id = f.venda_id
    WHERE f.data_venda <= p_fim
    GROUP BY f.corretor_id
  ),
  r AS (
    SELECT f.corretor_id,
      sum(CASE WHEN f.data_venda BETWEEN p_ini AND p_fim THEN f.vgv_realizado ELSE 0 END) AS realizado,
      sum(CASE WHEN f.data_venda <= p_fim THEN f.vgv_realizado ELSE 0 END) AS r_ate
    FROM f GROUP BY f.corretor_id
  )
  SELECT c.id, c.nome,
    round(COALESCE(r.realizado,0),2),
    round(COALESCE(q.q_periodo,0),2),
    round(GREATEST(COALESCE(r.r_ate,0) - COALESCE(q.q_ate,0),0),2)
  FROM public.corretores c
  LEFT JOIN r ON r.corretor_id = c.id
  LEFT JOIN q ON q.corretor_id = c.id
  WHERE (v_gestao OR c.id = v_me)
    AND (c.ativo OR COALESCE(r.r_ate,0) > 0)
  ORDER BY c.nome;
END $$;

CREATE OR REPLACE FUNCTION public.fechamento_totais(p_ini date, p_fim date)
RETURNS TABLE(realizado numeric, quitado numeric, a_receber numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT public.fechamento_is_gestao() THEN
    RETURN QUERY SELECT sum(x.realizado), sum(x.quitado), sum(x.a_receber) FROM public.fechamento_corretores(p_ini,p_fim) x;
    RETURN;
  END IF;
  RETURN QUERY SELECT
    round(COALESCE((SELECT sum(vgv_realizado) FROM public.vw_vgv_vendas WHERE data_venda BETWEEN p_ini AND p_fim),0),2),
    round(COALESCE((SELECT sum(vgv_quitado) FROM public.vw_vgv_parcelas WHERE data_recebimento BETWEEN p_ini AND p_fim),0),2),
    round(GREATEST(COALESCE((SELECT sum(vgv_realizado) FROM public.vw_vgv_vendas WHERE data_venda <= p_fim),0)
      - COALESCE((SELECT sum(p.vgv_quitado) FROM public.vw_vgv_parcelas p JOIN public.vendas v ON v.id=p.venda_id WHERE p.data_recebimento <= p_fim AND v.data_venda <= p_fim),0),0),2);
END $$;

REVOKE ALL ON FUNCTION public.fechamento_is_gestao() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fechamento_corretores(date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fechamento_totais(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechamento_is_gestao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechamento_corretores(date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechamento_totais(date,date) TO authenticated;