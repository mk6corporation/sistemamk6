
-- 1. Novos campos em cliente_timeline_steps
ALTER TABLE public.cliente_timeline_steps
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS acao_mk6_itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pronto_para_avancar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS atrasado boolean NOT NULL DEFAULT false;

-- 2. Novos campos em clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS step_atual_ordem integer,
  ADD COLUMN IF NOT EXISTS resultado_renovacao text;

-- 3. Nova tabela rotina_recorrente
CREATE TABLE IF NOT EXISTS public.rotina_recorrente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_user_id uuid NOT NULL,
  tipo text NOT NULL,
  data date NOT NULL,
  cliente_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_user_id, tipo, data, cliente_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotina_recorrente TO authenticated;
GRANT ALL ON public.rotina_recorrente TO service_role;

ALTER TABLE public.rotina_recorrente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read rotina"
  ON public.rotina_recorrente FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insert rotina"
  ON public.rotina_recorrente FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth update rotina"
  ON public.rotina_recorrente FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth delete rotina"
  ON public.rotina_recorrente FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_rotina_updated_at
  BEFORE UPDATE ON public.rotina_recorrente
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_rotina_colaborador_data ON public.rotina_recorrente (colaborador_user_id, data);
CREATE INDEX IF NOT EXISTS idx_rotina_cliente ON public.rotina_recorrente (cliente_id);

-- 4. Índice útil pra kanban
CREATE INDEX IF NOT EXISTS idx_clientes_step_atual ON public.clientes (step_atual_ordem) WHERE removido_em IS NULL;
