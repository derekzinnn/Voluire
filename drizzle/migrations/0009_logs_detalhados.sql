CREATE OR REPLACE FUNCTION public.log_alteracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_id text;
  v_acao text;
  v_desc text;
  v_alt jsonb;
  v_row jsonb;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_row := to_jsonb(COALESCE(NEW, OLD));

  IF TG_OP = 'DELETE' THEN
    v_acao := 'excluiu';
  ELSIF TG_OP = 'INSERT' THEN
    v_acao := 'criou';
  ELSE
    v_acao := 'editou';
    -- só os campos que realmente mudaram
    SELECT jsonb_agg(jsonb_build_object('campo', e.k, 'antes', to_jsonb(OLD) -> e.k, 'depois', e.v)
                     ORDER BY e.k)
      INTO v_alt
      FROM jsonb_each(to_jsonb(NEW)) AS e(k, v)
     WHERE e.k NOT IN ('updated_at', 'created_at')
       AND (to_jsonb(OLD) -> e.k) IS DISTINCT FROM e.v;
    IF v_alt IS NULL THEN
      RETURN NEW; -- nada mudou de fato
    END IF;
  END IF;

  v_id := v_row ->> 'id';

  v_desc := CASE TG_TABLE_NAME
    WHEN 'vendas' THEN 'Contrato ' || COALESCE(v_row ->> 'numero_contrato', '')
    WHEN 'corretores' THEN 'Corretor ' || COALESCE(v_row ->> 'nome', '')
    WHEN 'empreendimentos' THEN 'Empreendimento ' || COALESCE(v_row ->> 'nome', '')
    WHEN 'equipes' THEN 'Equipe ' || COALESCE(v_row ->> 'nome', '')
    WHEN 'venda_parcelas' THEN 'Parcela ' || COALESCE(v_row ->> 'numero', '')
    WHEN 'despesas' THEN 'Despesa ' || COALESCE(v_row ->> 'descricao', '')
    WHEN 'comissoes' THEN 'Comissão do contrato'
    WHEN 'venda_corretores' THEN 'Corretor no contrato'
    WHEN 'captacoes' THEN 'Captação'
    WHEN 'corretor_documentos' THEN 'Documentos do corretor'
    WHEN 'corretor_perfil_notas' THEN 'Notas do gestor'
    WHEN 'role_permissions' THEN 'Permissão ' || COALESCE(v_row ->> 'permission', '')
    WHEN 'user_roles' THEN 'Função ' || COALESCE(v_row ->> 'role', '')
    ELSE NULL
  END;

  INSERT INTO public.system_logs (user_id, user_email, acao, entidade, entidade_id, descricao, detalhes)
  VALUES (
    auth.uid(),
    v_email,
    v_acao,
    TG_TABLE_NAME,
    v_id,
    v_desc,
    jsonb_build_object(
      'alteracoes', v_alt,
      'antes', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'depois', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER log_comissoes AFTER INSERT OR UPDATE OR DELETE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_venda_corretores AFTER INSERT OR UPDATE OR DELETE ON public.venda_corretores
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_captacoes AFTER INSERT OR UPDATE OR DELETE ON public.captacoes
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_corretor_documentos AFTER INSERT OR UPDATE OR DELETE ON public.corretor_documentos
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_corretor_perfil_notas AFTER INSERT OR UPDATE OR DELETE ON public.corretor_perfil_notas
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_role_permissions AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_parceiros AFTER INSERT OR UPDATE OR DELETE ON public.parceiros
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
