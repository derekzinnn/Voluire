-- ============ LIMPEZA DO NÚCLEO ANTIGO ============
DROP TRIGGER IF EXISTS on_venda_create_comissao ON public.vendas;
DROP FUNCTION IF EXISTS public.create_comissao_on_venda();
DROP FUNCTION IF EXISTS public.dashboard_mensal(integer);
DROP FUNCTION IF EXISTS public.ranking_corretores(text);
DROP FUNCTION IF EXISTS public.ranking_periodo(integer, integer[]);
DROP FUNCTION IF EXISTS public.totais_empresa(integer);

ALTER TABLE public.captacoes DROP CONSTRAINT IF EXISTS captacoes_empreendimento_id_fkey;
DROP TABLE IF EXISTS public.comissoes CASCADE;
DROP TABLE IF EXISTS public.vendas CASCADE;

-- ============ PARCEIROS / CONSTRUTORAS ============
CREATE TABLE public.parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'construtora',
  cnpj text,
  creci text,
  pix text,
  email text,
  telefone text,
  endereco text,
  comissao_percentual numeric NOT NULL DEFAULT 6,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros TO authenticated;
GRANT ALL ON public.parceiros TO service_role;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parceiros_select" ON public.parceiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "parceiros_write" ON public.parceiros FOR ALL TO authenticated
  USING (public.is_diretor_or_gerente()) WITH CHECK (public.is_diretor_or_gerente());
CREATE TRIGGER update_parceiros_updated_at BEFORE UPDATE ON public.parceiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FAIXAS DE COMISSÃO DO GESTOR ============
CREATE TABLE public.gestor_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faturamento_min numeric NOT NULL,
  faturamento_max numeric,
  percentual numeric NOT NULL,
  base text NOT NULL DEFAULT 'comissao_bruta',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestor_faixas TO authenticated;
GRANT ALL ON public.gestor_faixas TO service_role;
ALTER TABLE public.gestor_faixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gestor_faixas_select" ON public.gestor_faixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "gestor_faixas_write" ON public.gestor_faixas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'diretor')) WITH CHECK (public.has_role(auth.uid(),'diretor'));
CREATE TRIGGER update_gestor_faixas_updated_at BEFORE UPDATE ON public.gestor_faixas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.gestor_faixas (faturamento_min, faturamento_max, percentual) VALUES
  (0, 1500000, 8), (1500000, 3000000, 10), (3000000, NULL, 12);

-- ============ VENDAS (CONTRATOS) ============
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrato text NOT NULL UNIQUE,
  empreendimento_id uuid REFERENCES public.empreendimentos(id),
  parceiro_id uuid REFERENCES public.parceiros(id),
  captador_corretor_id uuid REFERENCES public.corretores(id),
  unidade text NOT NULL,
  cliente_nome text NOT NULL,
  valor numeric NOT NULL,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text NOT NULL DEFAULT 'a_vista',
  comissao_percentual_bruta numeric NOT NULL DEFAULT 6,
  status text NOT NULL DEFAULT 'ativa',
  roi_trafego text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated;
GRANT ALL ON public.vendas TO service_role;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.venda_corretores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  corretor_id uuid NOT NULL REFERENCES public.corretores(id),
  percentual_corretor numeric NOT NULL,
  participacao_percentual numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venda_id, corretor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_corretores TO authenticated;
GRANT ALL ON public.venda_corretores TO service_role;
ALTER TABLE public.venda_corretores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.venda_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 1,
  tipo text NOT NULL DEFAULT 'parcela',
  valor numeric NOT NULL,
  data_prevista date NOT NULL,
  data_recebimento date,
  dias_adiados integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_parcelas TO authenticated;
GRANT ALL ON public.venda_parcelas TO service_role;
ALTER TABLE public.venda_parcelas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_venda_parcelas_updated_at BEFORE UPDATE ON public.venda_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL UNIQUE REFERENCES public.vendas(id) ON DELETE CASCADE,
  percentual_total numeric NOT NULL DEFAULT 6,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_corretores numeric NOT NULL DEFAULT 0,
  valor_empresa numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'a_receber',
  data_recebimento date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes TO authenticated;
GRANT ALL ON public.comissoes TO service_role;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_comissoes_updated_at BEFORE UPDATE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VISIBILIDADE ============
CREATE OR REPLACE FUNCTION public.can_view_venda(p_venda_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'diretor') THEN true
    WHEN p_venda_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.venda_corretores vc
      WHERE vc.venda_id = p_venda_id AND public.can_view_corretor(vc.corretor_id)
    ) OR EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.id = p_venda_id AND public.can_view_corretor(v.captador_corretor_id)
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.can_manage_venda(p_venda_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'diretor') THEN true
    WHEN p_venda_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.venda_corretores vc
      WHERE vc.venda_id = p_venda_id AND public.can_manage_corretor(vc.corretor_id)
    )
  END
