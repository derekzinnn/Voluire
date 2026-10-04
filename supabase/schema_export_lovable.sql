CREATE OR REPLACE FUNCTION public.can_manage_corretor(p_corretor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN public.has_role(auth.uid(), 'diretor') THEN true
      WHEN public.has_permission('corretores.gerenciar') THEN true
      WHEN p_corretor_id IS NULL THEN false
      WHEN public.has_role(auth.uid(), 'gerente') THEN EXISTS (
        SELECT 1 FROM public.corretores c
        WHERE c.id = p_corretor_id
          AND c.equipe_id IS NOT NULL
          AND c.equipe_id IN (SELECT public.get_my_equipe_ids())
      )
      ELSE false
    END
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_venda(p_venda_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'diretor') THEN true
    WHEN public.has_permission('vendas.gerenciar') THEN true
    WHEN p_venda_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.venda_corretores vc
      WHERE vc.venda_id = p_venda_id AND public.can_manage_corretor(vc.corretor_id)
    )
  END
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_corretor(p_corretor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN public.has_role(auth.uid(), 'diretor') THEN true
      WHEN public.has_permission('corretores.ver_todos') THEN true
      WHEN p_corretor_id IS NULL THEN false
      WHEN p_corretor_id = public.get_my_corretor_id() THEN true
      WHEN public.has_role(auth.uid(), 'gerente') THEN EXISTS (
        SELECT 1 FROM public.corretores c
        WHERE c.id = p_corretor_id
          AND c.equipe_id IS NOT NULL
          AND c.equipe_id IN (SELECT public.get_my_equipe_ids())
      )
      ELSE false
    END
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_venda(p_venda_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'diretor') THEN true
    WHEN public.has_permission('vendas.ver_todas') THEN true
    WHEN p_venda_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.venda_corretores vc
      WHERE vc.venda_id = p_venda_id AND public.can_view_corretor(vc.corretor_id)
    ) OR EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.id = p_venda_id AND public.can_view_corretor(v.captador_corretor_id)
    )
  END
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.corretor_vgv_historico(p_corretor_id uuid)
 RETURNS TABLE(ano integer, realizado numeric, quitado numeric, qtd_vendas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH r AS (
    SELECT EXTRACT(year FROM data_venda)::int AS ano, sum(vgv_realizado) AS v, count(*) AS n
    FROM public.vw_vgv_corretor WHERE corretor_id = p_corretor_id GROUP BY 1
  ), q AS (
    SELECT EXTRACT(year FROM p.data_recebimento)::int AS ano, sum(p.vgv_quitado * f.fatia) AS v
    FROM public.vw_vgv_parcelas p JOIN public.vw_vgv_corretor f ON f.venda_id = p.venda_id
    WHERE f.corretor_id = p_corretor_id GROUP BY 1
  )
  SELECT COALESCE(r.ano, q.ano), round(COALESCE(r.v,0),2), round(COALESCE(q.v,0),2), COALESCE(r.n,0)
  FROM r FULL JOIN q ON q.ano = r.ano
  WHERE public.can_view_corretor(p_corretor_id)
  ORDER BY 1 DESC
$function$
;
CREATE OR REPLACE FUNCTION public.dashboard_mensal(p_ano integer)
 RETURNS TABLE(mes integer, vgv numeric, vgv_quitado numeric, comissao_a_receber numeric, comissao_recebida numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH m AS (SELECT generate_series(1,12) AS mes),
  v AS (
    SELECT EXTRACT(month FROM data_venda)::int AS mes, SUM(valor) AS total
    FROM public.vendas
    WHERE status <> 'distrato' AND EXTRACT(year FROM data_venda) = p_ano
      AND public.can_view_venda(id)
    GROUP BY 1
  ),
  q AS (
    SELECT EXTRACT(month FROM c.data_recebimento)::int AS mes, SUM(ve.valor) AS total
    FROM public.comissoes c JOIN public.vendas ve ON ve.id = c.venda_id
    WHERE c.status = 'recebido' AND c.data_recebimento IS NOT NULL
      AND EXTRACT(year FROM c.data_recebimento) = p_ano AND ve.status <> 'distrato'
      AND public.can_view_venda(ve.id)
    GROUP BY 1
  ),
  ca AS (
    SELECT EXTRACT(month FROM COALESCE(c.data_recebimento, ve.data_venda))::int AS mes, SUM(c.valor_empresa) AS total
    FROM public.comissoes c JOIN public.vendas ve ON ve.id = c.venda_id
    WHERE c.status = 'a_receber' AND ve.status <> 'distrato'
      AND EXTRACT(year FROM COALESCE(c.data_recebimento, ve.data_venda)) = p_ano
      AND public.can_view_venda(ve.id)
    GROUP BY 1
  ),
  cr AS (
    SELECT EXTRACT(month FROM c.data_recebimento)::int AS mes, SUM(c.valor_empresa) AS total
    FROM public.comissoes c JOIN public.vendas ve ON ve.id = c.venda_id
    WHERE c.status = 'recebido' AND c.data_recebimento IS NOT NULL
      AND EXTRACT(year FROM c.data_recebimento) = p_ano
      AND public.can_view_venda(ve.id)
    GROUP BY 1
  )
  SELECT m.mes, COALESCE(v.total,0), COALESCE(q.total,0), COALESCE(ca.total,0), COALESCE(cr.total,0)
  FROM m
  LEFT JOIN v ON v.mes = m.mes LEFT JOIN q ON q.mes = m.mes
  LEFT JOIN ca ON ca.mes = m.mes LEFT JOIN cr ON cr.mes = m.mes
  ORDER BY m.mes;
$function$
;
CREATE OR REPLACE FUNCTION public.fechamento_corretores(p_ini date, p_fim date)
 RETURNS TABLE(corretor_id uuid, corretor_nome text, realizado numeric, quitado numeric, a_receber numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.fechamento_is_gestao()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_permission('fechamento.ver_todos')
$function$
;
CREATE OR REPLACE FUNCTION public.fechamento_totais(p_ini date, p_fim date)
 RETURNS TABLE(realizado numeric, quitado numeric, a_receber numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.get_corretor_cpf(p_corretor_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf text;
  v_digits text;
BEGIN
  SELECT cpf INTO v_cpf FROM public.corretor_documentos WHERE corretor_id = p_corretor_id;
  IF v_cpf IS NULL OR btrim(v_cpf) = '' THEN
    RETURN NULL;
  END IF;

  IF public.has_role(auth.uid(), 'diretor') THEN
    RETURN v_cpf;
  END IF;

  IF public.can_manage_corretor(p_corretor_id) THEN
    v_digits := regexp_replace(v_cpf, '\D', '', 'g');
    IF length(v_digits) < 11 THEN
      RETURN '***.***.***-**';
    END IF;
    RETURN '***.***.' || substring(v_digits from 7 for 3) || '-**';
  END IF;

  RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_corretor_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.corretores WHERE user_id = auth.uid() LIMIT 1
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_equipe_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id FROM public.equipes e
  WHERE e.ativo = true AND e.gestor_user_id = auth.uid()
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'corretor')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_permission(_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'diretor'
        OR ur.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.role_permissions rp
          WHERE rp.role = ur.role
            AND rp.permission = _permission
            AND rp.allowed
        )
      )
  )
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $function$
;
CREATE OR REPLACE FUNCTION public.is_diretor_or_gerente()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('diretor', 'gerente')
  )
$function$
;
CREATE OR REPLACE FUNCTION public.list_users()
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.id, u.email::text, u.created_at
  FROM auth.users u
  WHERE
    public.has_role(auth.uid(), 'diretor')
    OR (
      public.has_role(auth.uid(), 'gerente')
      AND EXISTS (
        SELECT 1 FROM public.corretores c
        WHERE c.user_id = u.id
          AND c.equipe_id IS NOT NULL
          AND c.equipe_id IN (SELECT public.get_my_equipe_ids())
      )
    )
  ORDER BY u.created_at;
$function$
;
CREATE OR REPLACE FUNCTION public.list_users_status()
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, banned_until timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at, u.banned_until
  FROM auth.users u
  WHERE public.has_permission('usuarios.gerenciar') OR public.has_permission('corretores.gerenciar')
  ORDER BY u.created_at
$function$
;
CREATE OR REPLACE FUNCTION public.log_alteracao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_id text;
  v_acao text;
  v_desc text;
  v_alt jsonb;
  v_row jsonb;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_row := to_jsonb(COALESCE(NEW, OLD));

  IF TG_OP = 'DELETE' THEN
    v_acao := 'excluiu';
  ELSIF TG_OP = 'INSERT' THEN
    v_acao := 'criou';
  ELSE
    v_acao := 'editou';
    -- só os campos que realmente mudaram
    SELECT jsonb_agg(jsonb_build_object('campo', e.k, 'antes', to_jsonb(OLD) -> e.k, 'depois', e.v)
                     ORDER BY e.k)
      INTO v_alt
      FROM jsonb_each(to_jsonb(NEW)) AS e(k, v)
     WHERE e.k NOT IN ('updated_at', 'created_at')
       AND (to_jsonb(OLD) -> e.k) IS DISTINCT FROM e.v;
    IF v_alt IS NULL THEN
      RETURN NEW; -- nada mudou de fato
    END IF;
  END IF;

  v_id := v_row ->> 'id';

  v_desc := CASE TG_TABLE_NAME
    WHEN 'vendas' THEN 'Contrato ' || COALESCE(v_row ->> 'numero_contrato', '')
    WHEN 'corretores' THEN 'Corretor ' || COALESCE(v_row ->> 'nome', '')
    WHEN 'empreendimentos' THEN 'Empreendimento ' || COALESCE(v_row ->> 'nome', '')
    WHEN 'equipes' THEN 'Equipe ' || COALESCE(v_row ->> 'nome', '')
    WHEN 'venda_parcelas' THEN 'Parcela ' || COALESCE(v_row ->> 'numero', '')
    WHEN 'despesas' THEN 'Despesa ' || COALESCE(v_row ->> 'descricao', '')
    WHEN 'comissoes' THEN 'Comissão do contrato'
    WHEN 'venda_corretores' THEN 'Corretor no contrato'
    WHEN 'captacoes' THEN 'Captação'
    WHEN 'corretor_documentos' THEN 'Documentos do corretor'
    WHEN 'corretor_perfil_notas' THEN 'Notas do gestor'
    WHEN 'role_permissions' THEN 'Permissão ' || COALESCE(v_row ->> 'permission', '')
    WHEN 'user_roles' THEN 'Função ' || COALESCE(v_row ->> 'role', '')
    ELSE NULL
  END;

  INSERT INTO public.system_logs (user_id, user_email, acao, entidade, entidade_id, descricao, detalhes)
  VALUES (
    auth.uid(),
    v_email,
    v_acao,
    TG_TABLE_NAME,
    v_id,
    v_desc,
    jsonb_build_object(
      'alteracoes', v_alt,
      'antes', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'depois', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.ranking_corretores(p_status text DEFAULT 'ativa'::text)
 RETURNS TABLE(corretor_id uuid, corretor_nome text, total_vgv numeric, total_vendas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.nome,
         COALESCE(SUM(ve.valor * vc.participacao_percentual / 100), 0),
         COUNT(ve.id)
  FROM public.corretores c
  LEFT JOIN public.venda_corretores vc ON vc.corretor_id = c.id
  LEFT JOIN public.vendas ve ON ve.id = vc.venda_id AND ve.status = p_status
  WHERE c.ativo = true AND public.can_view_corretor(c.id)
  GROUP BY c.id, c.nome
  ORDER BY 3 DESC;
$function$
;
CREATE OR REPLACE FUNCTION public.ranking_periodo(p_ano integer, p_meses integer[])
 RETURNS TABLE(corretor_id uuid, corretor_nome text, vgv numeric, qtd_vendas bigint, vgv_quitado numeric, qtd_quitadas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS (
    SELECT corretor_id, SUM(vgv_realizado) AS total, COUNT(*) AS qtd
    FROM public.vw_vgv_corretor
    WHERE EXTRACT(year FROM data_venda) = p_ano AND EXTRACT(month FROM data_venda)::int = ANY(p_meses)
      AND public.can_view_corretor(corretor_id)
    GROUP BY 1
  ),
  q AS (
    SELECT s.corretor_id, SUM(p.vgv_quitado * s.fatia) AS total, COUNT(DISTINCT p.venda_id) AS qtd
    FROM public.vw_vgv_parcelas p JOIN public.vw_vgv_corretor s ON s.venda_id = p.venda_id
    WHERE EXTRACT(year FROM p.data_recebimento) = p_ano AND EXTRACT(month FROM p.data_recebimento)::int = ANY(p_meses)
      AND public.can_view_corretor(s.corretor_id)
    GROUP BY 1
  )
  SELECT co.id, co.nome, COALESCE(v.total,0), COALESCE(v.qtd,0), COALESCE(q.total,0), COALESCE(q.qtd,0)
  FROM public.corretores co
  LEFT JOIN v ON v.corretor_id = co.id LEFT JOIN q ON q.corretor_id = co.id
  WHERE public.can_view_corretor(co.id) AND (COALESCE(v.total,0) > 0 OR COALESCE(q.total,0) > 0)
  ORDER BY COALESCE(v.total,0) DESC;
$function$
;
CREATE OR REPLACE FUNCTION public.recalc_comissao_venda(p_venda_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valor numeric; v_pct numeric; v_total numeric; v_corretores numeric;
  v_tipo text; v_captador uuid; v_agenciador text; v_captador_valor numeric := 0;
BEGIN
  SELECT ve.valor, ve.comissao_percentual_bruta, ve.captador_corretor_id,
         COALESCE(ve.agenciador_tipo,'proprio'), COALESCE(e.tipo,'lancamento')
    INTO v_valor, v_pct, v_captador, v_agenciador, v_tipo
  FROM public.vendas ve
  LEFT JOIN public.empreendimentos e ON e.id = ve.empreendimento_id
  WHERE ve.id = p_venda_id;

  IF v_valor IS NULL THEN RETURN; END IF;
  v_total := v_valor * COALESCE(v_pct,6) / 100;

  -- Participação já vem descontada do agenciador e dividida entre os corretores.
  SELECT COALESCE(SUM(v_total * vc.participacao_percentual / 100), 0)
    INTO v_corretores FROM public.venda_corretores vc WHERE vc.venda_id = p_venda_id;

  -- Agenciador colega leva 10% da comissão bruta; Voluire (5%) fica com a empresa.
  IF v_tipo = 'pronto' AND v_agenciador = 'corretor' AND v_captador IS NOT NULL THEN
    v_captador_valor := v_total * 10 / 100;
  END IF;
  v_corretores := v_corretores + v_captador_valor;

  INSERT INTO public.comissoes (venda_id, percentual_total, valor_total, valor_corretores, valor_empresa)
  VALUES (p_venda_id, COALESCE(v_pct,6), v_total, v_corretores, v_total - v_corretores)
  ON CONFLICT (venda_id) DO UPDATE
    SET percentual_total = EXCLUDED.percentual_total,
        valor_total = EXCLUDED.valor_total,
        valor_corretores = EXCLUDED.valor_corretores,
        valor_empresa = EXCLUDED.valor_empresa,
        updated_at = now();
END;
$function$
;
CREATE OR REPLACE FUNCTION public.resumo_dashboard_anual(p_ano integer)
 RETURNS TABLE(mes integer, vgv numeric, vgv_quitado numeric, comissao_bruta numeric, corretores numeric, gestores numeric, voluire numeric, qtd_vendas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS (
    SELECT EXTRACT(month FROM data_venda)::int AS mes, SUM(vgv_realizado) AS vgv, COUNT(*) AS qtd
    FROM public.vw_vgv_vendas
    WHERE EXTRACT(year FROM data_venda) = p_ano AND public.can_view_venda(venda_id)
    GROUP BY 1
  ),
  qz AS (
    SELECT EXTRACT(month FROM data_recebimento)::int AS mes, SUM(vgv_quitado) AS quitado
    FROM public.vw_vgv_parcelas
    WHERE EXTRACT(year FROM data_recebimento) = p_ano AND public.can_view_venda(venda_id)
    GROUP BY 1
  ),
  c AS (
    SELECT EXTRACT(month FROM ve.data_venda)::int AS mes, SUM(co.valor_total) AS bruta, SUM(co.valor_corretores) AS corret
    FROM public.comissoes co JOIN public.vendas ve ON ve.id = co.venda_id
    WHERE NOT ve.distrato AND EXTRACT(year FROM ve.data_venda) = p_ano AND public.can_view_venda(ve.id)
    GROUP BY 1
  )
  SELECT m.mes, COALESCE(v.vgv,0), COALESCE(qz.quitado,0), COALESCE(c.bruta,0), COALESCE(c.corret,0),
         0::numeric, COALESCE(c.bruta,0) - COALESCE(c.corret,0), COALESCE(v.qtd,0)
  FROM generate_series(1,12) AS m(mes)
  LEFT JOIN v ON v.mes = m.mes LEFT JOIN qz ON qz.mes = m.mes LEFT JOIN c ON c.mes = m.mes
  ORDER BY m.mes;
$function$
;
CREATE OR REPLACE FUNCTION public.salvar_venda(p_id uuid, p_venda jsonb, p_corretores jsonb, p_parcelas jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid := p_id;
  v_n int := COALESCE(jsonb_array_length(p_parcelas), 0);
BEGIN
  IF v_n = 0 THEN RAISE EXCEPTION 'A venda precisa de ao menos uma parcela.'; END IF;
  IF COALESCE(jsonb_array_length(p_corretores), 0) = 0 THEN RAISE EXCEPTION 'Selecione o corretor responsável.'; END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.vendas (numero_contrato, cliente_nome, vendedor_nome, tem_parceria, parceria_nome, unidade,
      empreendimento_id, parceiro_id, valor, valor_venda, data_venda, comissao_percentual_bruta, forma_pagamento,
      captador_corretor_id, agenciador_tipo, status, observacao)
    SELECT r.numero_contrato, r.cliente_nome, r.vendedor_nome, r.tem_parceria, r.parceria_nome, r.unidade,
      r.empreendimento_id, r.parceiro_id, r.valor, r.valor_venda, r.data_venda, r.comissao_percentual_bruta, r.forma_pagamento,
      r.captador_corretor_id, r.agenciador_tipo, r.status, r.observacao
    FROM jsonb_populate_record(NULL::public.vendas, p_venda) r
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.vendas ve SET
      numero_contrato = r.numero_contrato, cliente_nome = r.cliente_nome, vendedor_nome = r.vendedor_nome,
      tem_parceria = r.tem_parceria, parceria_nome = r.parceria_nome, unidade = r.unidade,
      empreendimento_id = r.empreendimento_id, parceiro_id = r.parceiro_id, valor = r.valor, valor_venda = r.valor_venda,
      data_venda = r.data_venda, comissao_percentual_bruta = r.comissao_percentual_bruta, forma_pagamento = r.forma_pagamento,
      captador_corretor_id = r.captador_corretor_id, agenciador_tipo = r.agenciador_tipo, status = r.status, observacao = r.observacao
    FROM jsonb_populate_record(NULL::public.vendas, p_venda) r
    WHERE ve.id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.'; END IF;
    DELETE FROM public.venda_corretores WHERE venda_id = v_id;
  END IF;

  INSERT INTO public.venda_corretores (venda_id, corretor_id, participacao_percentual, percentual_corretor)
  SELECT v_id, (c->>'corretor_id')::uuid, (c->>'participacao_percentual')::numeric, (c->>'percentual_corretor')::numeric
  FROM jsonb_array_elements(p_corretores) c;

  -- Parcelas removidas do formulário (número acima do novo total)
  DELETE FROM public.venda_parcelas WHERE venda_id = v_id AND numero > v_n;

  -- Atualiza as existentes; preserva data de pagamento já registrada quando o formulário não traz data
  UPDATE public.venda_parcelas p SET
    valor = n.valor, data_prevista = n.data_prevista, tipo = n.tipo,
    data_recebimento = COALESCE(n.data_recebimento, CASE WHEN p.status = 'recebida' THEN p.data_recebimento END),
    status = CASE WHEN n.data_recebimento IS NOT NULL THEN 'recebida' WHEN p.status = 'recebida' THEN 'recebida' ELSE p.status END
  FROM (
    SELECT (x.ord)::int AS numero, (x.e->>'valor')::numeric AS valor, (x.e->>'data_prevista')::date AS data_prevista,
           x.e->>'tipo' AS tipo, NULLIF(x.e->>'data_recebimento','')::date AS data_recebimento
    FROM jsonb_array_elements(p_parcelas) WITH ORDINALITY x(e, ord)
  ) n
  WHERE p.venda_id = v_id AND p.numero = n.numero;

  -- Novas parcelas
  INSERT INTO public.venda_parcelas (venda_id, numero, valor, data_prevista, tipo, status, data_recebimento)
  SELECT v_id, x.ord::int, (x.e->>'valor')::numeric, (x.e->>'data_prevista')::date, x.e->>'tipo',
         CASE WHEN NULLIF(x.e->>'data_recebimento','') IS NOT NULL THEN 'recebida' ELSE 'prevista' END,
         NULLIF(x.e->>'data_recebimento','')::date
  FROM jsonb_array_elements(p_parcelas) WITH ORDINALITY x(e, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.venda_parcelas p WHERE p.venda_id = v_id AND p.numero = x.ord);

  RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.totais_empresa(p_ano integer)
 RETURNS TABLE(vgv numeric, vgv_quitado numeric, qtd_vendas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE((SELECT SUM(vgv_realizado) FROM public.vw_vgv_vendas WHERE EXTRACT(year FROM data_venda) = p_ano), 0),
    COALESCE((SELECT SUM(vgv_quitado) FROM public.vw_vgv_parcelas WHERE EXTRACT(year FROM data_recebimento) = p_ano), 0),
    COALESCE((SELECT COUNT(*) FROM public.vw_vgv_vendas WHERE EXTRACT(year FROM data_venda) = p_ano), 0)
  WHERE public.is_diretor_or_gerente();
$function$
;
CREATE OR REPLACE FUNCTION public.trg_recalc_comissao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'vendas' THEN
    PERFORM public.recalc_comissao_venda(COALESCE(NEW.id, OLD.id));
  ELSE
    PERFORM public.recalc_comissao_venda(COALESCE(NEW.venda_id, OLD.venda_id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_vendas_fase1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.valor_venda IS NULL THEN NEW.valor_venda := NEW.valor; END IF;
  IF TG_OP = 'UPDATE' AND NEW.distrato IS DISTINCT FROM OLD.distrato THEN
    IF NEW.distrato THEN
      NEW.status := 'distrato';
      NEW.distrato_em := COALESCE(NEW.distrato_em, current_date);
      NEW.distrato_por := auth.uid();
    ELSE
      NEW.status := CASE WHEN EXISTS (SELECT 1 FROM public.venda_parcelas p WHERE p.venda_id = NEW.id)
                          AND NOT EXISTS (SELECT 1 FROM public.venda_parcelas p WHERE p.venda_id = NEW.id AND p.status <> 'recebida')
                         THEN 'quitada' ELSE 'ativa' END;
      NEW.distrato_em := NULL;
      NEW.distrato_por := NULL;
    END IF;
  ELSIF NEW.status = 'distrato' AND NOT NEW.distrato THEN
    NEW.distrato := true;
    NEW.distrato_em := COALESCE(NEW.distrato_em, current_date);
    NEW.distrato_por := auth.uid();
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;
CREATE OR REPLACE VIEW public.vw_parcelas_em_atraso WITH (security_invoker=true) AS  SELECT p.id,
    p.numero,
    p.valor,
    p.data_prevista,
    p.dias_adiados,
    p.tipo,
    p.venda_id,
    v.numero_contrato,
    v.cliente_nome,
    v.forma_pagamento
   FROM venda_parcelas p
     JOIN vendas v ON v.id = p.venda_id
  WHERE p.status <> 'recebida'::text AND p.data_recebimento IS NULL AND p.data_prevista < (now() AT TIME ZONE 'America/Sao_Paulo'::text)::date AND v.distrato = false AND v.status <> 'quitada'::text;
CREATE OR REPLACE VIEW public.vw_vgv_corretor WITH (security_invoker=true) AS  WITH s AS (
         SELECT vc.venda_id,
            vc.corretor_id,
            vc.participacao_percentual / NULLIF(sum(vc.participacao_percentual) OVER (PARTITION BY vc.venda_id), 0::numeric) AS fatia
           FROM venda_corretores vc
        )
 SELECT s.venda_id,
    s.corretor_id,
    COALESCE(s.fatia, 0::numeric) AS fatia,
    v.data_venda,
    v.vgv_realizado * COALESCE(s.fatia, 0::numeric) AS vgv_realizado,
    v.vgv_quitado * COALESCE(s.fatia, 0::numeric) AS vgv_quitado,
    v.vgv_a_receber * COALESCE(s.fatia, 0::numeric) AS vgv_a_receber
   FROM s
     JOIN vw_vgv_vendas v ON v.venda_id = s.venda_id;
CREATE OR REPLACE VIEW public.vw_vgv_parcelas WITH (security_invoker=true) AS  WITH tot AS (
         SELECT venda_parcelas.venda_id,
            sum(venda_parcelas.valor) AS total
           FROM venda_parcelas
          GROUP BY venda_parcelas.venda_id
        )
 SELECT p.id AS parcela_id,
    p.venda_id,
    p.data_recebimento,
    p.valor AS valor_parcela,
    ve.valor_venda * p.valor / NULLIF(tot.total, 0::numeric) AS vgv_quitado
   FROM venda_parcelas p
     JOIN vendas ve ON ve.id = p.venda_id
     JOIN tot ON tot.venda_id = p.venda_id
  WHERE p.status = 'recebida'::text AND p.data_recebimento IS NOT NULL AND NOT ve.distrato;
CREATE OR REPLACE VIEW public.vw_vgv_vendas WITH (security_invoker=true) AS  WITH tot AS (
         SELECT venda_parcelas.venda_id,
            sum(venda_parcelas.valor) AS total
           FROM venda_parcelas
          GROUP BY venda_parcelas.venda_id
        ), pag AS (
         SELECT venda_parcelas.venda_id,
            sum(venda_parcelas.valor) AS pago
           FROM venda_parcelas
          WHERE venda_parcelas.status = 'recebida'::text
          GROUP BY venda_parcelas.venda_id
        )
 SELECT ve.id AS venda_id,
    ve.data_venda,
    ve.valor_venda AS vgv_realizado,
    COALESCE(ve.valor_venda * pag.pago / NULLIF(tot.total, 0::numeric), 0::numeric) AS vgv_quitado,
    ve.valor_venda - COALESCE(ve.valor_venda * pag.pago / NULLIF(tot.total, 0::numeric), 0::numeric) AS vgv_a_receber
   FROM vendas ve
     LEFT JOIN tot ON tot.venda_id = ve.id
     LEFT JOIN pag ON pag.venda_id = ve.id
  WHERE NOT ve.distrato;
CREATE TRIGGER log_captacoes AFTER INSERT OR DELETE OR UPDATE ON public.captacoes FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_captacoes_updated_at BEFORE UPDATE ON public.captacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_comissoes AFTER INSERT OR DELETE OR UPDATE ON public.comissoes FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_comissoes_updated_at BEFORE UPDATE ON public.comissoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_configuracoes_updated BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_corretor_documentos AFTER INSERT OR DELETE OR UPDATE ON public.corretor_documentos FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_corretor_documentos_updated_at BEFORE UPDATE ON public.corretor_documentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_corretor_perfil_notas AFTER INSERT OR DELETE OR UPDATE ON public.corretor_perfil_notas FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_corretor_perfil_notas_updated_at BEFORE UPDATE ON public.corretor_perfil_notas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_corretor_perfis AFTER INSERT OR DELETE OR UPDATE ON public.corretor_perfis FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_corretor_perfis_updated_at BEFORE UPDATE ON public.corretor_perfis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_corretores AFTER INSERT OR DELETE OR UPDATE ON public.corretores FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_corretores_updated_at BEFORE UPDATE ON public.corretores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_despesas AFTER INSERT OR DELETE OR UPDATE ON public.despesas FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_despesas_updated_at BEFORE UPDATE ON public.despesas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_empreendimentos AFTER INSERT OR DELETE OR UPDATE ON public.empreendimentos FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_empreendimentos_updated_at BEFORE UPDATE ON public.empreendimentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_equipes AFTER INSERT OR DELETE OR UPDATE ON public.equipes FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_equipes_updated_at BEFORE UPDATE ON public.equipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gestor_faixas_updated_at BEFORE UPDATE ON public.gestor_faixas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_metas_vgv_log AFTER INSERT OR DELETE OR UPDATE ON public.metas_vgv FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER trg_metas_vgv_updated BEFORE UPDATE ON public.metas_vgv FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_parceiros AFTER INSERT OR DELETE OR UPDATE ON public.parceiros FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_parceiros_updated_at BEFORE UPDATE ON public.parceiros FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_role_permissions AFTER INSERT OR DELETE OR UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER trg_role_permissions_updated_at BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_user_roles AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER log_venda_corretores AFTER INSERT OR DELETE OR UPDATE ON public.venda_corretores FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER venda_corretores_recalc_comissao AFTER INSERT OR DELETE OR UPDATE ON public.venda_corretores FOR EACH ROW EXECUTE FUNCTION trg_recalc_comissao();
CREATE TRIGGER log_venda_parcelas AFTER INSERT OR DELETE OR UPDATE ON public.venda_parcelas FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER update_venda_parcelas_updated_at BEFORE UPDATE ON public.venda_parcelas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_vendas AFTER INSERT OR DELETE OR UPDATE ON public.vendas FOR EACH ROW EXECUTE FUNCTION log_alteracao();
CREATE TRIGGER trg_vendas_fase1 BEFORE INSERT OR UPDATE ON public.vendas FOR EACH ROW EXECUTE FUNCTION trg_vendas_fase1();
CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON public.vendas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER vendas_recalc_comissao AFTER INSERT OR UPDATE OF valor, comissao_percentual_bruta ON public.vendas FOR EACH ROW EXECUTE FUNCTION trg_recalc_comissao();
ALTER TABLE public.captacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretor_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretor_perfil_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretor_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestor_faixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_vgv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_corretores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Delete captacoes by manage scope" ON public.captacoes AS PERMISSIVE FOR DELETE TO authenticated USING (can_manage_corretor(corretor_id));
CREATE POLICY "Insert captacoes by scope" ON public.captacoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (can_view_corretor(corretor_id));
CREATE POLICY "Update captacoes by scope" ON public.captacoes AS PERMISSIVE FOR UPDATE TO authenticated USING (can_view_corretor(corretor_id)) WITH CHECK (can_view_corretor(corretor_id));
CREATE POLICY "View captacoes by team scope" ON public.captacoes AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_corretor(corretor_id));
CREATE POLICY comissoes_select ON public.comissoes AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_venda(venda_id));
CREATE POLICY comissoes_write ON public.comissoes AS PERMISSIVE FOR ALL TO authenticated USING ((is_diretor_or_gerente() OR has_permission('financeiro.gerenciar'::text))) WITH CHECK ((is_diretor_or_gerente() OR has_permission('financeiro.gerenciar'::text)));
CREATE POLICY "Autenticados leem configuracoes" ON public.configuracoes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Diretor altera configuracoes" ON public.configuracoes AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role)) WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Diretor insere configuracoes" ON public.configuracoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Delete documentos por diretor" ON public.corretor_documentos AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Diretor le documentos" ON public.corretor_documentos AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Insert documentos por gestao" ON public.corretor_documentos AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (can_manage_corretor(corretor_id));
CREATE POLICY "Update documentos por gestao" ON public.corretor_documentos AS PERMISSIVE FOR UPDATE TO authenticated USING (can_manage_corretor(corretor_id)) WITH CHECK (can_manage_corretor(corretor_id));
CREATE POLICY "Manage notas by manage scope" ON public.corretor_perfil_notas AS PERMISSIVE FOR ALL TO authenticated USING (can_manage_corretor(corretor_id)) WITH CHECK (can_manage_corretor(corretor_id));
CREATE POLICY "Delete perfis by manage scope" ON public.corretor_perfis AS PERMISSIVE FOR DELETE TO authenticated USING (can_manage_corretor(corretor_id));
CREATE POLICY "Insert perfis by manage scope" ON public.corretor_perfis AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (can_manage_corretor(corretor_id));
CREATE POLICY "Update perfis by manage scope" ON public.corretor_perfis AS PERMISSIVE FOR UPDATE TO authenticated USING (can_manage_corretor(corretor_id)) WITH CHECK (can_manage_corretor(corretor_id));
CREATE POLICY "View perfis by scope" ON public.corretor_perfis AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_corretor(corretor_id));
CREATE POLICY "Diretores manage corretores" ON public.corretores AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role)) WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Gestoras update own team corretores" ON public.corretores AS PERMISSIVE FOR UPDATE TO authenticated USING (can_manage_corretor(id)) WITH CHECK (can_manage_corretor(id));
CREATE POLICY "View corretores by team scope" ON public.corretores AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_corretor(id));
CREATE POLICY despesas_write ON public.despesas AS PERMISSIVE FOR ALL TO authenticated USING ((is_diretor_or_gerente() OR has_permission('financeiro.gerenciar'::text))) WITH CHECK ((is_diretor_or_gerente() OR has_permission('financeiro.gerenciar'::text)));
CREATE POLICY "Users with a role view empreendimentos" ON public.empreendimentos AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE (ur.user_id = auth.uid()))));
CREATE POLICY empreendimentos_write ON public.empreendimentos AS PERMISSIVE FOR ALL TO authenticated USING ((is_diretor_or_gerente() OR has_permission('empreendimentos.gerenciar'::text))) WITH CHECK ((is_diretor_or_gerente() OR has_permission('empreendimentos.gerenciar'::text)));
CREATE POLICY "Diretores manage equipes" ON public.equipes AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role)) WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Gestoras view own equipes" ON public.equipes AS PERMISSIVE FOR SELECT TO authenticated USING ((gestor_user_id = auth.uid()));
CREATE POLICY gestor_faixas_select_gestao ON public.gestor_faixas AS PERMISSIVE FOR SELECT TO authenticated USING (is_diretor_or_gerente());
CREATE POLICY gestor_faixas_write ON public.gestor_faixas AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role)) WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "metas escrita diretor" ON public.metas_vgv AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role)) WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "metas leitura autenticados com cargo" ON public.metas_vgv AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid()))));
CREATE POLICY parceiros_select_gestao ON public.parceiros AS PERMISSIVE FOR SELECT TO authenticated USING ((is_diretor_or_gerente() OR has_permission('parceiros.gerenciar'::text)));
CREATE POLICY parceiros_write ON public.parceiros AS PERMISSIVE FOR ALL TO authenticated USING ((is_diretor_or_gerente() OR has_permission('parceiros.gerenciar'::text))) WITH CHECK ((is_diretor_or_gerente() OR has_permission('parceiros.gerenciar'::text)));
CREATE POLICY role_permissions_select_own_roles ON public.role_permissions AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'diretor'::app_role) OR (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = role_permissions.role))))));
CREATE POLICY role_permissions_write ON public.role_permissions AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role)) WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Diretor le logs" ON public.system_logs AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Usuario registra proprio log" ON public.system_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id IS NULL) OR (user_id = auth.uid())));
CREATE POLICY "Diretores manage user_roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role)) WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY "Users view own roles or diretor views all" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'diretor'::app_role)));
CREATE POLICY venda_corretores_delete ON public.venda_corretores AS PERMISSIVE FOR DELETE TO authenticated USING (can_manage_venda(venda_id));
CREATE POLICY venda_corretores_insert ON public.venda_corretores AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_diretor_or_gerente() OR has_permission('vendas.gerenciar'::text) OR (corretor_id = get_my_corretor_id())));
CREATE POLICY venda_corretores_modify ON public.venda_corretores AS PERMISSIVE FOR UPDATE TO authenticated USING (can_manage_venda(venda_id)) WITH CHECK (can_manage_venda(venda_id));
CREATE POLICY venda_corretores_select ON public.venda_corretores AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_venda(venda_id));
CREATE POLICY venda_parcelas_select ON public.venda_parcelas AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_venda(venda_id));
CREATE POLICY venda_parcelas_write ON public.venda_parcelas AS PERMISSIVE FOR ALL TO authenticated USING (can_manage_venda(venda_id)) WITH CHECK (can_manage_venda(venda_id));
CREATE POLICY vendas_delete ON public.vendas AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY vendas_insert ON public.vendas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_diretor_or_gerente() OR has_permission('vendas.gerenciar'::text) OR (get_my_corretor_id() IS NOT NULL)));
CREATE POLICY vendas_select ON public.vendas AS PERMISSIVE FOR SELECT TO authenticated USING (can_view_venda(id));
CREATE POLICY vendas_update ON public.vendas AS PERMISSIVE FOR UPDATE TO authenticated USING (can_manage_venda(id)) WITH CHECK (can_manage_venda(id));
CREATE POLICY "Delete fotos corretor by manage scope" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'corretor-fotos'::text) AND can_manage_corretor(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Insert fotos corretor by manage scope" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'corretor-fotos'::text) AND can_manage_corretor(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Update fotos corretor by manage scope" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'corretor-fotos'::text) AND can_manage_corretor(((storage.foldername(name))[1])::uuid))) WITH CHECK (((bucket_id = 'corretor-fotos'::text) AND can_manage_corretor(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "View fotos corretor by scope" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'corretor-fotos'::text) AND can_view_corretor(((storage.foldername(name))[1])::uuid)));
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('corretor-fotos', 'corretor-fotos', 'f', NULL, NULL) ON CONFLICT (id) DO NOTHING;
-- can_manage_corretor(uuid) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- can_manage_venda(uuid) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- can_view_corretor(uuid) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- can_view_venda(uuid) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- comissao_gestor_mensal(integer,integer) ACL: {postgres=X/postgres,service_role=X/postgres}
-- corretor_vgv_historico(uuid) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- dashboard_mensal(integer) ACL: {postgres=X/postgres,service_role=X/postgres}
-- fechamento_corretores(date,date) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- fechamento_is_gestao() ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- fechamento_totais(date,date) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- get_corretor_cpf(uuid) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- get_my_corretor_id() ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- get_my_equipe_ids() ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- handle_new_user_role() ACL: {postgres=X/postgres,service_role=X/postgres}
-- has_permission(text) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- has_role(uuid,app_role) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- is_diretor_or_gerente() ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- list_users() ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- list_users_status() ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- log_alteracao() ACL: {postgres=X/postgres,service_role=X/postgres}
-- ranking_corretores(text) ACL: {postgres=X/postgres,service_role=X/postgres}
-- ranking_periodo(integer,integer[]) ACL: {postgres=X/postgres,service_role=X/postgres}
-- recalc_comissao_venda(uuid) ACL: {postgres=X/postgres,service_role=X/postgres}
-- resumo_dashboard_anual(integer) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- salvar_venda(uuid,jsonb,jsonb,jsonb) ACL: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- totais_empresa(integer) ACL: {postgres=X/postgres,service_role=X/postgres}
-- trg_recalc_comissao() ACL: {postgres=X/postgres,service_role=X/postgres}
-- trg_vendas_fase1() ACL: {postgres=X/postgres,service_role=X/postgres}
-- update_updated_at_column() ACL: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- captacoes: id uuid, empreendimento_id uuid, corretor_id uuid, data_captacao date, endereco text, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone
-- comissoes: id uuid, venda_id uuid, percentual_total numeric, valor_total numeric, valor_corretores numeric, valor_empresa numeric, status text, data_recebimento date, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone
-- configuracoes: chave text, valor numeric, descricao text, created_at timestamp with time zone, updated_at timestamp with time zone
-- corretor_documentos: id uuid, corretor_id uuid, cpf text, created_at timestamp with time zone, updated_at timestamp with time zone
-- corretor_perfil_notas: id uuid, corretor_id uuid, observacoes text, created_at timestamp with time zone, updated_at timestamp with time zone
-- corretor_perfis: id uuid, corretor_id uuid, data_nascimento date, telefone_pessoal text, email_pessoal text, creci text, foto_url text, disc_dominancia integer, disc_influencia integer, disc_estabilidade integer, disc_conformidade integer, created_at timestamp with time zone, updated_at timestamp with time zone
-- corretores: id uuid, user_id uuid, nome text, comissao_percentual numeric, ativo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, email text, equipe_id uuid
-- despesas: id uuid, categoria text, descricao text, valor numeric, mes integer, ano integer, tipo text, created_at timestamp with time zone, updated_at timestamp with time zone
-- empreendimentos: id uuid, nome text, descricao text, created_at timestamp with time zone, updated_at timestamp with time zone, tipo text, rua text, numero text, complemento text, condominio text, bairro text, cidade text
-- equipes: id uuid, nome text, gestor_user_id uuid, ativo boolean, created_at timestamp with time zone, updated_at timestamp with time zone
-- gestor_faixas: id uuid, faturamento_min numeric, faturamento_max numeric, percentual numeric, base text, ativo boolean, created_at timestamp with time zone, updated_at timestamp with time zone
-- metas_vgv: id uuid, tipo text, ano integer, periodo integer, valor numeric, created_at timestamp with time zone, updated_at timestamp with time zone
-- parceiros: id uuid, nome text, tipo text, cnpj text, creci text, pix text, email text, telefone text, endereco text, comissao_percentual numeric, ativo boolean, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone
-- role_permissions: id uuid, role USER-DEFINED, permission text, allowed boolean, created_at timestamp with time zone, updated_at timestamp with time zone
-- system_logs: id uuid, user_id uuid, user_email text, acao text, entidade text, entidade_id text, descricao text, detalhes jsonb, created_at timestamp with time zone
-- user_roles: id uuid, user_id uuid, role USER-DEFINED
-- venda_corretores: id uuid, venda_id uuid, corretor_id uuid, percentual_corretor numeric, participacao_percentual numeric, created_at timestamp with time zone
-- venda_parcelas: id uuid, venda_id uuid, numero integer, tipo text, valor numeric, data_prevista date, data_recebimento date, dias_adiados integer, status text, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone
-- vendas: id uuid, numero_contrato text, empreendimento_id uuid, parceiro_id uuid, captador_corretor_id uuid, unidade text, cliente_nome text, valor numeric, data_venda date, forma_pagamento text, comissao_percentual_bruta numeric, status text, roi_trafego text, observacao text, created_at timestamp with time zone, updated_at timestamp with time zone, agenciador_tipo text, vendedor_nome text, tem_parceria boolean, parceria_nome text, valor_venda numeric, distrato boolean, distrato_em date, distrato_por uuid
-- vw_parcelas_em_atraso: id uuid, numero integer, valor numeric, data_prevista date, dias_adiados integer, tipo text, venda_id uuid, numero_contrato text, cliente_nome text, forma_pagamento text
-- vw_vgv_corretor: venda_id uuid, corretor_id uuid, fatia numeric, data_venda date, vgv_realizado numeric, vgv_quitado numeric, vgv_a_receber numeric
-- vw_vgv_parcelas: parcela_id uuid, venda_id uuid, data_recebimento date, valor_parcela numeric, vgv_quitado numeric
-- vw_vgv_vendas: venda_id uuid, data_venda date, vgv_realizado numeric, vgv_quitado numeric, vgv_a_receber numeric
