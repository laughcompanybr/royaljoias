-- product-images bucket policies (single-tenant): any authenticated user
-- may read/write objects in this bucket.
DROP POLICY IF EXISTS "product-images read staff"   ON storage.objects;
DROP POLICY IF EXISTS "product-images insert staff" ON storage.objects;
DROP POLICY IF EXISTS "product-images update staff" ON storage.objects;
DROP POLICY IF EXISTS "product-images delete staff" ON storage.objects;

CREATE POLICY "product-images read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "product-images insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product-images update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "product-images delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');
