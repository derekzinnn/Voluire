-- Salva venda + corretores + parcelas numa única transação (tudo ou nada).
-- Parcelas são casadas pelo número: pagamento já registrado nunca é apagado por um formulário sem data.
CREATE OR REPLACE FUNCTION public.salvar_venda(p_id uuid, p_venda jsonb, p_corretores jsonb, p_parcelas jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.salvar_venda(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_venda(uuid, jsonb, jsonb, jsonb) TO authenticated;