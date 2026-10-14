-- Migration: customers + notifications
-- Ejecutar en Supabase SQL Editor

-- 1. Tabla de clientes
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  preferred_gender text,
  preferred_categories text[] DEFAULT '{}',
  preferred_brands text[] DEFAULT '{}',
  preferred_sizes text[] DEFAULT '{}',
  notify_offers boolean DEFAULT true,
  notify_orders boolean DEFAULT true,
  notify_new_arrivals boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Vincular votos a cliente
ALTER TABLE public.product_votes ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- 4. Vincular ventas/pedidos a cliente
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- 5. RLS clientes
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_read_own" ON public.customers;
CREATE POLICY "customers_read_own" ON public.customers
  FOR SELECT USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
CREATE POLICY "customers_update_own" ON public.customers
  FOR UPDATE USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "customers_insert_own" ON public.customers;
CREATE POLICY "customers_insert_own" ON public.customers
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "customers_admin_all" ON public.customers;
CREATE POLICY "customers_admin_all" ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. RLS notificaciones
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_read_own" ON public.notifications;
CREATE POLICY "notifications_read_own" ON public.notifications
  FOR SELECT USING (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "notifications_admin_all" ON public.notifications;
CREATE POLICY "notifications_admin_all" ON public.notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_customers_auth ON public.customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON public.notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(customer_id, is_read);
