ALTER TABLE public.cliente_nps
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS respostas jsonb NOT NULL DEFAULT '{}'::jsonb;