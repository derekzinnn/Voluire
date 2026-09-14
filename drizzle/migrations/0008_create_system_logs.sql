-- Tabela de logs do sistema
CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  acao text NOT NULL,
  entidade text,
  entidade_id text,
  descricao text,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.system_logs TO authenticated;
GRANT ALL ON public.system_logs TO service_role;

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Somente diretor lê os logs
CREATE POLICY "Diretor le logs"
ON public.system_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretor'));

-- Qualquer autenticado registra o próprio evento
CREATE POLICY "Usuario registra proprio log"
ON public.system_logs FOR INSERT TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE INDEX system_logs_created_at_idx ON public.system_logs (created_at DESC);
CREATE INDEX system_logs_entidade_idx ON public.system_logs (entidade, entidade_id);

-- Registro automático de alterações nas tabelas principais
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
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_acao := 'excluiu';
    v_id := (to_jsonb(OLD) ->> 'id');
  ELSIF TG_OP = 'INSERT' THEN
    v_acao := 'criou';
    v_id := (to_jsonb(NEW) ->> 'id');
  ELSE
    v_acao := 'editou';
    v_id := (to_jsonb(NEW) ->> 'id');
  END IF;

  v_desc := CASE TG_TABLE_NAME
    WHEN 'vendas' THEN 'Contrato ' || COALESCE((to_jsonb(COALESCE(NEW, OLD)) ->> 'numero_contrato'), '')
    WHEN 'corretores' THEN 'Corretor ' || COALESCE((to_jsonb(COALESCE(NEW, OLD)) ->> 'nome'), '')
    WHEN 'empreendimentos' THEN 'Empreendimento ' || COALESCE((to_jsonb(COALESCE(NEW, OLD)) ->> 'nome'), '')
    WHEN 'equipes' THEN 'Equipe ' || COALESCE((to_jsonb(COALESCE(NEW, OLD)) ->> 'nome'), '')
    WHEN 'venda_parcelas' THEN 'Parcela ' || COALESCE((to_jsonb(COALESCE(NEW, OLD)) ->> 'numero'), '')
    WHEN 'despesas' THEN 'Despesa ' || COALESCE((to_jsonb(COALESCE(NEW, OLD)) ->> 'descricao'), '')
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
      'antes', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'depois', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.log_alteracao() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_vendas AFTER INSERT OR UPDATE OR DELETE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_venda_parcelas AFTER INSERT OR UPDATE OR DELETE ON public.venda_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_corretores AFTER INSERT OR UPDATE OR DELETE ON public.corretores
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_empreendimentos AFTER INSERT OR UPDATE OR DELETE ON public.empreendimentos
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_equipes AFTER INSERT OR UPDATE OR DELETE ON public.equipes
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_despesas AFTER INSERT OR UPDATE OR DELETE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
CREATE TRIGGER log_corretor_perfis AFTER INSERT OR UPDATE OR DELETE ON public.corretor_perfis
  FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();
