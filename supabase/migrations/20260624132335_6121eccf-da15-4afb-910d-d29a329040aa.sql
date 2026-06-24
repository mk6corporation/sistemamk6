
CREATE POLICY "staff read contratos bucket" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contratos' AND public.is_staff_user());

CREATE POLICY "staff write contratos bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos' AND public.is_staff_user());

CREATE POLICY "staff update contratos bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'contratos' AND public.is_staff_user());

CREATE POLICY "staff delete contratos bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contratos' AND public.is_staff_user());
