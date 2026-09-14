-- 1) user_roles: apenas o próprio usuário ou diretor
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
CREATE POLICY "Users view own roles or diretor views all"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'diretor'));

-- 2) role_permissions: apenas permissões dos próprios cargos ou diretor
DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select_own_roles"
ON public.role_permissions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor')
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = role_permissions.role
  )
);

-- 3) parceiros: somente gestão/financeiro
DROP POLICY IF EXISTS "parceiros_select" ON public.parceiros;
CREATE POLICY "parceiros_select_gestao"
ON public.parceiros FOR SELECT TO authenticated
USING (public.is_diretor_or_gerente() OR public.has_permission('parceiros.gerenciar'));

-- 4) gestor_faixas: somente diretor/gerente
DROP POLICY IF EXISTS "gestor_faixas_select" ON public.gestor_faixas;
CREATE POLICY "gestor_faixas_select_gestao"
ON public.gestor_faixas FOR SELECT TO authenticated
USING (public.is_diretor_or_gerente());

-- 5) empreendimentos: apenas usuários com cargo atribuído
DROP POLICY IF EXISTS "All authenticated view empreendimentos" ON public.empreendimentos;
CREATE POLICY "Users with a role view empreendimentos"
ON public.empreendimentos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- 6) Helpers de RLS: mantêm EXECUTE para authenticated, sem acesso anônimo
REVOKE EXECUTE ON FUNCTION public.can_manage_corretor(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_venda(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_corretor(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_venda(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_corretor_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_equipe_ids() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_diretor_or_gerente() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_corretor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_venda(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_corretor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_venda(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_corretor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_equipe_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_diretor_or_gerente() TO authenticated;

-- 7) Funções internas/não usadas pelo cliente: sem EXECUTE para anon nem authenticated
REVOKE EXECUTE ON FUNCTION public.recalc_comissao_venda(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.comissao_gestor_mensal(integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dashboard_mensal(integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ranking_corretores(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ranking_periodo(integer, integer[]) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.totais_empresa(integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_comissao() FROM anon, authenticated, PUBLIC;

-- 8) Funções chamadas pelo app: apenas autenticados
REVOKE EXECUTE ON FUNCTION public.list_users() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_corretor_cpf(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resumo_dashboard_anual(integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_corretor_cpf(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumo_dashboard_anual(integer) TO authenticated;