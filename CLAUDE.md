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

## Fase 3 — Dashboard — CONCLUÍDA
- Seletores de ano começam em 2025 (`ANO_INICIAL` em `src/lib/metas.ts`), no Dashboard, Financeiro e Metas.
- Três blocos (Mês, Trimestre, Ano), cada um com seletor próprio (padrão = período atual em America/Sao_Paulo): Meta, VGV Realizado (`vw_vgv_vendas` por `data_venda`), VGV Quitado (`vw_vgv_parcelas` por `data_recebimento`), Falta para meta + barra de progresso.
- `faltaParaMeta`/`progressoMeta` em `src/lib/metas.ts` são o único lugar da fórmula (hoje sobre Realizado; trocar para Quitado ali).
- Metas: não existiam (módulo antigo foi removido). Criada `metas_vgv` (tipo mes/trimestre/ano, ano, periodo, valor), leitura para quem tem cargo, escrita só diretor, com log. Trimestre/ano = meta específica se existir, senão soma das mensais. Editor: botão "Metas" (só diretor).
- RBAC: corretor vê só os próprios números (fatia de `vw_vgv_corretor`, quitado proporcional à fatia) e não vê metas; demais cargos seguem a RLS das views.
- Arquivos: `drizzle/migrations/0012_fase3_metas.sql`, `src/lib/metas.ts`, `src/components/dashboard/BlocosMeta.tsx`, `src/components/dashboard/MetasDialog.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Financeiro.tsx`.

## Próximo passo — Fase 4
- Cadastrar metas reais de 2025/2026; aba Fechamento; remover `dashboard_mensal` e `ranking_corretores` (não usadas).

## Fase 4 — Fechamento — CONCLUÍDA
- Rota `/fechamento`, item logo abaixo de Dashboard. Abas Mensal/Trimestral/Anual + seletor de período (padrão atual, SP), filtro de corretor (visão mês/tri/ano lado a lado), tabela por corretor, CSV (`;`, BOM, vírgula decimal).
- Funções SECURITY DEFINER (só authenticated): `fechamento_corretores(ini,fim)` e `fechamento_totais(ini,fim)`, sobre `vw_vgv_*`. `fechamento_is_gestao()` = diretor, gerente, `dashboard.ver` ou `financeiro.ver`; demais recebem só a própria linha (`get_my_corretor_id`). Escopo aplicado no banco, não só na tela.
- Definições: Realizado = VGV com data da venda no período; Quitado = VGV proporcional por data de pagamento no período (fatia do corretor); A receber = saldo no fim do período (realizado até o fim − quitado até o fim), nunca negativo.
- Totais gerais = mesmas somas do Dashboard (views). Rankings (Realizado/Quitado, mês e ano) só para gestão; empates dividem a posição (1, 1, 3).
- Checagem 2026: Realizado 1.186.004,30 e Quitado 402.990,00 iguais no Dashboard e na soma por corretor; 0 vendas sem corretor.
- Arquivos: `drizzle/migrations/0013_fase4_fechamento.sql`, `src/pages/Fechamento.tsx`, `src/App.tsx`, `src/components/AppLayout.tsx`, `src/hooks/useUserRole.tsx`.

## Próximo passo — Fase 5
- Cadastrar metas reais; preencher datas de pagamento pendentes (2026/03, 2026/04) e conferir 2016/02 e 2026/01; remover `dashboard_mensal` e `ranking_corretores`.

## Fase 5 — Corretores e Gestão de Usuários — CONCLUÍDA
- Cargos: "Gestão" = enum `gerente` (só o rótulo mudou), Financeiro, Administrativo, Corretor, Diretor/admin (tudo).
- Permissões padrão ficam só em `role_permissions` (ajustáveis na aba Cargos e permissões). Novas chaves: `fechamento.ver_todos`, `rankings.ver`.
  - Gestão: tudo. Financeiro: dashboard, vendas (ver/editar), financeiro, parcelas em atraso, fechamento de todos, sem usuários/rankings. Administrativo: vendas, imóveis, corretores (cadastrar/editar), sem financeiro/rankings/fechamento. Corretor: só o próprio.
