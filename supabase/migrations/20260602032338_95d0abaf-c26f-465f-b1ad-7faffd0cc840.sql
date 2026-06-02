ALTER TABLE public.vendedor_registros_diarios
  ADD COLUMN IF NOT EXISTS contatados_2h integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contatados_apos_2h integer NOT NULL DEFAULT 0;