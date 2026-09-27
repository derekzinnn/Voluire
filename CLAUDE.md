# Voluire Analytics — Gestão de Pessoas

## Step 1 — Equipes e visibilidade — CONCLUÍDO
- Tabela `equipes`, coluna `corretores.equipe_id`.
- Funções security definer: `get_my_equipe_ids()`, `can_view_corretor()`, `can_manage_corretor()`.
- RLS por equipe em `corretores`, `vendas`, `comissoes`, `metas`, `captacoes` e escritas do Placar.
- Leitura do Placar (`placar_entregas`) permanece aberta a todos os autenticados.
- Metas com `corretor_id IS NULL` = metas da empresa (diretor e gerente).
- Efeito de produto: gerente vê o Dashboard com totais da própria equipe, não da empresa.

## Step 2 — Ficha do Corretor — CONCLUÍDO

### Decisões
- **Minimização de dados (LGPD):** `corretor_perfis` guarda apenas data de nascimento, telefone, e-mail pessoal, CRECI, data de admissão, foto e DISC. Sem CPF, RG, endereço ou dados bancários — nenhum consumidor na UI.
- **`observacoes` do gestor:** isolada em tabela separada `corretor_perfil_notas` em vez de coluna com restrição. Motivo: RLS no Postgres é por linha, não por coluna; separar a tabela permite que o corretor leia o próprio perfil (`can_view_corretor`) enquanto as notas exigem `can_manage_corretor` (diretor ou gerente da equipe), sem grants por coluna nem views intermediárias.
- **Storage:** bucket privado `corretor-fotos`, escopo por pasta = `corretor_id`. Leitura via `can_view_corretor`, escrita via `can_manage_corretor`. Acesso na UI por signed URL (`useFotoUrl`).
- **Desempenho:** nenhum número é persistido. A aba agrega `vendas`, `metas`, `placar_entregas` e `captacoes` em consultas por corretor (uma query por fonte, não por métrica).
- **Captações:** ainda sem CRUD (Step 6). O critério aparece como "sem dados", nunca como `0/15`.

### Tabelas criadas
`corretor_perfis`, `corretor_perfil_notas`, `onboarding_etapas` (catálogo, 8 etapas seed, editável pelo diretor), `onboarding_progresso`. Todas com RLS, GRANTs explícitos e trigger `updated_at`. Bucket `corretor-fotos` com políticas em `storage.objects`.

### Arquivos e rotas
- Rota `/corretores/:id` (`src/App.tsx`).
- `src/pages/CorretorDetalhe.tsx` — shell com abas Perfil, Onboarding, PDI, Feedbacks, Avaliações, Desempenho. PDI/Feedbacks/Avaliações renderizam `ModuloEmBreve` (sem dados falsos).
- `src/components/corretor/`: `PerfilTab.tsx`, `OnboardingTab.tsx`, `DesempenhoTab.tsx`, `ModuloEmBreve.tsx`, `useFotoUrl.tsx`.
- `src/components/OnboardingEtapasManager.tsx` — CRUD do catálogo, montado em `GestaoUsuarios.tsx`.
- Links de acesso: ícone de ficha em `Corretores.tsx`, card clicável em `MinhaEquipe.tsx`.
- `useUserRole.canAccessPage` libera `/corretores/:id` para corretor (acesso real governado por `can_view_corretor`).

### Validação executada (via REST, com login real de cada papel)
1. Gestora A lendo corretor/perfil da Equipe B → `[]` (zero linhas), estado "sem acesso" na página.
2. Corretor lê o próprio perfil e onboarding; `corretor_perfil_notas` retorna `[]`; outro corretor retorna `[]`.
3. Corretor escrevendo `corretor_perfis` / `corretor_perfil_notas` / `onboarding_progresso` → 42501.
4. Upload cross-team no bucket → 403 AccessDenied; upload na própria equipe → 200.
5. VGV da aba Desempenho usa o mesmo predicado da tela de Vendas (`status <> 'distrato'`, ano corrente) — valores batem.
6. Distratos excluídos na origem da query.

