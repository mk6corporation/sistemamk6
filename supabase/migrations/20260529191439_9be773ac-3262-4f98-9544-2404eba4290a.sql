
CREATE OR REPLACE FUNCTION public.sync_cliente_contrato_datas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente uuid;
  v_max_fim date;
  v_min_inicio date;
BEGIN
  v_cliente := COALESCE(NEW.cliente_id, OLD.cliente_id);
  IF v_cliente IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT MAX(fim_contrato), MIN(inicio_contrato)
    INTO v_max_fim, v_min_inicio
  FROM public.contratos
  WHERE cliente_id = v_cliente;

  UPDATE public.clientes
     SET fim_contrato = v_max_fim,
         inicio_contrato = v_min_inicio
   WHERE id = v_cliente;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cliente_contrato_datas ON public.contratos;
CREATE TRIGGER trg_sync_cliente_contrato_datas
AFTER INSERT OR UPDATE OR DELETE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_contrato_datas();

-- Backfill
UPDATE public.clientes c
SET fim_contrato = sub.max_fim,
    inicio_contrato = sub.min_inicio
FROM (
  SELECT cliente_id,
         MAX(fim_contrato) AS max_fim,
         MIN(inicio_contrato) AS min_inicio
  FROM public.contratos
  GROUP BY cliente_id
) sub
WHERE c.id = sub.cliente_id;
