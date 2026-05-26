
-- ============= PROFILES & ROLES =============
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'comercial', 'operacional', 'cs');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-cria profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email, NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= CLIENTES: permitir edição =============
CREATE POLICY "Authenticated can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (true);

-- ============= DADOS CORPORATIVOS =============
CREATE TABLE public.dados_corporativos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome_fantasia TEXT,
  razao_social TEXT,
  cnpj TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade_uf TEXT,
  cep TEXT,
  representante_nome TEXT,
  representante_cpf TEXT,
  status_crm TEXT,
  telefone TEXT,
  email_comercial TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dados_corporativos TO authenticated;
GRANT ALL ON public.dados_corporativos TO service_role;
ALTER TABLE public.dados_corporativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read dados" ON public.dados_corporativos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert dados" ON public.dados_corporativos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update dados" ON public.dados_corporativos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete dados" ON public.dados_corporativos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER touch_dados_corporativos BEFORE UPDATE ON public.dados_corporativos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= CONTRATOS =============
CREATE TYPE public.contrato_tipo AS ENUM ('base', 'upsell', 'renovacao');

CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo public.contrato_tipo NOT NULL DEFAULT 'base',
  produto_contratado TEXT,
  tipo_projeto TEXT,
  banco_recebimento TEXT,
  inicio_contrato DATE,
  fim_contrato DATE,
  forma_pagamento TEXT,
  dia_vencimento INT,
  fee_mensal NUMERIC(12,2),
  valor_total NUMERIC(12,2),
  valor_recebido NUMERIC(12,2) DEFAULT 0,
  status_recebimento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read contratos" ON public.contratos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update contratos" ON public.contratos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete contratos" ON public.contratos FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_contratos_cliente ON public.contratos(cliente_id);
CREATE TRIGGER touch_contratos BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= EQUIPE COMERCIAL =============
CREATE TABLE public.equipe_comercial_cliente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  vendedor_nome TEXT,
  vendedor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pre_vendedor_nome TEXT,
  pre_vendedor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_venda DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_comercial_cliente TO authenticated;
GRANT ALL ON public.equipe_comercial_cliente TO service_role;
ALTER TABLE public.equipe_comercial_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read equipe" ON public.equipe_comercial_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert equipe" ON public.equipe_comercial_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update equipe" ON public.equipe_comercial_cliente FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete equipe" ON public.equipe_comercial_cliente FOR DELETE TO authenticated USING (true);
CREATE TRIGGER touch_equipe BEFORE UPDATE ON public.equipe_comercial_cliente FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= COMPROVANTES (anexos) =============
CREATE TABLE public.comprovantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_arquivo TEXT,
  tamanho INT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.comprovantes TO authenticated;
GRANT ALL ON public.comprovantes TO service_role;
ALTER TABLE public.comprovantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read comprovantes" ON public.comprovantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert comprovantes" ON public.comprovantes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete comprovantes" ON public.comprovantes FOR DELETE TO authenticated USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes', 'comprovantes', false);

CREATE POLICY "Auth read comprovantes bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'comprovantes');
CREATE POLICY "Auth upload comprovantes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprovantes');
CREATE POLICY "Auth delete comprovantes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'comprovantes');
