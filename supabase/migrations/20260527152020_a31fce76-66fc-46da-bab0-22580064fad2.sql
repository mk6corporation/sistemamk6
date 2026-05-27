ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS financeiro_form_database_id text,
  ADD COLUMN IF NOT EXISTS financeiro_form_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS dados_corporativos_cliente_id_key
  ON public.dados_corporativos(cliente_id);

CREATE UNIQUE INDEX IF NOT EXISTS contratos_cliente_id_tipo_key
  ON public.contratos(cliente_id, tipo);

CREATE UNIQUE INDEX IF NOT EXISTS equipe_comercial_cliente_cliente_id_key
  ON public.equipe_comercial_cliente(cliente_id);