### Estado das contas de teste
- `gestora.a.teste@voluire.test` e `gestora.b.teste@voluire.test` mantidas; senha redefinida para `Teste!Rls2026` durante a validação.
- Criada `corretor.teste@voluire.test` (mesma senha), papel `corretor`, sem vínculo com corretor real.
- Atribuições de equipe usadas no teste foram revertidas; `corretores.equipe_id` está NULL para todos.

## Próximo passo — Step 3: PDI

### Bloqueios operacionais em aberto
- Atribuir equipe aos 16 corretores.
- Criar contas reais de gerentes (e aposentar as contas `@voluire.test`).
- Vincular login aos 15 corretores ainda sem `user_id`.

## Step 2 (revisado) — Cadastro unificado, ficha reorganizada e dashboard por papel — CONCLUÍDO

### Cadastro unificado
- `supabase/functions/invite-corretor/index.ts` agora cria, numa única chamada: usuário Auth, ficha de corretor (nova ou vinculada a corretor existente sem login), perfil, CPF, equipe e função. Gerente + equipe selecionada vira gestor da equipe.
- Rollback explícito: usuário Auth e corretor criados são apagados se qualquer etapa posterior falhar. A mensagem de erro informa que nada parcial foi mantido.
- UI: `src/components/CadastroUnificadoDialog.tsx`, usado em `GestaoUsuarios.tsx` e `Corretores.tsx` (os dois formulários antigos de convite foram removidos).

### CPF (LGPD)
- CPF fica em `corretor_documentos` (tabela separada), não em `corretor_perfis`. Motivo: RLS é por linha; separar permite política de SELECT restrita a diretor enquanto gerentes ainda podem gravar.
- Leitura na UI só por `get_corretor_cpf(uuid)`: completo para diretor, `***.***.NNN-**` para gerente da equipe, NULL para os demais. Mascaramento é feito no banco, não no frontend.

### Ficha do corretor
- Abas reagrupadas: **Ficha** (dados + DISC + CPF + notas do gestor), **Equipe** (equipe, gestor, colegas, split vigente e histórico de splits aplicados), **Desenvolvimento** (Onboarding / PDI / Feedbacks / Avaliações), **Desempenho**.
- Cabeçalho com identidade do corretor é `sticky`, permanece visível ao trocar de aba.
- Histórico de split é derivado de `comissoes` (valor_corretor / valor_total) — o split é congelado no INSERT pela trigger `create_comissao_on_venda`, então não há tabela de histórico.

### Dashboard por papel
- Abas: Visão Geral, Vendas, Trimestres, Ranking.
- Números vêm de funções agregadas no banco, já com escopo por equipe: `dashboard_mensal(ano)` (1 consulta cobre 6 cartões + gráfico + tabela mensal) e `ranking_periodo(ano, meses[])`.
- `totais_empresa(ano)` devolve apenas agregados (VGV, VGV quitado, qtd) para diretor e gerente — usado no comparativo "Minha equipe x Empresa". Nunca expõe outras equipes em detalhe.
- Badge de escopo no topo: Empresa / Minha equipe / Meus números.

### Validação executada
- Conciliação de VGV: 45 vendas ativas e R$ 11.720.846,61 em 2026 no banco; o cartão "VGV 2026" do dashboard exibe exatamente esse valor (verificado no navegador com sessão real de diretor).
- Abas da ficha renderizadas no navegador; histórico mostra splits distintos (45% e 51%) na mesma corretora, confirmando o congelamento por venda.
- Mascaramento de CPF para gerente é garantido no banco (política de SELECT + função), mas ainda NÃO foi validado em runtime com login de gerente.

## Fase 1 — Base de dados de vendas — CONCLUÍDA

### Como estava
- `vendas.valor` era o único valor (preço do imóvel) e alimentava tudo. Comissão = `valor × comissao_percentual_bruta` (trigger `recalc_comissao_venda` → `comissoes`).
- Venda com 2 corretores: uma linha por corretor em `venda_corretores` (`participacao_percentual` = % da comissão de cada um).
- `venda_parcelas` somam o valor do contrato (não a comissão). Distrato era só `status = 'distrato'`.

