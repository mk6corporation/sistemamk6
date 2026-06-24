
-- 1) MODELOS
CREATE TABLE public.contrato_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  corpo text NOT NULL DEFAULT '',
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_modelos TO authenticated;
GRANT ALL ON public.contrato_modelos TO service_role;
ALTER TABLE public.contrato_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage modelos" ON public.contrato_modelos
  FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE TRIGGER trg_contrato_modelos_updated BEFORE UPDATE ON public.contrato_modelos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) DOCUMENTOS (instâncias de contratos)
CREATE TABLE public.contratos_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  modelo_id uuid REFERENCES public.contrato_modelos(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  corpo text NOT NULL DEFAULT '',
  variaveis_valores jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho', -- rascunho | enviado | assinado | cancelado
  token_publico text UNIQUE,
  enviado_em timestamptz,
  assinado_em timestamptz,
  cancelado_em timestamptz,
  signatario_nome text,
  signatario_email text,
  signatario_documento text,
  pdf_path text,
  documento_hash text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_documentos TO authenticated;
GRANT SELECT, UPDATE ON public.contratos_documentos TO anon; -- leitura/assinatura via token público
GRANT ALL ON public.contratos_documentos TO service_role;
ALTER TABLE public.contratos_documentos ENABLE ROW LEVEL SECURITY;

-- Staff faz tudo
CREATE POLICY "staff manage contratos docs" ON public.contratos_documentos
  FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- Público pode LER apenas contratos enviados (status='enviado') — uso real é via token na query
CREATE POLICY "public read enviados" ON public.contratos_documentos
  FOR SELECT TO anon USING (status = 'enviado' AND token_publico IS NOT NULL);

-- Público pode marcar como assinado (apenas em contratos enviados)
CREATE POLICY "public sign enviados" ON public.contratos_documentos
  FOR UPDATE TO anon USING (status = 'enviado') WITH CHECK (status IN ('enviado','assinado'));

CREATE INDEX idx_contratos_docs_cliente ON public.contratos_documentos(cliente_id);
CREATE INDEX idx_contratos_docs_status ON public.contratos_documentos(status);
CREATE INDEX idx_contratos_docs_token ON public.contratos_documentos(token_publico);

CREATE TRIGGER trg_contratos_docs_updated BEFORE UPDATE ON public.contratos_documentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) ASSINATURAS (evidências)
CREATE TABLE public.contratos_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_documentos(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  documento text,
  email text,
  ip text,
  user_agent text,
  assinatura_imagem text, -- dataURL base64 da assinatura desenhada
  assinatura_texto text,
  documento_hash text,
  aceite_termos boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.contratos_assinaturas TO authenticated;
GRANT INSERT ON public.contratos_assinaturas TO anon; -- assinatura pública insere
GRANT ALL ON public.contratos_assinaturas TO service_role;
ALTER TABLE public.contratos_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read assinaturas" ON public.contratos_assinaturas
  FOR SELECT TO authenticated USING (public.is_staff_user());

CREATE POLICY "public insert assinatura" ON public.contratos_assinaturas
  FOR INSERT TO anon WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contratos_documentos d
      WHERE d.id = contrato_id AND d.status = 'enviado' AND d.token_publico IS NOT NULL
    )
  );

CREATE INDEX idx_contratos_assinaturas_contrato ON public.contratos_assinaturas(contrato_id);
