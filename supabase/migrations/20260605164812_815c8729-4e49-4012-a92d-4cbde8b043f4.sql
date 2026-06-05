
-- Tornar notion_page_id opcional (clientes manuais não têm)
ALTER TABLE public.clientes ALTER COLUMN notion_page_id DROP NOT NULL;

-- Coluna de origem
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'notion'
    CHECK (origem IN ('notion','manual'));

-- Marcar manualmente registros sem notion_page_id como manuais (defensivo)
UPDATE public.clientes SET origem = 'manual' WHERE notion_page_id IS NULL AND origem = 'notion';

-- Auditoria simples
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Trigger updated_at (reutiliza função existente touch_updated_at)
DROP TRIGGER IF EXISTS clientes_touch_updated_at ON public.clientes;
CREATE TRIGGER clientes_touch_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
