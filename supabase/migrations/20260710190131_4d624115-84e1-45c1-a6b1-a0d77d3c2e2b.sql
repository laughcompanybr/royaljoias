-- Single-tenant refactor: remove all multi-tenant infrastructure and rebuild
-- products/product_movements/order_items + stock functions without company_id.

-- ============ 1. Drop policies that reference company_id / is_company_* ============
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

-- ============ 2. Drop triggers that fill company_id ============
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT event_object_schema AS s, event_object_table AS t, trigger_name AS n
    FROM information_schema.triggers WHERE trigger_name = 'trg_default_company_id'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', r.n, r.s, r.t);
  END LOOP;
END $$;

-- ============ 3. Drop existing product tables (rebuilt below without company_id) ============
DROP TABLE IF EXISTS public.order_items       CASCADE;
DROP TABLE IF EXISTS public.product_movements CASCADE;
DROP TABLE IF EXISTS public.products          CASCADE;

-- ============ 4. Drop company_id columns from all remaining public tables ============
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

-- ============ 5. Drop multi-tenant tables & functions ============
DROP TABLE IF EXISTS public.company_modules CASCADE;
DROP TABLE IF EXISTS public.company_members CASCADE;
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.companies       CASCADE;

DROP FUNCTION IF EXISTS public.default_company_for_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tg_default_company_id()        CASCADE;
DROP FUNCTION IF EXISTS public.is_company_staff(uuid)         CASCADE;
DROP FUNCTION IF EXISTS public.is_company_admin(uuid)         CASCADE;
DROP FUNCTION IF EXISTS public.is_company_member(uuid)        CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_admin()            CASCADE;

-- ============ 6. Ensure app_settings has stock config as a keyed row ============
INSERT INTO public.app_settings(key, value, description) VALUES
  ('stock', '{"block_when_insufficient":true}'::jsonb, 'Comportamento do estoque')
ON CONFLICT (key) DO NOTHING;

-- If app_settings previously had a stock_block_when_insufficient column, drop it
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS stock_block_when_insufficient;

-- ============ 7. Recreate products ============
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  description TEXT,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  image_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products auth all" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX products_status_idx ON public.products(status) WHERE deleted_at IS NULL;
CREATE INDEX products_name_idx   ON public.products(lower(name));
CREATE UNIQUE INDEX products_sku_uniq ON public.products(sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER products_audit AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- ============ 8. Recreate product_movements ============
CREATE TABLE public.product_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out','adjust','sale','sale_revert')),
  qty INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  reason TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  actor UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.product_movements TO authenticated;
GRANT ALL ON public.product_movements TO service_role;
ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_movements read"   ON public.product_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_movements insert" ON public.product_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX product_movements_product_created_idx ON public.product_movements(product_id, created_at DESC);
CREATE INDEX product_movements_created_idx         ON public.product_movements(created_at DESC);
CREATE INDEX product_movements_order_idx           ON public.product_movements(order_id);

-- ============ 9. Recreate order_items ============
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items auth all" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX order_items_order_idx   ON public.order_items(order_id);
CREATE INDEX order_items_product_idx ON public.order_items(product_id);
CREATE TRIGGER order_items_set_updated_at BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ 10. Stock RPCs ============
CREATE OR REPLACE FUNCTION public.apply_order_stock_out(_order_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; new_qty INTEGER; block_flag BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL) THEN
    RETURN;
  END IF;
  SELECT COALESCE((value->>'block_when_insufficient')::boolean, true) INTO block_flag
    FROM public.app_settings WHERE key = 'stock';
  IF block_flag IS NULL THEN block_flag := true; END IF;

  FOR it IN
    SELECT product_id, quantity FROM public.order_items
     WHERE order_id = _order_id AND product_id IS NOT NULL FOR UPDATE
  LOOP
    UPDATE public.products SET stock_qty = stock_qty - it.quantity
      WHERE id = it.product_id RETURNING stock_qty INTO new_qty;
    IF new_qty < 0 AND block_flag THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %', it.product_id USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.product_movements(product_id, type, qty, qty_after, order_id, actor, reason)
    VALUES (it.product_id, 'sale', -it.quantity, new_qty, _order_id, auth.uid(), 'Baixa por pedido');
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.revert_order_stock(_order_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; new_qty INTEGER;
BEGIN
  FOR it IN
    SELECT product_id, quantity FROM public.order_items
     WHERE order_id = _order_id AND product_id IS NOT NULL FOR UPDATE
  LOOP
    UPDATE public.products SET stock_qty = stock_qty + it.quantity
      WHERE id = it.product_id RETURNING stock_qty INTO new_qty;
    INSERT INTO public.product_movements(product_id, type, qty, qty_after, order_id, actor, reason)
    VALUES (it.product_id, 'sale_revert', it.quantity, new_qty, _order_id, auth.uid(), 'Reversão de pedido');
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.apply_order_stock_out(UUID) FROM public, anon;
REVOKE ALL ON FUNCTION public.revert_order_stock(UUID)    FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_order_stock_out(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_order_stock(UUID)    TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_orders_stock_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  was_delivered BOOLEAN := (OLD.status::text IN ('delivered','entregue'));
  is_delivered  BOOLEAN := (NEW.status::text IN ('delivered','entregue'));
BEGIN
  IF is_delivered AND NOT was_delivered THEN PERFORM public.apply_order_stock_out(NEW.id);
  ELSIF was_delivered AND NOT is_delivered THEN PERFORM public.revert_order_stock(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orders_stock_sync ON public.orders;
CREATE TRIGGER trg_orders_stock_sync AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_stock_sync();

CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  _product_id UUID, _type TEXT, _qty INTEGER, _reason TEXT
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_qty INTEGER; delta INTEGER;
BEGIN
  IF _type NOT IN ('in','out','adjust') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id) THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  IF _type = 'in' THEN delta := abs(_qty);
  ELSIF _type = 'out' THEN delta := -abs(_qty);
  ELSE delta := _qty;
  END IF;

  UPDATE public.products SET stock_qty = stock_qty + delta
    WHERE id = _product_id RETURNING stock_qty INTO new_qty;

  INSERT INTO public.product_movements(product_id, type, qty, qty_after, reason, actor)
  VALUES (_product_id, _type, delta, new_qty, _reason, auth.uid());

  RETURN new_qty;
END; $$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(UUID, TEXT, INTEGER, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, TEXT, INTEGER, TEXT) TO authenticated;

-- ============ 11. Storage policies for product-images (single-tenant) ============
CREATE POLICY "product-images read"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "product-images insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product-images update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "product-images delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');
