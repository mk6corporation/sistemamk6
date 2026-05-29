ALTER TABLE public.equipe_comercial_cliente
  ADD COLUMN IF NOT EXISTS gestor_nome text,
  ADD COLUMN IF NOT EXISTS cs_nome text;