$$;

CREATE POLICY "vendas_select" ON public.vendas FOR SELECT TO authenticated
  USING (public.can_view_venda(id));
CREATE POLICY "vendas_insert" ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (public.is_diretor_or_gerente() OR public.get_my_corretor_id() IS NOT NULL);
CREATE POLICY "vendas_update" ON public.vendas FOR UPDATE TO authenticated
  USING (public.can_manage_venda(id)) WITH CHECK (public.can_manage_venda(id));
CREATE POLICY "vendas_delete" ON public.vendas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'diretor'));

CREATE POLICY "venda_corretores_select" ON public.venda_corretores FOR SELECT TO authenticated
  USING (public.can_view_venda(venda_id));
CREATE POLICY "venda_corretores_insert" ON public.venda_corretores FOR INSERT TO authenticated
  WITH CHECK (public.is_diretor_or_gerente() OR corretor_id = public.get_my_corretor_id());
CREATE POLICY "venda_corretores_modify" ON public.venda_corretores FOR UPDATE TO authenticated
  USING (public.can_manage_venda(venda_id)) WITH CHECK (public.can_manage_venda(venda_id));
CREATE POLICY "venda_corretores_delete" ON public.venda_corretores FOR DELETE TO authenticated
  USING (public.can_manage_venda(venda_id));

CREATE POLICY "venda_parcelas_select" ON public.venda_parcelas FOR SELECT TO authenticated
  USING (public.can_view_venda(venda_id));
CREATE POLICY "venda_parcelas_write" ON public.venda_parcelas FOR ALL TO authenticated
  USING (public.can_manage_venda(venda_id)) WITH CHECK (public.can_manage_venda(venda_id));

CREATE POLICY "comissoes_select" ON public.comissoes FOR SELECT TO authenticated
  USING (public.can_view_venda(venda_id));
CREATE POLICY "comissoes_write" ON public.comissoes FOR ALL TO authenticated
  USING (public.is_diretor_or_gerente()) WITH CHECK (public.is_diretor_or_gerente());

