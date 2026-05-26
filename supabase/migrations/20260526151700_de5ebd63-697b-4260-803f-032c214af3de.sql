
-- =========================================
-- TABELA: clientes (snapshot atual)
-- =========================================
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notion_page_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  estagio TEXT,
  categoria TEXT,
  plano TEXT,
  operacional JSONB DEFAULT '[]'::jsonb,
  inicio_contrato DATE,
  valor_mensal NUMERIC(12,2),
  notion_last_edited_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clientes_categoria ON public.clientes(categoria);
CREATE INDEX idx_clientes_estagio ON public.clientes(estagio);
CREATE INDEX idx_clientes_plano ON public.clientes(plano);

GRANT SELECT ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all clients"
  ON public.clientes FOR SELECT TO authenticated USING (true);

-- =========================================
-- TABELA: mudancas_estagio (histórico)
-- =========================================
CREATE TABLE public.mudancas_estagio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  notion_page_id TEXT NOT NULL,
  nome_cliente TEXT NOT NULL,
  estagio_anterior TEXT,
  estagio_novo TEXT,
  categoria_anterior TEXT,
  categoria_nova TEXT,
  tipo_mudanca TEXT NOT NULL,
  detectada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  notion_edited_at TIMESTAMPTZ
);

CREATE INDEX idx_mudancas_cliente ON public.mudancas_estagio(cliente_id);
CREATE INDEX idx_mudancas_tipo ON public.mudancas_estagio(tipo_mudanca);
CREATE INDEX idx_mudancas_detectada ON public.mudancas_estagio(detectada_em DESC);

GRANT SELECT ON public.mudancas_estagio TO authenticated;
GRANT ALL ON public.mudancas_estagio TO service_role;
ALTER TABLE public.mudancas_estagio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all stage changes"
  ON public.mudancas_estagio FOR SELECT TO authenticated USING (true);

-- =========================================
-- TABELA: sync_runs (log de sincronizações)
-- =========================================
CREATE TABLE public.sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  clientes_processados INTEGER NOT NULL DEFAULT 0,
  clientes_novos INTEGER NOT NULL DEFAULT 0,
  mudancas_detectadas INTEGER NOT NULL DEFAULT 0,
  erro TEXT
);

CREATE INDEX idx_sync_runs_iniciado ON public.sync_runs(iniciado_em DESC);

GRANT SELECT ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all sync runs"
  ON public.sync_runs FOR SELECT TO authenticated USING (true);

-- =========================================
-- Trigger: updated_at em clientes
-- =========================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clientes_touch_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
