# Módulo de Gestão de Pessoas

Entrega em 6 etapas, na ordem de dependência. A etapa 1 é a fundação: sem equipes e sem logins vinculados, nada do resto funciona de verdade.

## Situação atual confirmada

- 16 corretores cadastrados, apenas 1 com login vinculado (Andressa Pedroso, diretor). Os outros 15 não têm acesso.
- Só existem 2 usuários com função definida (1 diretor, 1 corretor).
- `captacoes` já existe com as colunas: empreendimento, corretor, data, endereço e observação — está vazia (0 registros).
- Não existe arquivo CLAUDE.md no projeto ainda; ele será criado ao final.
- As políticas de acesso hoje usam `is_diretor_or_gerente()`, ou seja, gerente enxerga tudo.

## Etapa 1 — Equipes e visibilidade (fundação)

- Nova tabela **Equipes**: nome, gestora responsável (usuário), ativa.
- Corretor passa a ter uma equipe (pode ficar sem equipe).
- Regra única de visibilidade: diretor vê tudo; gestora vê apenas corretores das equipes que ela gerencia; corretor vê apenas a si mesmo. Corretor **sem equipe** aparece só para o diretor (nunca "visível para todos").
- Essa regra é aplicada no banco, em corretores, vendas, comissões, metas e captações, e também dentro das funções internas de ranking e listagem de usuários — forçar uma URL não vaza nada.
- **Placar Voluire não é dividido por equipe.** O ranking continua legível por todos os usuários autenticados — é campanha de cultura da empresa inteira. A regra de equipe vale só para *gravar* entregas.
- **Metas da empresa** (sem corretor definido) continuam visíveis para diretor e gerente. A regra de fail-closed vale para linhas de corretor, não para linhas da empresa. Antes de aplicar a regra em cada tabela, verifico onde o corretor pode ser nulo (vendas, comissões, metas e captações todas permitem nulo hoje) e defino o comportamento linha a linha.
- Financeiro, Marketing e Despesas continuam como hoje: empresa inteira, restrito a diretor e gerente.
- Em Gestão de Usuários: criar/editar equipes e atribuir corretores a equipes pela tela (nada de nomes fixos em migração), mais o fluxo para vincular os 15 corretores sem login.

### Decisão de produto que precisa do seu aval

Hoje não existe nenhum usuário com função **gerente** — as duas gestoras ainda não têm login com esse papel. Ao aplicar a divisão por equipe, o Dashboard de uma gestora deixa de mostrar o total da empresa e passa a mostrar **o total da equipe dela** (VGV, vendas, comissões). Isso é intencional, mas muda o que elas veem hoje. Confirme antes de eu aplicar.


## Etapa 2 — Ficha do corretor

- Página `/corretores/:id` com abas: Perfil, Onboarding, PDI, Feedbacks, Avaliações, Desempenho.
- **Perfil**: dados pessoais, CRECI, data de admissão, foto, perfil comportamental DISC (Dominância, Influência, Estabilidade, Conformidade) e observações.
- **Onboarding**: catálogo de etapas + progresso por corretor (concluído, data, responsável).
- **Desempenho**: reaproveita os dados que já existem (VGV de vendas, atingimento de metas, pontos do Placar, nº de captações). Nada é duplicado.

## Etapa 3 — PDI

- Plano de desenvolvimento por período com status rascunho / ativo / concluído, e ações vinculadas (competência, descrição, prazo, status).
- Corretor sempre lê o próprio PDI ativo. Rascunho só o autor e o diretor veem.

## Etapa 4 — Feedbacks

- Registro de 1x1, elogio, alerta e desligamento, com autor, data e conteúdo.
- Marcador "visível para o corretor". O corretor só lê os próprios feedbacks marcados como visíveis — regra aplicada no banco, não na tela.

## Etapa 5 — Avaliação de desempenho