-- ============ CÁLCULO DA COMISSÃO ============
CREATE OR REPLACE FUNCTION public.recalc_comissao_venda(p_venda_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_valor numeric; v_pct numeric; v_total numeric; v_corretores numeric;
BEGIN
  SELECT valor, comissao_percentual_bruta INTO v_valor, v_pct FROM public.vendas WHERE id = p_venda_id;
  IF v_valor IS NULL THEN RETURN; END IF;
  v_total := v_valor * COALESCE(v_pct,6) / 100;
  SELECT COALESCE(SUM(v_total * vc.percentual_corretor / 100 * vc.participacao_percentual / 100), 0)
    INTO v_corretores FROM public.venda_corretores vc WHERE vc.venda_id = p_venda_id;

  INSERT INTO public.comissoes (venda_id, percentual_total, valor_total, valor_corretores, valor_empresa)
  VALUES (p_venda_id, COALESCE(v_pct,6), v_total, v_corretores, v_total - v_corretores)
  ON CONFLICT (venda_id) DO UPDATE
    SET percentual_total = EXCLUDED.percentual_total,
        valor_total = EXCLUDED.valor_total,
        valor_corretores = EXCLUDED.valor_corretores,
        valor_empresa = EXCLUDED.valor_empresa,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_comissao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_TABLE_NAME = 'vendas' THEN
    PERFORM public.recalc_comissao_venda(COALESCE(NEW.id, OLD.id));
  ELSE
    PERFORM public.recalc_comissao_venda(COALESCE(NEW.venda_id, OLD.venda_id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER vendas_recalc_comissao AFTER INSERT OR UPDATE OF valor, comissao_percentual_bruta
  ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_comissao();
CREATE TRIGGER venda_corretores_recalc_comissao AFTER INSERT OR UPDATE OR DELETE
  ON public.venda_corretores FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_comissao();

-- ============ AGREGADOS ============
CREATE OR REPLACE FUNCTION public.dashboard_mensal(p_ano integer)
RETURNS TABLE(mes integer, vgv numeric, vgv_quitado numeric, comissao_a_receber numeric, comissao_recebida numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.totais_empresa(p_ano integer)
RETURNS TABLE(vgv numeric, vgv_quitado numeric, qtd_vendas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    COALESCE((SELECT SUM(valor) FROM public.vendas
              WHERE status <> 'distrato' AND EXTRACT(year FROM data_venda) = p_ano), 0),
    COALESCE((SELECT SUM(ve.valor) FROM public.comissoes c
              JOIN public.vendas ve ON ve.id = c.venda_id
              WHERE c.status = 'recebido' AND c.data_recebimento IS NOT NULL
                AND ve.status <> 'distrato'
                AND EXTRACT(year FROM c.data_recebimento) = p_ano), 0),
    COALESCE((SELECT COUNT(*) FROM public.vendas
              WHERE status <> 'distrato' AND EXTRACT(year FROM data_venda) = p_ano), 0)
  WHERE public.is_diretor_or_gerente();
$$;

CREATE OR REPLACE FUNCTION public.ranking_periodo(p_ano integer, p_meses integer[])
RETURNS TABLE(corretor_id uuid, corretor_nome text, vgv numeric, qtd_vendas bigint, vgv_quitado numeric, qtd_quitadas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH v AS (
    SELECT vc.corretor_id, SUM(ve.valor * vc.participacao_percentual / 100) AS total, COUNT(*) AS qtd
    FROM public.venda_corretores vc JOIN public.vendas ve ON ve.id = vc.venda_id
    WHERE ve.status <> 'distrato' AND EXTRACT(year FROM ve.data_venda) = p_ano
      AND EXTRACT(month FROM ve.data_venda)::int = ANY(p_meses)
      AND public.can_view_corretor(vc.corretor_id)
    GROUP BY 1
  ),
  q AS (
    SELECT vc.corretor_id, SUM(ve.valor * vc.participacao_percentual / 100) AS total, COUNT(*) AS qtd
    FROM public.comissoes c
    JOIN public.vendas ve ON ve.id = c.venda_id
    JOIN public.venda_corretores vc ON vc.venda_id = ve.id
    WHERE c.status = 'recebido' AND c.data_recebimento IS NOT NULL AND ve.status <> 'distrato'
      AND EXTRACT(year FROM c.data_recebimento) = p_ano
      AND EXTRACT(month FROM c.data_recebimento)::int = ANY(p_meses)
      AND public.can_view_corretor(vc.corretor_id)
    GROUP BY 1
  )
  SELECT co.id, co.nome, COALESCE(v.total,0), COALESCE(v.qtd,0), COALESCE(q.total,0), COALESCE(q.qtd,0)
  FROM public.corretores co
  LEFT JOIN v ON v.corretor_id = co.id
  LEFT JOIN q ON q.corretor_id = co.id
  WHERE public.can_view_corretor(co.id)
    AND (COALESCE(v.total,0) > 0 OR COALESCE(q.total,0) > 0)
  ORDER BY COALESCE(v.total,0) DESC;
$$;

CREATE OR REPLACE FUNCTION public.ranking_corretores(p_status text DEFAULT 'ativa'::text)
RETURNS TABLE(corretor_id uuid, corretor_nome text, total_vgv numeric, total_vendas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.nome,
         COALESCE(SUM(ve.valor * vc.participacao_percentual / 100), 0),
         COUNT(ve.id)
  FROM public.corretores c
  LEFT JOIN public.venda_corretores vc ON vc.corretor_id = c.id
  LEFT JOIN public.vendas ve ON ve.id = vc.venda_id AND ve.status = p_status
  WHERE c.ativo = true AND public.can_view_corretor(c.id)
  GROUP BY c.id, c.nome
  ORDER BY 3 DESC;
$$;

-- Comissão do gestor: faturamento da equipe no mês (excluindo vendas do próprio gestor)
CREATE OR REPLACE FUNCTION public.comissao_gestor_mensal(p_ano integer, p_mes integer)
RETURNS TABLE(equipe_id uuid, equipe_nome text, gestor_user_id uuid, vgv_equipe numeric,
              comissao_bruta_equipe numeric, faixa_percentual numeric, valor_gestor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (
    SELECT e.id, e.nome, e.gestor_user_id,
           COALESCE(SUM(ve.valor * vc.participacao_percentual / 100), 0) AS vgv,
           COALESCE(SUM(ve.valor * vc.participacao_percentual / 100 * ve.comissao_percentual_bruta / 100), 0) AS bruta
    FROM public.equipes e
    LEFT JOIN public.corretores c ON c.equipe_id = e.id AND (e.gestor_user_id IS NULL OR c.user_id IS DISTINCT FROM e.gestor_user_id)
    LEFT JOIN public.venda_corretores vc ON vc.corretor_id = c.id
    LEFT JOIN public.vendas ve ON ve.id = vc.venda_id AND ve.status <> 'distrato'
      AND EXTRACT(year FROM ve.data_venda) = p_ano AND EXTRACT(month FROM ve.data_venda)::int = p_mes
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
$$;

-- restaura FK de captacoes
ALTER TABLE public.captacoes
  ADD CONSTRAINT captacoes_empreendimento_id_fkey
  FOREIGN KEY (empreendimento_id) REFERENCES public.empreendimentos(id);
