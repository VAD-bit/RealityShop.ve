-- Migration: product_votes + is_new
-- Ejecutar en Supabase SQL Editor

-- 1. Columna is_new en products (si no existe)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_new boolean DEFAULT false;

-- 2. Tabla de votos / avisos de disponibilidad
CREATE TABLE IF NOT EXISTS public.product_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size_or_detail text,
  customer_contact text,
  created_at timestamptz DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.product_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_votes" ON public.product_votes;
CREATE POLICY "anon_insert_votes" ON public.product_votes
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_votes" ON public.product_votes;
CREATE POLICY "anon_select_votes" ON public.product_votes
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "authenticated_all_votes" ON public.product_votes;
CREATE POLICY "authenticated_all_votes" ON public.product_votes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Índice
CREATE INDEX IF NOT EXISTS idx_product_votes_product ON public.product_votes(product_id);