- Menu/rotas (`canAccessPage`) usam só permissões — removidos atalhos por cargo `gerente`. RLS já usa `has_permission`; `fechamento_is_gestao()` = `fechamento.ver_todos`. Sino/parcelas em atraso = `financeiro.ver`.
- Convite: `invite-corretor` (permite `usuarios.gerenciar`) cria o login, vincula à ficha e envia o e-mail para o usuário criar a senha. Status em Corretores: Não convidado / Convite pendente (nunca entrou) / Ativo / Desativado, com reenviar convite. Fonte: `list_users_status()`.
- Desativar sem apagar: função `admin-set-user-active` (bloqueia o login, marca a ficha como inativa, registra log); reativação pelo mesmo botão.
- Editar corretor: `NovoCorretorDialog` com prop `corretor` (mesmo formulário, pré-preenchido).
- VGV de carreira: `corretor_vgv_historico(uuid)` (views `vw_vgv_*`, respeita `can_view_corretor`) → `src/components/corretor/VgvHistorico.tsx` na aba Desempenho.
- Arquivos: `drizzle/migrations/0014_fase5_permissoes_usuarios.sql`, `supabase/functions/admin-set-user-active`, `supabase/functions/invite-corretor`, `src/hooks/useUserRole.tsx`, `src/pages/Corretores.tsx`, `src/pages/GestaoUsuarios.tsx`, `src/pages/Fechamento.tsx`, `src/pages/CorretorDetalhe.tsx`, `src/components/NovoCorretorDialog.tsx`, `src/components/VincularUsuarioDialog.tsx`, `src/components/ParcelasVencidasDialog.tsx`, `src/components/AppLayout.tsx`.
- Teste por cargo: validado por leitura das regras; teste em runtime com login de cada cargo ainda pendente (não há contas de Financeiro/Administrativo/Gestão).

## Próximo passo — Fase 6
- Criar uma conta de cada cargo e validar em runtime; cadastrar metas; completar datas de pagamento pendentes; remover `dashboard_mensal` e `ranking_corretores`.

## Fase 6 — Imóveis — CONCLUÍDA
- "Empreendimentos" virou "Imóveis": menu, título e rota `/imoveis`; `/empreendimentos` redireciona para `/imoveis`. A permissão `empreendimentos.gerenciar` foi mantida (rótulo "Gerenciar imóveis").
- Imóvel pronto = linha em `empreendimentos` com `tipo = 'pronto'` (mesma tabela, então aparece no seletor da venda e cai na regra de agenciador que já existia). Colunas novas, opcionais: `rua`, `numero`, `complemento`, `condominio`, `bairro`, `cidade`. Rua e número são obrigatórios no formulário.
- `nome` do imóvel pronto é gravado como "Rua, Número – Complemento (Condomínio)" (`nomeImovelPronto` em `src/lib/vendas.ts`), por isso a lista de vendas e o seletor não precisaram mudar.
- Lista única com selo (Empreendimento / Imóvel Pronto) e filtro. Os empreendimentos e vendas existentes não foram alterados (só colunas novas adicionadas).
- Arquivos: `drizzle/migrations/0015_fase6_imoveis_prontos.sql`, `src/pages/Imoveis.tsx` (substitui `Empreendimentos.tsx`), `src/lib/vendas.ts`, `src/App.tsx`, `src/components/AppLayout.tsx`, `src/hooks/useUserRole.tsx`, `src/pages/Vendas.tsx`.

## Próximo passo (pós-fases)
- Criar uma conta de cada cargo e validar o acesso em runtime; cadastrar metas; completar as datas de pagamento pendentes (2026/03, 2026/04; conferir 2016/02 e 2026/01); remover `dashboard_mensal` e `ranking_corretores`; publicar.
