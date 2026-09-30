# Correções da revisão de código (5 itens, na ordem pedida)

Cada item termina com uma prova concreta: uma consulta ou um antes/depois. Termos técnicos vêm primeiro explicados com uma analogia simples.

## Correção 1 — O banco pode ser reconstruído a partir do projeto
Um primeiro achado: a revisão diz que faltam arquivos, mas o projeto já tem arquivos que criam `valor_venda`, `distrato`, as views `vw_vgv_*`, `metas_vgv`, `has_permission` e `fechamento_*` (etapas 0004 e 0010 a 0014). O que ainda falta confirmar é a base antiga: tabelas e funções criadas antes dessas etapas, que talvez só existam no banco ao vivo.
- Comparar tudo o que existe no banco ao vivo (tabelas, colunas, views, funções, triggers, políticas de acesso) com o que os arquivos do projeto criam.
- Criar um único arquivo de "linha de base" com tudo o que faltar. Ele é idempotente, ou seja, pode rodar de novo sem quebrar nada no banco atual.
- Prova: uma tabela "objeto → arquivo que o cria" e o texto completo de `vw_vgv_parcelas` e `vw_vgv_vendas`.

## Correção 2 — Salvar uma venda é tudo ou nada, e parcelas pagas não se perdem
- Nova função no banco `salvar_venda(...)`, que grava venda, corretores e parcelas numa única transação.
- Na edição, as parcelas são comparadas pelo número: parcelas "recebida" mantêm a data de pagamento, a menos que você a altere de propósito. Só as parcelas que mudaram são atualizadas, e só as removidas no formulário são apagadas.
- A tela de Vendas passa a chamar essa função, e não mais várias gravações soltas.
- Prova: editar uma venda de teste com uma parcela paga e mostrar que a data de pagamento continua a mesma. Depois o teste é desfeito.

## Correção 3 — Fluxo de Caixa em escala de comissão
- Entradas = parte da Voluire na comissão (`valor_empresa`), rateada pelo peso de cada parcela recebida, na data real do pagamento. Distratos continuam fora.
- O saldo passa a ser essas entradas menos as despesas.
- Prova: os números mês a mês antes e depois, mostrando valores na casa dos milhares, não das centenas de milhares.

## Correção 4 — Datas de pagamento históricas
- Listar as vendas quitadas ou pagas com data ausente ou suspeita. Já sabemos de 2016/02, 2026/01, 2026/03 e 2026/04. Nenhuma data será inventada.
- Garantir que a edição da venda deixe preencher e alterar a data de pagamento de cada parcela já existente.

## Correção 5 — Ajustes menores
- Botão "Excluir" em Vendas visível só para o diretor.
- Uma regra única nas funções administrativas: `has_permission('usuarios.gerenciar')`, que o diretor já tem. As regras ficam documentadas no CLAUDE.md.
- `invite-corretor` deixa de devolver a senha temporária.
- Incluir `.env` no `.gitignore`.

## Final
Atualizar o CLAUDE.md: cada correção marcada como feita, as decisões tomadas, os arquivos alterados e os próximos passos.

## Detalhes técnicos
- As mudanças no banco vão pela ferramenta de migração. As mudanças de dados vão só pela ferramenta de SQL, e os dados de teste são sempre desfeitos no final.
- `salvar_venda` é SECURITY INVOKER, então as políticas de acesso (RLS) atuais continuam valendo. A execução é liberada só para `authenticated`.
- Os triggers de comissão e de registro de alterações continuam funcionando como hoje.
- Nenhuma política de acesso será afrouxada.
