ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS tem_parceria boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS parceria_nome text;