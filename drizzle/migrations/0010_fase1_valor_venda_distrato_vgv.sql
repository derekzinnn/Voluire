-- Configurações do sistema (taxa padrão de comissão)
CREATE TABLE public.configuracoes (
  chave text PRIMARY KEY,
  valor numeric NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.configuracoes TO authenticated;
GRANT INSERT, UPDATE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Diretor insere configuracoes" ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'diretor'));
CREATE POLICY "Diretor altera configuracoes" ON public.configuracoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'diretor')) WITH CHECK (public.has_role(auth.uid(), 'diretor'));
CREATE TRIGGER trg_configuracoes_updated BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.configuracoes (chave, valor, descricao)
SELECT 'taxa_comissao_padrao', 6, 'Taxa padrão de comissão (%) usada para calcular o Valor de Venda (VGV proporcional)';

-- Novos campos na venda
ALTER TABLE public.vendas
  ADD COLUMN valor_venda numeric,
  ADD COLUMN distrato boolean NOT NULL DEFAULT false,
  ADD COLUMN distrato_em date,
  ADD COLUMN distrato_por uuid;

UPDATE public.vendas SET valor_venda = valor WHERE valor_venda IS NULL;
UPDATE public.vendas SET distrato = true, distrato_em = updated_at::date WHERE status = 'distrato';

COMMENT ON COLUMN public.vendas.valor IS 'Valor do Contrato: preço real do imóvel. Apenas registro/busca e base da comissão; NÃO alimenta relatórios.';
COMMENT ON COLUMN public.vendas.valor_venda IS 'Valor de Venda: VGV proporcional (comissão cobrada / taxa padrão). Único valor usado em Dashboard, Fechamento e rankings.';

-- Trigger: preenche valor_venda e mantém distrato coerente com status
CREATE OR REPLACE FUNCTION public.trg_vendas_fase1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_vendas_fase1() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_vendas_fase1 BEFORE INSERT OR UPDATE ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.trg_vendas_fase1();

-- Fonte única de verdade do VGV (respeita RLS de quem consulta)
CREATE VIEW public.vw_vgv_vendas WITH (security_invoker = true) AS
WITH tot AS (SELECT venda_id, SUM(valor) AS total FROM public.venda_parcelas GROUP BY venda_id),
     pag AS (SELECT venda_id, SUM(valor) AS pago FROM public.venda_parcelas WHERE status = 'recebida' GROUP BY venda_id)
SELECT ve.id AS venda_id, ve.data_venda,
       ve.valor_venda AS vgv_realizado,
       COALESCE(ve.valor_venda * pag.pago / NULLIF(tot.total, 0), 0) AS vgv_quitado,
       ve.valor_venda - COALESCE(ve.valor_venda * pag.pago / NULLIF(tot.total, 0), 0) AS vgv_a_receber
FROM public.vendas ve
LEFT JOIN tot ON tot.venda_id = ve.id
LEFT JOIN pag ON pag.venda_id = ve.id
WHERE NOT ve.distrato;

-- VGV quitado por parcela paga, na data do PAGAMENTO
CREATE VIEW public.vw_vgv_parcelas WITH (security_invoker = true) AS
WITH tot AS (SELECT venda_id, SUM(valor) AS total FROM public.venda_parcelas GROUP BY venda_id)
SELECT p.id AS parcela_id, p.venda_id, p.data_recebimento, p.valor AS valor_parcela,
       ve.valor_venda * p.valor / NULLIF(tot.total, 0) AS vgv_quitado
FROM public.venda_parcelas p
JOIN public.vendas ve ON ve.id = p.venda_id
JOIN tot ON tot.venda_id = p.venda_id
WHERE p.status = 'recebida' AND p.data_recebimento IS NOT NULL AND NOT ve.distrato;

-- Fatia de cada corretor no VGV (participação normalizada entre os corretores da venda)
CREATE VIEW public.vw_vgv_corretor WITH (security_invoker = true) AS
WITH s AS (
  SELECT vc.venda_id, vc.corretor_id,
         vc.participacao_percentual / NULLIF(SUM(vc.participacao_percentual) OVER (PARTITION BY vc.venda_id), 0) AS fatia
  FROM public.venda_corretores vc
)
SELECT s.venda_id, s.corretor_id, COALESCE(s.fatia, 0) AS fatia, v.data_venda,
       v.vgv_realizado * COALESCE(s.fatia, 0) AS vgv_realizado,
       v.vgv_quitado * COALESCE(s.fatia, 0) AS vgv_quitado,
       v.vgv_a_receber * COALESCE(s.fatia, 0) AS vgv_a_receber
FROM s JOIN public.vw_vgv_vendas v ON v.venda_id = s.venda_id;

GRANT SELECT ON public.vw_vgv_vendas, public.vw_vgv_parcelas, public.vw_vgv_corretor TO authenticated;
GRANT SELECT ON public.vw_vgv_vendas, public.vw_vgv_parcelas, public.vw_vgv_corretor TO service_role;

-- Relatórios passam a ler das views
CREATE OR REPLACE FUNCTION public.resumo_dashboard_anual(p_ano integer)
RETURNS TABLE(mes integer, vgv numeric, vgv_quitado numeric, comissao_bruta numeric, corretores numeric, gestores numeric, voluire numeric, qtd_vendas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.ranking_periodo(p_ano integer, p_meses integer[])
RETURNS TABLE(corretor_id uuid, corretor_nome text, vgv numeric, qtd_vendas bigint, vgv_quitado numeric, qtd_quitadas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.totais_empresa(p_ano integer)
RETURNS TABLE(vgv numeric, vgv_quitado numeric, qtd_vendas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT SUM(vgv_realizado) FROM public.vw_vgv_vendas WHERE EXTRACT(year FROM data_venda) = p_ano), 0),
    COALESCE((SELECT SUM(vgv_quitado) FROM public.vw_vgv_parcelas WHERE EXTRACT(year FROM data_recebimento) = p_ano), 0),
    COALESCE((SELECT COUNT(*) FROM public.vw_vgv_vendas WHERE EXTRACT(year FROM data_venda) = p_ano), 0)
  WHERE public.is_diretor_or_gerente();
$$;