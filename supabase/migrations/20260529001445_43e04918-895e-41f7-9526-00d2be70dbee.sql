CREATE TABLE public.nps_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  produto TEXT NOT NULL,
  titulo TEXT,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nps_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_links TO authenticated;
GRANT ALL ON public.nps_links TO service_role;

ALTER TABLE public.nps_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read nps_links ativos"
  ON public.nps_links FOR SELECT
  TO anon
  USING (ativo = true);

CREATE POLICY "Auth read nps_links"
  ON public.nps_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Auth insert nps_links"
  ON public.nps_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Auth update nps_links"
  ON public.nps_links FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Auth delete nps_links"
  ON public.nps_links FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER trg_nps_links_updated_at
  BEFORE UPDATE ON public.nps_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_nps_links_ativo ON public.nps_links(ativo) WHERE ativo = true;