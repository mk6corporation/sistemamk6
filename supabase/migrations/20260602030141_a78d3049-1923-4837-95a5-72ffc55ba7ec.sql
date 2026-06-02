
-- 1) vendedor_links: 1 link por cliente
CREATE TABLE public.vendedor_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  titulo text,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id)
);

GRANT SELECT ON public.vendedor_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedor_links TO authenticated;
GRANT ALL ON public.vendedor_links TO service_role;

ALTER TABLE public.vendedor_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read vendedor_links ativos"
  ON public.vendedor_links FOR SELECT TO anon
  USING (ativo = true);

CREATE POLICY "Auth read vendedor_links"
  ON public.vendedor_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insert vendedor_links"
  ON public.vendedor_links FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth update vendedor_links"
  ON public.vendedor_links FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth delete vendedor_links"
  ON public.vendedor_links FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_vendedor_links_updated
  BEFORE UPDATE ON public.vendedor_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) vendedor_profiles
CREATE TABLE public.vendedor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  cliente_id uuid NOT NULL,
  nome text NOT NULL,
  email text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedor_profiles TO authenticated;
GRANT ALL ON public.vendedor_profiles TO service_role;

ALTER TABLE public.vendedor_profiles ENABLE ROW LEVEL SECURITY;

-- Vendedor lê o próprio perfil; equipe interna lê todos
CREATE POLICY "Vendedor read own profile or staff reads all"
  ON public.vendedor_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Vendedor insert own profile"
  ON public.vendedor_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vendedor update own profile or staff updates all"
  ON public.vendedor_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Staff delete vendedor_profiles"
  ON public.vendedor_profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE INDEX idx_vendedor_profiles_cliente ON public.vendedor_profiles(cliente_id);

CREATE TRIGGER trg_vendedor_profiles_updated
  BEFORE UPDATE ON public.vendedor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) vendedor_registros_diarios
CREATE TABLE public.vendedor_registros_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_user_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  leads_recebidos integer NOT NULL DEFAULT 0,
  ligacoes integer NOT NULL DEFAULT 0,
  follow_ups integer NOT NULL DEFAULT 0,
  cotacoes_enviadas integer NOT NULL DEFAULT 0,
  vendas_fechadas integer NOT NULL DEFAULT 0,
  faturamento_bruto numeric NOT NULL DEFAULT 0,
  motivos_perda jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendedor_user_id, data)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedor_registros_diarios TO authenticated;
GRANT ALL ON public.vendedor_registros_diarios TO service_role;

ALTER TABLE public.vendedor_registros_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedor read own registros or staff reads all"
  ON public.vendedor_registros_diarios FOR SELECT TO authenticated
  USING (auth.uid() = vendedor_user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Vendedor insert own registros"
  ON public.vendedor_registros_diarios FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = vendedor_user_id);

CREATE POLICY "Vendedor update own registros or staff"
  ON public.vendedor_registros_diarios FOR UPDATE TO authenticated
  USING (auth.uid() = vendedor_user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Vendedor delete own registros or staff"
  ON public.vendedor_registros_diarios FOR DELETE TO authenticated
  USING (auth.uid() = vendedor_user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE INDEX idx_vendedor_reg_cliente_data ON public.vendedor_registros_diarios(cliente_id, data);
CREATE INDEX idx_vendedor_reg_vendedor_data ON public.vendedor_registros_diarios(vendedor_user_id, data);

CREATE TRIGGER trg_vendedor_reg_updated
  BEFORE UPDATE ON public.vendedor_registros_diarios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Catálogo de motivos de perda
CREATE TABLE public.vendedor_motivos_perda_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendedor_motivos_perda_catalogo TO anon, authenticated;
GRANT ALL ON public.vendedor_motivos_perda_catalogo TO service_role;

ALTER TABLE public.vendedor_motivos_perda_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read motivos"
  ON public.vendedor_motivos_perda_catalogo FOR SELECT
  TO anon, authenticated USING (ativo = true);

CREATE POLICY "Staff manage motivos"
  ON public.vendedor_motivos_perda_catalogo FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()));

INSERT INTO public.vendedor_motivos_perda_catalogo (nome, ordem) VALUES
  ('Preço', 10),
  ('Prazo de entrega', 20),
  ('Concorrente fechou', 30),
  ('Sem retorno do cliente', 40),
  ('Não tem perfil', 50),
  ('Forma de pagamento', 60),
  ('Produto/serviço indisponível', 70),
  ('Cliente desistiu da compra', 80),
  ('Outros', 999);
