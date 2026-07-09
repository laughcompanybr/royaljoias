
-- ============ products ============
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL DEFAULT public.default_company_for_user(auth.uid()) REFERENCES public.companies(id) ON DELETE CASCADE,
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

CREATE INDEX products_company_status_idx ON public.products(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX products_company_name_idx ON public.products(company_id, name);
CREATE UNIQUE INDEX products_company_sku_uniq ON public.products(company_id, sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company staff read products" ON public.products
  FOR SELECT TO authenticated USING (public.is_company_staff(company_id));
CREATE POLICY "Company staff insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_company_staff(company_id));
CREATE POLICY "Company staff update products" ON public.products
  FOR UPDATE TO authenticated USING (public.is_company_staff(company_id)) WITH CHECK (public.is_company_staff(company_id));
CREATE POLICY "Company staff delete products" ON public.products
  FOR DELETE TO authenticated USING (public.is_company_staff(company_id));

CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER products_audit AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- ============ product_movements ============
CREATE TABLE public.product_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL DEFAULT public.default_company_for_user(auth.uid()) REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out','adjust','sale','sale_revert')),
  qty INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  reason TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  actor UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX product_movements_product_created_idx ON public.product_movements(product_id, created_at DESC);
CREATE INDEX product_movements_company_idx ON public.product_movements(company_id);

GRANT SELECT, INSERT ON public.product_movements TO authenticated;
GRANT ALL ON public.product_movements TO service_role;

ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company staff read movements" ON public.product_movements
  FOR SELECT TO authenticated USING (public.is_company_staff(company_id));
CREATE POLICY "Company staff insert movements" ON public.product_movements
  FOR INSERT TO authenticated WITH CHECK (public.is_company_staff(company_id));

-- ============ order_items ============
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL DEFAULT public.default_company_for_user(auth.uid()) REFERENCES public.companies(id) ON DELETE CASCADE,
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

CREATE INDEX order_items_order_idx ON public.order_items(order_id);
CREATE INDEX order_items_product_idx ON public.order_items(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company staff read order_items" ON public.order_items
  FOR SELECT TO authenticated USING (public.is_company_staff(company_id));
CREATE POLICY "Company staff write order_items" ON public.order_items
  FOR ALL TO authenticated USING (public.is_company_staff(company_id)) WITH CHECK (public.is_company_staff(company_id));

CREATE TRIGGER order_items_set_updated_at BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ app_settings extension ============
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS stock_block_when_insufficient BOOLEAN NOT NULL DEFAULT true;

-- ============ stock RPCs ============
CREATE OR REPLACE FUNCTION public.apply_order_stock_out(_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
  new_qty INTEGER;
  block_flag BOOLEAN;
BEGIN
  -- Only proceed if there are items with a product
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL) THEN
    RETURN;
  END IF;

  -- Read block flag from company app_settings (defaults to true)
  SELECT COALESCE(s.stock_block_when_insufficient, true) INTO block_flag
    FROM public.orders o
    LEFT JOIN public.app_settings s ON s.company_id = o.company_id
    WHERE o.id = _order_id
    LIMIT 1;

  FOR it IN
    SELECT product_id, quantity FROM public.order_items
     WHERE order_id = _order_id AND product_id IS NOT NULL
     FOR UPDATE
  LOOP
    UPDATE public.products
       SET stock_qty = stock_qty - it.quantity
     WHERE id = it.product_id
     RETURNING stock_qty INTO new_qty;

    IF new_qty < 0 AND block_flag THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %', it.product_id
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.product_movements(product_id, type, qty, qty_after, order_id, actor, reason, company_id)
    SELECT it.product_id, 'sale', -it.quantity, new_qty, _order_id, auth.uid(), 'Baixa por pedido', p.company_id
      FROM public.products p WHERE p.id = it.product_id;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.revert_order_stock(_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
  new_qty INTEGER;
BEGIN
  FOR it IN
    SELECT product_id, quantity FROM public.order_items
     WHERE order_id = _order_id AND product_id IS NOT NULL
     FOR UPDATE
  LOOP
    UPDATE public.products
       SET stock_qty = stock_qty + it.quantity
     WHERE id = it.product_id
     RETURNING stock_qty INTO new_qty;

    INSERT INTO public.product_movements(product_id, type, qty, qty_after, order_id, actor, reason, company_id)
    SELECT it.product_id, 'sale_revert', it.quantity, new_qty, _order_id, auth.uid(), 'Reversão de pedido', p.company_id
      FROM public.products p WHERE p.id = it.product_id;
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.apply_order_stock_out(UUID) FROM public, anon;
REVOKE ALL ON FUNCTION public.revert_order_stock(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_order_stock_out(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_order_stock(UUID) TO authenticated;

-- ============ trigger on orders.status ============
CREATE OR REPLACE FUNCTION public.tg_orders_stock_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_delivered BOOLEAN := (OLD.status = 'entregue');
  is_delivered  BOOLEAN := (NEW.status = 'entregue');
BEGIN
  IF is_delivered AND NOT was_delivered THEN
    PERFORM public.apply_order_stock_out(NEW.id);
  ELSIF was_delivered AND NOT is_delivered THEN
    PERFORM public.revert_order_stock(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orders_stock_sync ON public.orders;
CREATE TRIGGER trg_orders_stock_sync
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_stock_sync();

-- ============ Stock adjust RPC (in / out / adjust) ============
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  _product_id UUID,
  _type TEXT,
  _qty INTEGER,
  _reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_qty INTEGER;
  delta INTEGER;
  cid UUID;
BEGIN
  IF _type NOT IN ('in','out','adjust') THEN
    RAISE EXCEPTION 'Tipo inválido';
  END IF;

  SELECT company_id INTO cid FROM public.products WHERE id = _product_id;
  IF cid IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF NOT public.is_company_staff(cid) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  IF _type = 'in' THEN delta := abs(_qty);
  ELSIF _type = 'out' THEN delta := -abs(_qty);
  ELSE delta := _qty; -- adjust: pode ser positivo ou negativo (delta)
  END IF;

  UPDATE public.products
     SET stock_qty = stock_qty + delta
   WHERE id = _product_id
  RETURNING stock_qty INTO new_qty;

  INSERT INTO public.product_movements(product_id, type, qty, qty_after, reason, actor, company_id)
  VALUES (_product_id, _type, delta, new_qty, _reason, auth.uid(), cid);

  RETURN new_qty;
END; $$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(UUID, TEXT, INTEGER, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, TEXT, INTEGER, TEXT) TO authenticated;
