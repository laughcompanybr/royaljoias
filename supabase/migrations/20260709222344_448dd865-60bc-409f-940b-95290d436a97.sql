-- Attach BEFORE INSERT triggers to auto-populate company_id from the current user
-- and set a column DEFAULT so the generated TypeScript types treat company_id as optional.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clients',
    'client_attachments',
    'employees',
    'expenses',
    'financial_transactions',
    'orders',
    'payments',
    'order_events',
    'order_attachments',
    'goals',
    'suppliers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Set default so Supabase types generator marks the Insert column as optional
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT public.default_company_for_user(auth.uid())',
      t
    );
    -- Trigger fallback (covers cases where default cannot resolve, e.g. service role)
    EXECUTE format('DROP TRIGGER IF EXISTS trg_default_company_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_default_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_default_company_id()',
      t
    );
  END LOOP;
END $$;