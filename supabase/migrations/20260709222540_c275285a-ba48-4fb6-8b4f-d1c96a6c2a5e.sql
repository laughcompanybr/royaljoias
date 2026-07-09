
-- product-images bucket: staff/admin only, folder = company_id
CREATE POLICY "product-images read staff" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'product-images'
    AND public.is_company_staff(((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "product-images insert staff" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_company_staff(((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "product-images update staff" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'product-images'
    AND public.is_company_staff(((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "product-images delete staff" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'product-images'
    AND public.is_company_staff(((storage.foldername(name))[1])::uuid)
  );
