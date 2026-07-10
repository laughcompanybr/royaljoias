DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_settings','client_attachments','clients','employees','expenses',
    'financial_transactions','goals','order_attachments','order_events',
    'orders','payments','suppliers'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "auth all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;