-- Prova dos Exemplos A e B da regra de VGV quitado proporcional.
-- Roda dentro de uma transação e desfaz tudo no final (ROLLBACK): não deixa dados.
BEGIN;
WITH a AS (
  INSERT INTO public.vendas (numero_contrato, unidade, cliente_nome, valor, valor_venda, data_venda, forma_pagamento, comissao_percentual_bruta, status)
  VALUES ('TESTE-A', '1', 'Teste A', 100000, 100000, '2026-01-10', 'parcelado', 6, 'ativa') RETURNING id
), pa AS (
  INSERT INTO public.venda_parcelas (venda_id, numero, tipo, valor, data_prevista, data_recebimento, status)
  SELECT a.id, n, 'parcelado', 1500, '2026-02-10', CASE WHEN n <= 2 THEN date '2026-03-05' END,
         CASE WHEN n <= 2 THEN 'recebida' ELSE 'prevista' END
  FROM a, generate_series(1,4) n RETURNING 1
), b AS (
  INSERT INTO public.vendas (numero_contrato, unidade, cliente_nome, valor, valor_venda, data_venda, forma_pagamento, comissao_percentual_bruta, status)
  VALUES ('TESTE-B', '1', 'Teste B', 100000, round(4000/0.06, 2), '2026-01-10', 'a_vista', 4, 'ativa') RETURNING id
), pb AS (
  INSERT INTO public.venda_parcelas (venda_id, numero, tipo, valor, data_prevista, data_recebimento, status)
  SELECT b.id, 1, 'a_vista', 4000, '2026-01-10', '2026-01-20', 'recebida' FROM b RETURNING 1
)
SELECT (SELECT count(*) FROM pa) + (SELECT count(*) FROM pb) AS parcelas_criadas;

SELECT ve.numero_contrato, p.data_recebimento, round(p.vgv_quitado, 2) AS vgv_quitado_parcela
FROM public.vw_vgv_parcelas p JOIN public.vendas ve ON ve.id = p.venda_id
WHERE ve.numero_contrato LIKE 'TESTE-%' ORDER BY 1;
-- Esperado: TESTE-A duas linhas de 25000.00 (2 de 4 parcelas pagas); TESTE-B uma linha de 66666.67

SELECT ve.numero_contrato, round(v.vgv_realizado,2) realizado, round(v.vgv_quitado,2) quitado, round(v.vgv_a_receber,2) a_receber
FROM public.vw_vgv_vendas v JOIN public.vendas ve ON ve.id = v.venda_id
WHERE ve.numero_contrato LIKE 'TESTE-%' ORDER BY 1;
-- Esperado: A 100000 / 50000 / 50000 ; B 66666.67 / 66666.67 / 0

UPDATE public.vendas SET distrato = true WHERE numero_contrato = 'TESTE-B';
SELECT count(*) AS distrato_nas_views FROM public.vw_vgv_vendas v JOIN public.vendas ve ON ve.id=v.venda_id WHERE ve.numero_contrato='TESTE-B';
-- Esperado: 0
ROLLBACK;
