-- Habilitar Realtime para as tabelas usadas pelo dashboard
ALTER TABLE public.clientes REPLICA IDENTITY FULL;
ALTER TABLE public.mudancas_estagio REPLICA IDENTITY FULL;
ALTER TABLE public.contratos REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mudancas_estagio;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contratos;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;