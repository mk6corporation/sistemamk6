-- NPS history
CREATE TABLE public.cliente_nps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 10),
  comentario text,
  respondido_em timestamptz NOT NULL DEFAULT now(),
  source text,
  source_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cliente_nps_cliente ON public.cliente_nps(cliente_id, respondido_em DESC);
CREATE UNIQUE INDEX idx_cliente_nps_source_unique ON public.cliente_nps(source, source_id) WHERE source_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_nps TO authenticated;
GRANT ALL ON public.cliente_nps TO service_role;

ALTER TABLE public.cliente_nps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read nps" ON public.cliente_nps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert nps" ON public.cliente_nps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update nps" ON public.cliente_nps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete nps" ON public.cliente_nps FOR DELETE TO authenticated USING (true);

-- Performance funnel (one row per cliente)
CREATE TABLE public.cliente_performance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL UNIQUE,
  leads_inicial integer,
  leads_atual integer,
  faturamento_inicial numeric,
  faturamento_atual numeric,
  faturamento_meta numeric,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_performance TO authenticated;
GRANT ALL ON public.cliente_performance TO service_role;

ALTER TABLE public.cliente_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read perf" ON public.cliente_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert perf" ON public.cliente_performance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update perf" ON public.cliente_performance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete perf" ON public.cliente_performance FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_cliente_performance_updated
BEFORE UPDATE ON public.cliente_performance
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();