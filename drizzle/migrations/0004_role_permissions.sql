CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "role_permissions_write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_permission(_permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'diretor'
        OR ur.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.role_permissions rp
          WHERE rp.role = ur.role
            AND rp.permission = _permission
            AND rp.allowed
        )
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_view_venda(p_venda_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'diretor') THEN true
    WHEN public.has_permission('vendas.ver_todas') THEN true
    WHEN p_venda_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.venda_corretores vc
      WHERE vc.venda_id = p_venda_id AND public.can_view_corretor(vc.corretor_id)
    ) OR EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.id = p_venda_id AND public.can_view_corretor(v.captador_corretor_id)
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_venda(p_venda_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'diretor') THEN true
    WHEN public.has_permission('vendas.gerenciar') THEN true
    WHEN p_venda_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.venda_corretores vc
      WHERE vc.venda_id = p_venda_id AND public.can_manage_corretor(vc.corretor_id)
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.can_view_corretor(p_corretor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN public.has_role(auth.uid(), 'diretor') THEN true
      WHEN public.has_permission('corretores.ver_todos') THEN true
      WHEN p_corretor_id IS NULL THEN false
      WHEN p_corretor_id = public.get_my_corretor_id() THEN true
      WHEN public.has_role(auth.uid(), 'gerente') THEN EXISTS (
        SELECT 1 FROM public.corretores c
        WHERE c.id = p_corretor_id
          AND c.equipe_id IS NOT NULL
          AND c.equipe_id IN (SELECT public.get_my_equipe_ids())
      )
      ELSE false
    END
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_corretor(p_corretor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN public.has_role(auth.uid(), 'diretor') THEN true
      WHEN public.has_permission('corretores.gerenciar') THEN true
      WHEN p_corretor_id IS NULL THEN false
      WHEN public.has_role(auth.uid(), 'gerente') THEN EXISTS (
        SELECT 1 FROM public.corretores c
        WHERE c.id = p_corretor_id
          AND c.equipe_id IS NOT NULL
          AND c.equipe_id IN (SELECT public.get_my_equipe_ids())
      )
      ELSE false
    END
$function$;

-- vendas: permitir insert por cargos com permissão
DROP POLICY IF EXISTS "vendas_insert" ON public.vendas;
CREATE POLICY "vendas_insert" ON public.vendas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_diretor_or_gerente() OR public.has_permission('vendas.gerenciar') OR public.get_my_corretor_id() IS NOT NULL);

DROP POLICY IF EXISTS "venda_corretores_insert" ON public.venda_corretores;
CREATE POLICY "venda_corretores_insert" ON public.venda_corretores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_diretor_or_gerente() OR public.has_permission('vendas.gerenciar') OR corretor_id = public.get_my_corretor_id());

-- comissoes / despesas / parceiros / empreendimentos por permissão
DROP POLICY IF EXISTS "comissoes_write" ON public.comissoes;
CREATE POLICY "comissoes_write" ON public.comissoes
  FOR ALL TO authenticated
  USING (public.is_diretor_or_gerente() OR public.has_permission('financeiro.gerenciar'))
  WITH CHECK (public.is_diretor_or_gerente() OR public.has_permission('financeiro.gerenciar'));

DROP POLICY IF EXISTS "Diretores/Gerentes full access despesas" ON public.despesas;
CREATE POLICY "despesas_write" ON public.despesas
  FOR ALL TO authenticated
  USING (public.is_diretor_or_gerente() OR public.has_permission('financeiro.gerenciar'))
  WITH CHECK (public.is_diretor_or_gerente() OR public.has_permission('financeiro.gerenciar'));

DROP POLICY IF EXISTS "parceiros_write" ON public.parceiros;
CREATE POLICY "parceiros_write" ON public.parceiros
  FOR ALL TO authenticated
  USING (public.is_diretor_or_gerente() OR public.has_permission('parceiros.gerenciar'))
  WITH CHECK (public.is_diretor_or_gerente() OR public.has_permission('parceiros.gerenciar'));

DROP POLICY IF EXISTS "Diretores/Gerentes manage empreendimentos" ON public.empreendimentos;
CREATE POLICY "empreendimentos_write" ON public.empreendimentos
  FOR ALL TO authenticated
  USING (public.is_diretor_or_gerente() OR public.has_permission('empreendimentos.gerenciar'))
  WITH CHECK (public.is_diretor_or_gerente() OR public.has_permission('empreendimentos.gerenciar'));