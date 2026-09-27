CREATE TABLE public.metas_vgv (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('mes','trimestre','ano')),
  ano integer NOT NULL CHECK (ano >= 2025),
  periodo integer NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0 CHECK (valor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, ano, periodo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_vgv TO authenticated;
GRANT ALL ON public.metas_vgv TO service_role;
ALTER TABLE public.metas_vgv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metas leitura autenticados com cargo" ON public.metas_vgv FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "metas escrita diretor" ON public.metas_vgv FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'diretor')) WITH CHECK (public.has_role(auth.uid(),'diretor'));
CREATE TRIGGER trg_metas_vgv_updated BEFORE UPDATE ON public.metas_vgv FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_metas_vgv_log AFTER INSERT OR UPDATE OR DELETE ON public.metas_vgv FOR EACH ROW EXECUTE FUNCTION public.log_alteracao();