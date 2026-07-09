
-- Helper macro pattern: drop old permissive policies and recreate staff-scoped ones

-- clientes
DROP POLICY IF EXISTS "Public read clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can delete clientes" ON public.clientes;
REVOKE SELECT ON public.clientes FROM anon;
CREATE POLICY "Staff read clientes" ON public.clientes FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "Staff insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff update clientes" ON public.clientes FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff delete clientes" ON public.clientes FOR DELETE TO authenticated USING (public.is_staff_user());

-- mudancas_estagio
DROP POLICY IF EXISTS "Public read mudancas" ON public.mudancas_estagio;
DROP POLICY IF EXISTS "Authenticated users can view all stage changes" ON public.mudancas_estagio;
REVOKE SELECT ON public.mudancas_estagio FROM anon;
CREATE POLICY "Staff read mudancas" ON public.mudancas_estagio FOR SELECT TO authenticated USING (public.is_staff_user());

-- sync_runs
DROP POLICY IF EXISTS "Public read sync_runs" ON public.sync_runs;
DROP POLICY IF EXISTS "Authenticated users can view all sync runs" ON public.sync_runs;
REVOKE SELECT ON public.sync_runs FROM anon;
CREATE POLICY "Staff read sync_runs" ON public.sync_runs FOR SELECT TO authenticated USING (public.is_staff_user());

-- contratos
DROP POLICY IF EXISTS "Auth read contratos" ON public.contratos;
DROP POLICY IF EXISTS "Auth insert contratos" ON public.contratos;
DROP POLICY IF EXISTS "Auth update contratos" ON public.contratos;
DROP POLICY IF EXISTS "Auth delete contratos" ON public.contratos;
CREATE POLICY "Staff read contratos" ON public.contratos FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "Staff insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff update contratos" ON public.contratos FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff delete contratos" ON public.contratos FOR DELETE TO authenticated USING (public.is_staff_user());

-- dados_corporativos
DROP POLICY IF EXISTS "Auth read dados" ON public.dados_corporativos;
DROP POLICY IF EXISTS "Auth insert dados" ON public.dados_corporativos;
DROP POLICY IF EXISTS "Auth update dados" ON public.dados_corporativos;
DROP POLICY IF EXISTS "Auth delete dados" ON public.dados_corporativos;
CREATE POLICY "Staff read dados" ON public.dados_corporativos FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "Staff insert dados" ON public.dados_corporativos FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff update dados" ON public.dados_corporativos FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff delete dados" ON public.dados_corporativos FOR DELETE TO authenticated USING (public.is_staff_user());

-- comprovantes
DROP POLICY IF EXISTS "Auth read comprovantes" ON public.comprovantes;
DROP POLICY IF EXISTS "Auth insert comprovantes" ON public.comprovantes;
DROP POLICY IF EXISTS "Auth delete comprovantes" ON public.comprovantes;
CREATE POLICY "Staff read comprovantes" ON public.comprovantes FOR SELECT TO authenticated USING (public.is_staff_user());
CREATE POLICY "Staff insert comprovantes" ON public.comprovantes FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff delete comprovantes" ON public.comprovantes FOR DELETE TO authenticated USING (public.is_staff_user());

