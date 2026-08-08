# Project Memory

## Core
Voluire CRM - imobiliária. Primary #3B82F6 (blue). Portuguese-BR UI.
Supabase backend, single-tenant. RBAC: diretor (acesso total), gerente (acesso total, futuro: equipe), corretor (só próprios dados).
Tables: empreendimentos, corretores, vendas, comissoes, despesas, metas, trafego_pago, placar_entregas, placar_tarefas, user_roles.
Comissão padrão: 6% do valor da venda, split empresa/corretor configurável.
Novos usuários recebem role 'corretor' automaticamente.

## Memories
- [System overview](mem://features/overview) — CRM modules: vendas, comissões, corretores, financeiro, metas, marketing
- [Gerente comissão](mem://features/gerente-comissao) — 2% da comissão total vai para gerente geral
- [Placar Voluire](mem://features/placar-voluire) — Regras do placar semanal e upload de planilhas
- [RBAC roles](mem://features/rbac) — Permissões por role: diretor, gerente, corretor
