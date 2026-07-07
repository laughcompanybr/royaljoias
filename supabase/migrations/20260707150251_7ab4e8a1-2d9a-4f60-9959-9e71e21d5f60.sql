
DROP POLICY IF EXISTS "finance-receipts insert" ON storage.objects;
DROP POLICY IF EXISTS "finance-receipts read" ON storage.objects;
DROP POLICY IF EXISTS "finance-receipts update" ON storage.objects;
DROP POLICY IF EXISTS "finance-receipts delete" ON storage.objects;

CREATE POLICY "finance-receipts insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'finance-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "finance-receipts read own or staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'finance-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_staff_or_admin(auth.uid())
    )
  );

CREATE POLICY "finance-receipts update own or staff"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'finance-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_staff_or_admin(auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'finance-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_staff_or_admin(auth.uid())
    )
  );

CREATE POLICY "finance-receipts delete own or staff"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'finance-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_staff_or_admin(auth.uid())
    )
  );
