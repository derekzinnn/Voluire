ALTER TABLE public.empreendimentos
  ADD COLUMN IF NOT EXISTS rua text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS condominio text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text;
COMMENT ON COLUMN public.empreendimentos.rua IS 'Imóvel pronto (tipo=pronto): endereço. nome = "Rua, Número – Complemento (Condomínio)".';