-- cliente_checkins
DROP POLICY IF EXISTS "Auth read checkins" ON public.cliente_checkins;
DROP POLICY IF EXISTS "Auth insert checkins" ON public.cliente_checkins;
DROP POLICY IF EXISTS "Auth update checkins" ON public.cliente_checkins;
DROP POLICY IF EXISTS "Auth delete checkins" ON public.cliente_checkins;
CREATE POLICY "Staff manage checkins" ON public.cliente_checkins FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- cliente_nps
DROP POLICY IF EXISTS "Auth read nps" ON public.cliente_nps;
DROP POLICY IF EXISTS "Auth insert nps" ON public.cliente_nps;
DROP POLICY IF EXISTS "Auth update nps" ON public.cliente_nps;
DROP POLICY IF EXISTS "Auth delete nps" ON public.cliente_nps;
CREATE POLICY "Staff manage nps" ON public.cliente_nps FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- cliente_performance
DROP POLICY IF EXISTS "Auth read perf" ON public.cliente_performance;
DROP POLICY IF EXISTS "Auth insert perf" ON public.cliente_performance;
DROP POLICY IF EXISTS "Auth update perf" ON public.cliente_performance;
DROP POLICY IF EXISTS "Auth delete perf" ON public.cliente_performance;
CREATE POLICY "Staff manage perf" ON public.cliente_performance FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- cliente_timeline_steps
DROP POLICY IF EXISTS "Auth read timeline" ON public.cliente_timeline_steps;
DROP POLICY IF EXISTS "Auth insert timeline" ON public.cliente_timeline_steps;
DROP POLICY IF EXISTS "Auth update timeline" ON public.cliente_timeline_steps;
DROP POLICY IF EXISTS "Auth delete timeline" ON public.cliente_timeline_steps;
CREATE POLICY "Staff manage timeline" ON public.cliente_timeline_steps FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- equipe_comercial_cliente
DROP POLICY IF EXISTS "Auth read equipe" ON public.equipe_comercial_cliente;
DROP POLICY IF EXISTS "Auth insert equipe" ON public.equipe_comercial_cliente;
DROP POLICY IF EXISTS "Auth update equipe" ON public.equipe_comercial_cliente;
DROP POLICY IF EXISTS "Auth delete equipe" ON public.equipe_comercial_cliente;
CREATE POLICY "Staff manage equipe" ON public.equipe_comercial_cliente FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- financeiro_sync_erros
DROP POLICY IF EXISTS "Auth read financeiro erros" ON public.financeiro_sync_erros;
CREATE POLICY "Staff read financeiro erros" ON public.financeiro_sync_erros FOR SELECT TO authenticated USING (public.is_staff_user());

-- projecoes_cliente
DROP POLICY IF EXISTS "Auth read projecoes" ON public.projecoes_cliente;
DROP POLICY IF EXISTS "Auth insert projecoes" ON public.projecoes_cliente;
DROP POLICY IF EXISTS "Auth update projecoes" ON public.projecoes_cliente;
DROP POLICY IF EXISTS "Auth delete projecoes" ON public.projecoes_cliente;
CREATE POLICY "Staff manage projecoes" ON public.projecoes_cliente FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- rotina_recorrente
DROP POLICY IF EXISTS "Auth read rotina" ON public.rotina_recorrente;
DROP POLICY IF EXISTS "Auth insert rotina" ON public.rotina_recorrente;
DROP POLICY IF EXISTS "Auth update rotina" ON public.rotina_recorrente;
DROP POLICY IF EXISTS "Auth delete rotina" ON public.rotina_recorrente;
CREATE POLICY "Staff manage rotina" ON public.rotina_recorrente FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- nps_links
DROP POLICY IF EXISTS "Auth read nps_links" ON public.nps_links;
DROP POLICY IF EXISTS "Auth insert nps_links" ON public.nps_links;
DROP POLICY IF EXISTS "Auth update nps_links" ON public.nps_links;
DROP POLICY IF EXISTS "Auth delete nps_links" ON public.nps_links;
CREATE POLICY "Staff manage nps_links" ON public.nps_links FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- vendedor_links
DROP POLICY IF EXISTS "Auth read vendedor_links" ON public.vendedor_links;
DROP POLICY IF EXISTS "Auth insert vendedor_links" ON public.vendedor_links;
DROP POLICY IF EXISTS "Auth update vendedor_links" ON public.vendedor_links;
DROP POLICY IF EXISTS "Auth delete vendedor_links" ON public.vendedor_links;
CREATE POLICY "Staff manage vendedor_links" ON public.vendedor_links FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- profiles: restrict SELECT to owner or staff
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by owner or staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_user());

-- Revoke public EXECUTE on SECURITY DEFINER trigger-only functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_cliente_contrato_datas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Revoke anon EXECUTE from helper role functions (still callable by authenticated for RLS)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff_user() FROM anon, PUBLIC;
