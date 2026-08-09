ALTER TABLE public.empreendimentos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'lancamento';

ALTER TABLE public.empreendimentos
  DROP CONSTRAINT IF EXISTS empreendimentos_tipo_check;

ALTER TABLE public.empreendimentos
  ADD CONSTRAINT empreendimentos_tipo_check
  CHECK (tipo IN ('pronto','lancamento','estoque','mcmv'));

CREATE OR REPLACE FUNCTION public.recalc_comissao_venda(p_venda_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valor numeric; v_pct numeric; v_total numeric; v_corretores numeric;
  v_tipo text; v_captador uuid; v_captador_valor numeric := 0;
BEGIN
  SELECT ve.valor, ve.comissao_percentual_bruta, ve.captador_corretor_id, COALESCE(e.tipo,'lancamento')
    INTO v_valor, v_pct, v_captador, v_tipo
  FROM public.vendas ve
  LEFT JOIN public.empreendimentos e ON e.id = ve.empreendimento_id
  WHERE ve.id = p_venda_id;

  IF v_valor IS NULL THEN RETURN; END IF;
  v_total := v_valor * COALESCE(v_pct,6) / 100;

  IF v_tipo = 'pronto' THEN
    -- imóvel pronto: vendedor 40%, agenciador (captador) 10%
    SELECT COALESCE(SUM(v_total * 40 / 100 * vc.participacao_percentual / 100), 0)
      INTO v_corretores FROM public.venda_corretores vc WHERE vc.venda_id = p_venda_id;
    IF v_captador IS NOT NULL THEN
      v_captador_valor := v_total * 10 / 100;
    END IF;
    v_corretores := v_corretores + v_captador_valor;
  ELSE
    SELECT COALESCE(SUM(v_total * vc.percentual_corretor / 100 * vc.participacao_percentual / 100), 0)
      INTO v_corretores FROM public.venda_corretores vc WHERE vc.venda_id = p_venda_id;
  END IF;

  INSERT INTO public.comissoes (venda_id, percentual_total, valor_total, valor_corretores, valor_empresa)
  VALUES (p_venda_id, COALESCE(v_pct,6), v_total, v_corretores, v_total - v_corretores)
  ON CONFLICT (venda_id) DO UPDATE
    SET percentual_total = EXCLUDED.percentual_total,
        valor_total = EXCLUDED.valor_total,
        valor_corretores = EXCLUDED.valor_corretores,
        valor_empresa = EXCLUDED.valor_empresa,
        updated_at = now();
END;
$function$;