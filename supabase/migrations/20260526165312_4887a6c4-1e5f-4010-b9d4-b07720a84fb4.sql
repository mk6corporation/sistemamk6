
-- Allow public (anon) read access to dashboard tables
CREATE POLICY "Public read clientes" ON public.clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Public read mudancas" ON public.mudancas_estagio FOR SELECT TO anon USING (true);
CREATE POLICY "Public read sync_runs" ON public.sync_runs FOR SELECT TO anon USING (true);

GRANT SELECT ON public.clientes TO anon;
GRANT SELECT ON public.mudancas_estagio TO anon;
GRANT SELECT ON public.sync_runs TO anon;
