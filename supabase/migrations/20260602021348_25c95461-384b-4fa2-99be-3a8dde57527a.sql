CREATE TABLE public.projecoes_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  investimento numeric NOT NULL DEFAULT 0,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  realizado jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projecoes_cliente TO authenticated;
GRANT ALL ON public.projecoes_cliente TO service_role;

ALTER TABLE public.projecoes_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read projecoes" ON public.projecoes_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert projecoes" ON public.projecoes_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update projecoes" ON public.projecoes_cliente FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete projecoes" ON public.projecoes_cliente FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_projecoes_cliente_cliente ON public.projecoes_cliente(cliente_id, ano DESC, mes DESC);

CREATE TRIGGER trg_projecoes_cliente_updated
  BEFORE UPDATE ON public.projecoes_cliente
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();