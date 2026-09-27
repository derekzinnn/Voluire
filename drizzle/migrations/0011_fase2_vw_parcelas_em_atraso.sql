CREATE OR REPLACE VIEW public.vw_parcelas_em_atraso WITH (security_invoker = true) AS
SELECT p.id, p.numero, p.valor, p.data_prevista, p.dias_adiados, p.tipo, p.venda_id,
       v.numero_contrato, v.cliente_nome, v.forma_pagamento
FROM public.venda_parcelas p
JOIN public.vendas v ON v.id = p.venda_id
WHERE p.status <> 'recebida'
  AND p.data_recebimento IS NULL
  AND p.data_prevista < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND v.distrato = false
  AND v.status <> 'quitada';
GRANT SELECT ON public.vw_parcelas_em_atraso TO authenticated;
GRANT ALL ON public.vw_parcelas_em_atraso TO service_role;
COMMENT ON VIEW public.vw_parcelas_em_atraso IS 'Fonte única da regra de parcela em atraso (Fase 2).';