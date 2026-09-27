-- Permissões padrão (fonte única: role_permissions; ajustáveis na tela Cargos e permissões)
INSERT INTO public.role_permissions (role, permission, allowed)
SELECT r::public.app_role, p, false
FROM unnest(ARRAY['gerente','financeiro','administrativo','corretor']) r,
     unnest(ARRAY['dashboard.ver','vendas.ver_todas','vendas.gerenciar','financeiro.ver','financeiro.gerenciar','corretores.ver_todos','corretores.gerenciar','empreendimentos.gerenciar','usuarios.gerenciar','parceiros.gerenciar','fechamento.ver_todos','rankings.ver']) p
ON CONFLICT DO NOTHING;

UPDATE public.role_permissions SET allowed = true WHERE role = 'gerente';
UPDATE public.role_permissions SET allowed = (permission IN ('dashboard.ver','vendas.ver_todas','vendas.gerenciar','financeiro.ver','financeiro.gerenciar','corretores.ver_todos','fechamento.ver_todos')) WHERE role = 'financeiro';
UPDATE public.role_permissions SET allowed = (permission IN ('dashboard.ver','vendas.ver_todas','vendas.gerenciar','corretores.ver_todos','corretores.gerenciar','empreendimentos.gerenciar','parceiros.gerenciar')) WHERE role = 'administrativo';
UPDATE public.role_permissions SET allowed = (permission IN ('dashboard.ver')) WHERE role = 'corretor';

CREATE OR REPLACE FUNCTION public.fechamento_is_gestao()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission('fechamento.ver_todos')
$$;

-- Status de acesso dos usuários (convite pendente / ativo / desativado)
CREATE OR REPLACE FUNCTION public.list_users_status()
RETURNS TABLE(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at, u.banned_until
  FROM auth.users u
  WHERE public.has_permission('usuarios.gerenciar') OR public.has_permission('corretores.gerenciar')
  ORDER BY u.created_at
$$;

-- VGV de toda a carreira do corretor, por ano
CREATE OR REPLACE FUNCTION public.corretor_vgv_historico(p_corretor_id uuid)
RETURNS TABLE(ano integer, realizado numeric, quitado numeric, qtd_vendas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    SELECT EXTRACT(year FROM data_venda)::int AS ano, sum(vgv_realizado) AS v, count(*) AS n
    FROM public.vw_vgv_corretor WHERE corretor_id = p_corretor_id GROUP BY 1
  ), q AS (
    SELECT EXTRACT(year FROM p.data_recebimento)::int AS ano, sum(p.vgv_quitado * f.fatia) AS v
    FROM public.vw_vgv_parcelas p JOIN public.vw_vgv_corretor f ON f.venda_id = p.venda_id
    WHERE f.corretor_id = p_corretor_id GROUP BY 1
  )
  SELECT COALESCE(r.ano, q.ano), round(COALESCE(r.v,0),2), round(COALESCE(q.v,0),2), COALESCE(r.n,0)
  FROM r FULL JOIN q ON q.ano = r.ano
  WHERE public.can_view_corretor(p_corretor_id)
  ORDER BY 1 DESC
$$;

REVOKE ALL ON FUNCTION public.list_users_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.corretor_vgv_historico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_users_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.corretor_vgv_historico(uuid) TO authenticated;