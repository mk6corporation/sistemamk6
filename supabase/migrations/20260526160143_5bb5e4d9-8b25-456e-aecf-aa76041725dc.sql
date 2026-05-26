ALTER TABLE public.clientes ADD COLUMN removido_em timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_clientes_removido_em ON public.clientes(removido_em);
CREATE INDEX IF NOT EXISTS idx_clientes_categoria ON public.clientes(categoria) WHERE removido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_mudancas_detectada_em ON public.mudancas_estagio(detectada_em DESC);
CREATE INDEX IF NOT EXISTS idx_mudancas_tipo ON public.mudancas_estagio(tipo_mudanca);