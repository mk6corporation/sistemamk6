
ALTER TABLE public.contratos_assinaturas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente','admin'));

ALTER TABLE public.contratos_documentos
  ADD COLUMN IF NOT EXISTS assinado_admin_em timestamptz;

-- Public read (anon) via token — needed for /contrato/ver/:token and existing /contrato/assinar/:token
DROP POLICY IF EXISTS "public_read_by_token_doc" ON public.contratos_documentos;
CREATE POLICY "public_read_by_token_doc" ON public.contratos_documentos
  FOR SELECT TO anon, authenticated
  USING (token_publico IS NOT NULL);

DROP POLICY IF EXISTS "public_read_signatures_by_contract" ON public.contratos_assinaturas;
CREATE POLICY "public_read_signatures_by_contract" ON public.contratos_assinaturas
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.contratos_documentos d WHERE d.id = contrato_id AND d.token_publico IS NOT NULL));

GRANT SELECT ON public.contratos_documentos TO anon;
GRANT SELECT ON public.contratos_assinaturas TO anon;
