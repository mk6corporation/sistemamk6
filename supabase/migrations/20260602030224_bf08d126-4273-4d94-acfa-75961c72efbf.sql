
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.vendedor_profiles vp WHERE vp.user_id = auth.uid());
$$;

-- Substitui políticas que usavam o EXISTS profiles
DROP POLICY IF EXISTS "Vendedor read own profile or staff reads all" ON public.vendedor_profiles;
DROP POLICY IF EXISTS "Vendedor update own profile or staff updates all" ON public.vendedor_profiles;
DROP POLICY IF EXISTS "Staff delete vendedor_profiles" ON public.vendedor_profiles;

CREATE POLICY "Vendedor read own profile or staff reads all"
  ON public.vendedor_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_user());

CREATE POLICY "Vendedor update own profile or staff updates all"
  ON public.vendedor_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_user());

CREATE POLICY "Staff delete vendedor_profiles"
  ON public.vendedor_profiles FOR DELETE TO authenticated
  USING (public.is_staff_user());

DROP POLICY IF EXISTS "Vendedor read own registros or staff reads all" ON public.vendedor_registros_diarios;
DROP POLICY IF EXISTS "Vendedor update own registros or staff" ON public.vendedor_registros_diarios;
DROP POLICY IF EXISTS "Vendedor delete own registros or staff" ON public.vendedor_registros_diarios;

CREATE POLICY "Vendedor read own registros or staff reads all"
  ON public.vendedor_registros_diarios FOR SELECT TO authenticated
  USING (auth.uid() = vendedor_user_id OR public.is_staff_user());

CREATE POLICY "Vendedor update own registros or staff"
  ON public.vendedor_registros_diarios FOR UPDATE TO authenticated
  USING (auth.uid() = vendedor_user_id OR public.is_staff_user());

CREATE POLICY "Vendedor delete own registros or staff"
  ON public.vendedor_registros_diarios FOR DELETE TO authenticated
  USING (auth.uid() = vendedor_user_id OR public.is_staff_user());

DROP POLICY IF EXISTS "Staff manage motivos" ON public.vendedor_motivos_perda_catalogo;
CREATE POLICY "Staff manage motivos"
  ON public.vendedor_motivos_perda_catalogo FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());