- Catálogo de critérios com pesos; avaliação por trimestre/ano com nota geral e status rascunho / finalizada; notas de 1 a 5 por critério com comentário.
- Rascunho nunca visível ao corretor; finalizada sim.
- Histórico de notas em gráfico na ficha do corretor.

## Etapa 6 — Captações

- CRUD completo sobre a tabela existente (estendida, não recriada): imóvel/endereço, proprietário, corretor, data, valor pedido, status.
- Contador trimestral de captações no Placar Voluire, fechando os três critérios da campanha: 120 pontos + R$ 900 mil de VGV + 15 captações.

## Detalhes técnicos

**Banco**

- `equipes` (nome, gestor_user_id, ativo, timestamps) + `corretores.equipe_id` nullable.
- Funções security definer novas: `get_my_equipe_ids()` e `can_view_corretor(p_corretor_id uuid)` — esta última é a autoridade única de visibilidade; fail-closed quando o corretor não tem equipe (só diretor).
- Reescrita das policies de `corretores`, `vendas`, `comissoes`, `metas` e `captacoes` para passar por `can_view_corretor`. Antes disso, auditoria de `corretor_id` nulo em cada uma: em `metas`, linha com corretor nulo é meta da empresa e libera para diretor e gerente; em `vendas`, `comissoes` e `captacoes`, linha órfã fica restrita ao diretor.
- `placar_entregas`: leitura permanece aberta a todo usuário autenticado (ranking da campanha); `can_view_corretor` entra apenas em inserção/edição/exclusão.
- `is_diretor_or_gerente()` sobrevive apenas como checagem de rota/menu e nas tabelas de empresa (financeiro, marketing, despesas).
- Auditoria e reescrita de `ranking_corretores()` e `list_users()` para aplicar o escopo de equipe internamente (funções security definer ignoram RLS por natureza — este é o ponto de maior risco). Exceção: o ranking do Placar continua completo, por ser campanha aberta.
- Nenhuma policy consulta a própria tabela que protege; sempre via função security definer (evita recursão infinita).
- Novas tabelas: `corretor_perfis`, `onboarding_etapas`, `onboarding_progresso`, `pdi_planos`, `pdi_acoes`, `feedbacks`, `avaliacao_criterios`, `avaliacoes`, `avaliacao_notas`. Todas com GRANTs explícitos, RLS habilitada e trigger de `updated_at`.

**Front-end**

- Nova seção "Gestão" na sidebar (diretor e gerente): Minha Equipe e Ficha do Corretor; rota `/corretores/:id` no App.tsx.
- `useUserRole` expõe `isDiretor` e as equipes gerenciadas; `canAccessPage` cobre as rotas novas.
- shadcn/ui e tokens semânticos existentes, sem cor nova nem hex inline; textos em português.

**Testes e validação**

- Vitest para `can_view_corretor` e para o comportamento de RLS dos feedbacks.
- Como hoje não existe nenhum usuário gerente, a validação começa criando **dois usuários gerente de teste e duas equipes** — sem isso a prova de isolamento não pode ser executada de verdade.
- Provas executadas de fato (consultas rodadas como cada papel, não raciocínio): gestora da equipe A não lê corretor, venda, comissão, meta nem captação da equipe B, inclusive via ranking e listagem de usuários; corretor não lê feedback/PDI/avaliação de outro nem os próprios não visíveis/rascunho; corretor sem equipe só aparece para diretor; meta da empresa continua visível para gerente; ranking do Placar continua completo para todos; as 47 vendas, 49 comissões e 154 entregas continuam corretas para o diretor; nenhuma recursão em policy.
- Ao final, criação do `CLAUDE.md` registrando decisões, arquivos/migrações e próximo passo.

## Ordem de entrega

Etapa 1 primeiro e sozinha (é ela que muda segurança do sistema inteiro). Depois 2 → 6. Cada etapa é uma migração + telas, validada antes de seguir.
