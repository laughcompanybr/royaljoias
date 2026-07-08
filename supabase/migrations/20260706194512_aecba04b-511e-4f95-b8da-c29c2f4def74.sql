
-- =========================================================================
-- 1. SOFT DELETE COLUMNS
-- =========================================================================
ALTER TABLE public.clients   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.orders    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- =========================================================================
-- 2. DATA INTEGRITY CONSTRAINTS
-- =========================================================================
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_cost_price_nonneg CHECK (cost_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_sale_price_nonneg CHECK (sale_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_amount_received_nonneg CHECK (amount_received >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique CPF (quando informado) para clientes ativos
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_cpf_active
  ON public.clients (cpf) WHERE cpf IS NOT NULL AND deleted_at IS NULL;

-- =========================================================================
-- 3. PERFORMANCE INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_clients_phone         ON public.clients (phone);
CREATE INDEX IF NOT EXISTS idx_clients_created_at    ON public.clients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at    ON public.clients (deleted_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_name        ON public.suppliers (name);
CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at  ON public.suppliers (deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at     ON public.orders (deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order        ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at      ON public.payments (paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_incurred_at  ON public.expenses (incurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category     ON public.expenses (category);
CREATE INDEX IF NOT EXISTS idx_order_events_created  ON public.order_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_attach_order    ON public.order_attachments (order_id);

-- =========================================================================
-- 4. ATTACH updated_at TRIGGERS
-- =========================================================================
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['clients','suppliers','orders','payments','profiles']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at()', t);
  END LOOP;
END $$;

-- Ensure updated_at exists on payments and suppliers
ALTER TABLE public.payments  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- =========================================================================
-- 5. ATTACH order events trigger + auth user handler
-- =========================================================================
DROP TRIGGER IF EXISTS trg_order_event ON public.orders;
CREATE TRIGGER trg_order_event
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_event();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 6. APP SETTINGS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read settings"  ON public.app_settings;
DROP POLICY IF EXISTS "Admins manage settings"           ON public.app_settings;

CREATE POLICY "Authenticated can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON public.app_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- 7. AUDIT LOG
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           BIGSERIAL PRIMARY KEY,
  table_name   TEXT NOT NULL,
  record_id    TEXT NOT NULL,
  operation    TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  actor        UUID,
  old_data     JSONB,
  new_data     JSONB,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at   ON public.audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor        ON public.audit_log (actor);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit" ON public.audit_log;
CREATE POLICY "Admins read audit" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.tg_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_id    TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := (to_jsonb(OLD) ->> 'id');
    INSERT INTO public.audit_log(table_name, record_id, operation, actor, old_data)
    VALUES (TG_TABLE_NAME, v_id, 'DELETE', v_actor, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := (to_jsonb(NEW) ->> 'id');
    INSERT INTO public.audit_log(table_name, record_id, operation, actor, old_data, new_data)
    VALUES (TG_TABLE_NAME, v_id, 'UPDATE', v_actor, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    v_id := (to_jsonb(NEW) ->> 'id');
    INSERT INTO public.audit_log(table_name, record_id, operation, actor, new_data)
    VALUES (TG_TABLE_NAME, v_id, 'INSERT', v_actor, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END; $$;

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['clients','suppliers','orders','payments','expenses']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit()', t);
  END LOOP;
END $$;

-- =========================================================================
-- 8. SEED DEFAULT SETTINGS
-- =========================================================================
INSERT INTO public.app_settings(key, value, description) VALUES
  ('company', '{"name":"Royal Joias","currency":"BRL","timezone":"America/Sao_Paulo"}'::jsonb, 'Dados da empresa'),
  ('order_statuses', '["novo","em_producao","aguardando_pagamento","enviado","concluido","cancelado"]'::jsonb, 'Status disponíveis para pedidos'),
  ('notifications', '{"email":true,"whatsapp":false}'::jsonb, 'Preferências de notificação')
ON CONFLICT (key) DO NOTHING;