### Decisões
- `vendas.valor` = **Valor do Contrato** (registro + base da comissão, fora dos relatórios). Nova coluna `vendas.valor_venda` = **Valor de Venda / VGV**, único valor dos relatórios. Backfill = `valor` (6 vendas, nenhuma pendente).
- Sugestão no formulário: `valor_venda = comissão cobrada ÷ taxa padrão`, editável. Taxa padrão em `configuracoes.taxa_comissao_padrao` (6), só diretor altera.
- VGV quitado por parcela = `valor_venda × valor_parcela ÷ soma das parcelas`, na data do pagamento. Equivale à fórmula "parcela ÷ comissão total" porque as parcelas aqui representam o contrato inteiro.
- Fonte única: views `vw_vgv_vendas`, `vw_vgv_parcelas`, `vw_vgv_corretor` (security_invoker → respeitam RLS). Todas excluem distrato.
- Fatia do corretor no VGV = participação ÷ soma das participações da venda (1 corretor = 100%; 25% + 22,5% = 52,6% / 47,4%).
- Distrato: `vendas.distrato`, `distrato_em`, `distrato_por`. Trigger `trg_vendas_fase1` sincroniza `status` (marca → 'distrato'; desmarca → 'ativa' ou 'quitada'), assim telas antigas que filtram `status <> 'distrato'` continuam corretas.
- Exclusão de venda: hard delete; parcelas, comissões e corretores caem juntos por `ON DELETE CASCADE`.
- Datas retroativas liberadas; "Receber" pede a data do pagamento (sem padrão de hoje). Parcelas podem ser salvas já pagas com data informada; venda "Quitada" exige datas de pagamento.

### Arquivos
- Migração `drizzle/migrations/0010_fase1_valor_venda_distrato_vgv.sql`.
- Teste `supabase/tests/vgv_quitado_exemplos.sql` (Exemplos A e B, com ROLLBACK). Resultado: A = 25.000 por parcela paga; B = 66.666,67.
- `src/pages/Vendas.tsx`, `src/lib/vendas.ts`, `src/components/ParcelasVencidasDialog.tsx`.
- Funções reescritas sobre as views: `resumo_dashboard_anual`, `ranking_periodo`, `totais_empresa`.

## (Antigo) Próximo passo — Fase 2: Dashboard → agora Fase 3
- Ajustar layout do Dashboard ao VGV quitado por data de pagamento (hoje "a receber" mensal pode ficar negativo num mês em que se recebe venda de mês anterior).
- `dashboard_mensal` e `ranking_corretores` não são usadas pela interface; migrar para as views ou remover.

## Fase 2 — Financeiro e Parcelas em atraso — CONCLUÍDA
- Financeiro: recebimentos pelo `data_recebimento` (data real do pagamento), competência por `data_venda`; distrato excluído (`vendas.distrato`). Nunca `created_at`.
- Regra única de atraso: view `vw_parcelas_em_atraso` (security_invoker) — sem pagamento, `data_prevista` < hoje (America/Sao_Paulo), venda não distrato e não quitada. Usada pelo pop-up e pelo sino (`ParcelasVencidasDialog.tsx`).
- Correção de dados: parcelas de vendas quitadas (2026/03, 2026/04) marcadas como recebidas com data de pagamento em branco — a preencher manualmente.
- Datas suspeitas (pagamento = data de cadastro 22/09/2026): contratos 2016/02 e 2026/01 — conferir manualmente.
- Antes/depois: 4 → 2 parcelas em atraso.
- Arquivos: `drizzle/migrations/0011_fase2_vw_parcelas_em_atraso.sql`, `src/components/ParcelasVencidasDialog.tsx`, `src/pages/Financeiro.tsx`.

## Próximo passo — Fase 3: Dashboard
- Ajustar layout ao VGV quitado por data de pagamento; remover/migrar `dashboard_mensal` e `ranking_corretores`.
