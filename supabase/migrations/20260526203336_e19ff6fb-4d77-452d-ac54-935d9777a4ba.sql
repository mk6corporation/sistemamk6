
-- ============ TIMELINE STEPS ============
CREATE TABLE public.cliente_timeline_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  codigo TEXT NOT NULL,
  fase TEXT NOT NULL,
  semana INTEGER,
  dia_inicio INTEGER,
  dia_fim INTEGER,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'call',
  responsavel TEXT,
  mk6_responsabilidade TEXT,
  mk6_entregue BOOLEAN NOT NULL DEFAULT false,
  mk6_entregue_em TIMESTAMP WITH TIME ZONE,
  cliente_responsabilidade TEXT,
  cliente_entregue BOOLEAN NOT NULL DEFAULT false,
  cliente_entregue_em TIMESTAMP WITH TIME ZONE,
  tem_trava BOOLEAN NOT NULL DEFAULT false,
  trava_descricao TEXT,
  data_prevista DATE,
  data_concluida TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ordem)
);

CREATE INDEX idx_timeline_cliente ON public.cliente_timeline_steps(cliente_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_timeline_steps TO authenticated;
GRANT ALL ON public.cliente_timeline_steps TO service_role;

ALTER TABLE public.cliente_timeline_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read timeline" ON public.cliente_timeline_steps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert timeline" ON public.cliente_timeline_steps
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update timeline" ON public.cliente_timeline_steps
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete timeline" ON public.cliente_timeline_steps
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_timeline_updated_at
BEFORE UPDATE ON public.cliente_timeline_steps
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CHECK-INS DIÁRIOS ============
CREATE TABLE public.cliente_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'checkin_whatsapp', -- checkin_whatsapp | relatorio_semanal
  resposta_cliente TEXT,
  observacoes TEXT,
  registrado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkins_cliente_data ON public.cliente_checkins(cliente_id, data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_checkins TO authenticated;
GRANT ALL ON public.cliente_checkins TO service_role;

ALTER TABLE public.cliente_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read checkins" ON public.cliente_checkins
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert checkins" ON public.cliente_checkins
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update checkins" ON public.cliente_checkins
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete checkins" ON public.cliente_checkins
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_checkins_updated_at
BEFORE UPDATE ON public.cliente_checkins
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
