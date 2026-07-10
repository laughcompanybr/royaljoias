-- =========================================================================
-- Single-tenant refactor: remove any multi-tenant infrastructure.
-- Idempotent + IF EXISTS guards — clean on a fresh DB and cleans up
-- databases that were previously multi-tenant.
-- =========================================================================

-- 1. Drop storage policies that reference is_company_staff or product-images
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname ILIKE '%product-images%' OR COALESCE(qual::text,'') ILIKE '%is_company_staff%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- 2. Drop any RLS policy in public schema whose definition references company_id / is_company_*
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual::text,'')       ~* 'company_id|is_company_(staff|admin|member)|is_platform_admin|default_company_for_user'
     OR COALESCE(with_check::text,'') ~* 'company_id|is_company_(staff|admin|member)|is_platform_admin|default_company_for_user'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- 3. Drop triggers that auto-fill company_id
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT event_object_schema AS s, event_object_table AS t, trigger_name AS n
    FROM information_schema.triggers
    WHERE trigger_name = 'trg_default_company_id'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', r.n, r.s, r.t);
  END LOOP;
END $$;

-- 4. Drop company_id columns from any public table that has them
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'company_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS company_id CASCADE', r.table_name);
  END LOOP;
END $$;

-- 5. Drop multi-tenant tables (CASCADE clears lingering FKs)
DROP TABLE IF EXISTS public.company_modules CASCADE;
DROP TABLE IF EXISTS public.company_members CASCADE;
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.companies       CASCADE;

-- 6. Drop multi-tenant helper functions
DROP FUNCTION IF EXISTS public.default_company_for_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tg_default_company_id()        CASCADE;
DROP FUNCTION IF EXISTS public.is_company_staff(uuid)         CASCADE;
DROP FUNCTION IF EXISTS public.is_company_admin(uuid)         CASCADE;
DROP FUNCTION IF EXISTS public.is_company_member(uuid)        CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_admin()            CASCADE;
