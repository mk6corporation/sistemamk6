CREATE OR REPLACE FUNCTION public.sync_cliente_contrato_datas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente uuid;
  v_inicio date;
  v_fim date;
BEGIN
  v_cliente := COALESCE(NEW.cliente_id, OLD.cliente_id);
  IF v_cliente IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Pega o contrato "principal": o de maior fim_contrato (em empate, o mais recente criado).
  -- Assim, quando uma renovação é cadastrada, suas datas viram as do cliente.
  SELECT inicio_contrato, fim_contrato
    INTO v_inicio, v_fim
  FROM public.contratos
  WHERE cliente_id = v_cliente
    AND fim_contrato IS NOT NULL
  ORDER BY fim_contrato DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- Se nenhum contrato tem fim, cai no mais recente por created_at
  IF v_inicio IS NULL AND v_fim IS NULL THEN
    SELECT inicio_contrato, fim_contrato
      INTO v_inicio, v_fim
    FROM public.contratos
    WHERE cliente_id = v_cliente
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  UPDATE public.clientes
     SET inicio_contrato = v_inicio,
         fim_contrato = v_fim
   WHERE id = v_cliente;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Garante o trigger ativo
DROP TRIGGER IF EXISTS trg_sync_cliente_contrato_datas ON public.contratos;
CREATE TRIGGER trg_sync_cliente_contrato_datas
AFTER INSERT OR UPDATE OR DELETE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_contrato_datas();

-- Resincroniza todos os clientes existentes com a nova regra
UPDATE public.clientes c
SET inicio_contrato = sub.inicio_contrato,
    fim_contrato = sub.fim_contrato
FROM (
  SELECT DISTINCT ON (cliente_id)
    cliente_id, inicio_contrato, fim_contrato
  FROM public.contratos
  ORDER BY cliente_id, fim_contrato DESC NULLS LAST, created_at DESC
) sub
WHERE c.id = sub.cliente_id;