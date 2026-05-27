CREATE TABLE public.financeiro_sync_erros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID,
  cliente_nome TEXT,
  mensagem TEXT NOT NULL,
  etapa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.financeiro_sync_erros TO authenticated;
GRANT ALL ON public.financeiro_sync_erros TO service_role;

ALTER TABLE public.financeiro_sync_erros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read financeiro erros"
  ON public.financeiro_sync_erros FOR SELECT
  TO authenticated USING (true);

CREATE INDEX idx_financeiro_sync_erros_created ON public.financeiro_sync_erros (created_at DESC);