-- Reality Shop Ve — migración única e idempotente
-- Ejecutar en Supabase > SQL Editor. Se puede correr más de una vez sin romper nada.
-- Incluye: advisors, settings, inventory_movements, columnas nuevas de sales, RPCs de venta y entradas.

-- ============================================================
-- 1. ASESORES (tabla + columna de comisión + seed)
-- ============================================================
create table if not exists public.advisors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  commission_pct numeric not null default 5,
  created_at timestamptz not null default now()
);

-- si la tabla ya existía sin la columna, se agrega
alter table public.advisors add column if not exists commission_pct numeric not null default 5;

alter table public.advisors enable row level security;

drop policy if exists "advisors_select_anon" on public.advisors;
create policy "advisors_select_anon" on public.advisors for select to anon using (true);
drop policy if exists "advisors_insert_anon" on public.advisors;
create policy "advisors_insert_anon" on public.advisors for insert to anon with check (true);
drop policy if exists "advisors_update_anon" on public.advisors;
create policy "advisors_update_anon" on public.advisors for update to anon using (true) with check (true);
drop policy if exists "advisors_delete_anon" on public.advisors;
create policy "advisors_delete_anon" on public.advisors for delete to anon using (true);

insert into public.advisors (name) values
  ('Angel Serrano'),
  ('Jeff Carrero'),
  ('Victor Diaz')
on conflict (name) do nothing;

-- ============================================================
-- 2. AJUSTES (tasa de cambio, comisión, mantenimiento)
-- ============================================================
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings_select_anon" on public.settings;
create policy "settings_select_anon" on public.settings for select to anon using (true);
drop policy if exists "settings_insert_anon" on public.settings;
create policy "settings_insert_anon" on public.settings for insert to anon with check (true);
drop policy if exists "settings_update_anon" on public.settings;
create policy "settings_update_anon" on public.settings for update to anon using (true) with check (true);

insert into public.settings (key, value) values
  ('exchange_rate', '1'),
  ('commission_pct', '5'),
  ('maintenance_pct', '3'),
  ('maintenance_owner', 'Victor Diaz'),
  ('payment_phone', '04145623930'),
  ('binance_pay_id', '')
on conflict (key) do nothing;

-- ============================================================
-- 3. MOVIMIENTOS DE INVENTARIO (entradas, salidas, ajustes, ventas)
-- ============================================================
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text references public.products(id) on delete cascade,
  inventory_id uuid references public.inventory(id) on delete set null,
  type text not null check (type in ('entrada','salida','ajuste','venta')),
  quantity numeric not null,
  reason text,
  advisor_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_created_at on public.inventory_movements (created_at desc);
create index if not exists idx_inventory_movements_inventory on public.inventory_movements (inventory_id);

alter table public.inventory_movements enable row level security;

drop policy if exists "movements_select_anon" on public.inventory_movements;
create policy "movements_select_anon" on public.inventory_movements for select to anon using (true);
drop policy if exists "movements_insert_anon" on public.inventory_movements;
create policy "movements_insert_anon" on public.inventory_movements for insert to anon with check (true);

-- ============================================================
-- 4. COLUMNAS NUEVAS EN SALES + stock mínimo en products
-- ============================================================
alter table public.sales add column if not exists payment_method text;
alter table public.sales add column if not exists payment_reference text;
alter table public.sales add column if not exists custom_total numeric;
alter table public.sales add column if not exists tip_amount numeric not null default 0;
alter table public.sales add column if not exists sale_ref uuid;
alter table public.sales add column if not exists coupon_code text;
alter table public.sales add column if not exists coupon_discount numeric not null default 0;

-- Columnas para pedidos web (checkout con screenshot + delivery/pickup)
alter table public.sales add column if not exists payment_screenshot_url text;
alter table public.sales add column if not exists delivery_method text; -- 'delivery' | 'pickup'
alter table public.sales add column if not exists delivery_lat numeric;
alter table public.sales add column if not exists delivery_lng numeric;
alter table public.sales add column if not exists delivery_address text;
alter table public.sales add column if not exists customer_phone text;
alter table public.sales add column if not exists customer_notes text;
alter table public.sales add column if not exists order_status text; -- NULL = venta POS directa; 'pending_review' | 'verified' | 'payment_error'
alter table public.sales add column if not exists admin_notes text;

create index if not exists idx_sales_order_status on public.sales (order_status) where order_status is not null;

-- 'cortesia' pasa a ser un estado válido de liquidación
alter table public.sales drop constraint if exists sales_payment_status_check;
alter table public.sales add constraint sales_payment_status_check
  check (payment_status in ('pagado','por_cobrar','cortesia'));

alter table public.products add column if not exists min_stock integer not null default 0;

-- ============================================================
-- 4b. CUPONES AUTORIZADOS (solo los creados desde Ajustes aplican en el POS)
-- ============================================================
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric not null check (discount_value > 0),
  customer_name text,
  note text,
  is_active boolean not null default true,
  max_uses integer,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_coupons_code on public.coupons (upper(code));

alter table public.coupons enable row level security;

drop policy if exists "coupons_select_anon" on public.coupons;
create policy "coupons_select_anon" on public.coupons for select to anon using (true);
drop policy if exists "coupons_insert_anon" on public.coupons;
create policy "coupons_insert_anon" on public.coupons for insert to anon with check (true);
drop policy if exists "coupons_update_anon" on public.coupons;
create policy "coupons_update_anon" on public.coupons for update to anon using (true) with check (true);
drop policy if exists "coupons_delete_anon" on public.coupons;
create policy "coupons_delete_anon" on public.coupons for delete to anon using (true);

-- ============================================================
-- 4c. REGISTRO DE PAGOS (comisiones y mantenimiento de asesores)
-- ============================================================
create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('mantenimiento','comision')),
  advisor_name text not null,
  amount numeric not null check (amount > 0),
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_records_advisor on public.payment_records (advisor_name);
create index if not exists idx_payment_records_type on public.payment_records (type);

alter table public.payment_records enable row level security;

drop policy if exists "payment_records_select_anon" on public.payment_records;
create policy "payment_records_select_anon" on public.payment_records for select to anon using (true);
drop policy if exists "payment_records_insert_anon" on public.payment_records;
create policy "payment_records_insert_anon" on public.payment_records for insert to anon with check (true);
drop policy if exists "payment_records_update_anon" on public.payment_records;
create policy "payment_records_update_anon" on public.payment_records for update to anon using (true) with check (true);
drop policy if exists "payment_records_delete_anon" on public.payment_records;
create policy "payment_records_delete_anon" on public.payment_records for delete to anon using (true);

-- ============================================================
-- 5. RPC: VENTA TRANSACCIONAL (una sola transacción para todo el carrito)
-- ============================================================
create or replace function public.process_sale(
  p_items jsonb,
  p_advisor text,
  p_customer text,
  p_payment_method text,
  p_custom_total numeric,
  p_tip numeric,
  p_settlement text,
  p_created_at timestamptz default now(),
  p_payment_reference text default null,
  p_coupon_code text default null,
  p_coupon_discount numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref uuid := gen_random_uuid();
  item jsonb;
  v_stock numeric;
begin
  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.sales (
      product_id, inventory_id, advisor_name, customer_name,
      unit_price, total_price, quantity, quantity_paid, quantity_pending,
      payment_status, payment_method, payment_reference, custom_total, tip_amount, sale_ref, created_at,
      coupon_code, coupon_discount
    ) values (
      item->>'product_id',
      (item->>'inventory_id')::uuid,
      p_advisor,
      p_customer,
      (item->>'unit_price')::numeric,
      (item->>'total_price')::numeric,
      (item->>'quantity')::numeric,
      (item->>'quantity_paid')::numeric,
      (item->>'quantity_pending')::numeric,
      case
        when p_settlement = 'cortesia' then 'cortesia'
        when (item->>'quantity_pending')::numeric > 0 then 'por_cobrar'
        else 'pagado'
      end,
      p_payment_method,
      p_payment_reference,
      p_custom_total,
      case when coalesce((item->>'is_last')::boolean, false) then coalesce(p_tip, 0) else 0 end,
      v_ref,
      p_created_at,
      nullif(trim(coalesce(p_coupon_code, '')), ''),
      case when coalesce((item->>'is_last')::boolean, false) then coalesce(p_coupon_discount, 0) else 0 end
    );

    select stock into v_stock from public.inventory
    where id = (item->>'inventory_id')::uuid for update;

    if v_stock is not null then
      update public.inventory
      set stock = greatest(0, v_stock - (item->>'quantity')::numeric)
      where id = (item->>'inventory_id')::uuid;
    end if;

    insert into public.inventory_movements (product_id, inventory_id, type, quantity, reason, advisor_name, created_at)
    values (
      item->>'product_id',
      (item->>'inventory_id')::uuid,
      'venta',
      (item->>'quantity')::numeric,
      'Venta POS',
      p_advisor,
      p_created_at
    );
  end loop;

  -- Registrar uso del cupón autorizado (solo si existe y está activo)
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    update public.coupons
    set uses = uses + 1
    where upper(code) = upper(trim(p_coupon_code))
      and is_active
      and (max_uses is null or uses < max_uses);
  end if;

  return jsonb_build_object('sale_ref', v_ref, 'ok', true);
end;
$$;

grant execute on function public.process_sale(jsonb, text, text, text, numeric, numeric, text, timestamptz, text, text, numeric) to anon, authenticated;

-- ============================================================
-- 6. RPC: ENTRADA DE MERCANCÍA (reposición de stock)
-- ============================================================
create or replace function public.register_stock_entry(
  p_inventory_id uuid,
  p_quantity numeric,
  p_reason text,
  p_advisor text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product text;
begin
  update public.inventory
  set stock = stock + p_quantity
  where id = p_inventory_id
  returning product_id into v_product;

  if v_product is null then
    raise exception 'Variante de inventario no encontrada';
  end if;

  insert into public.inventory_movements (product_id, inventory_id, type, quantity, reason, advisor_name)
  values (v_product, p_inventory_id, 'entrada', p_quantity, coalesce(p_reason, 'Entrada de mercancía'), p_advisor);

  return jsonb_build_object('ok', true, 'product_id', v_product);
end;
$$;

grant execute on function public.register_stock_entry(uuid, numeric, text, text) to anon, authenticated;

-- ============================================================
-- 8. STORAGE: bucket para comprobantes de pago (capturas)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

-- políticas de storage para que el cliente suba y cualquiera vea las capturas
drop policy if exists "payment_proofs_insert_anon" on storage.objects;
create policy "payment_proofs_insert_anon"
  on storage.objects for insert to anon
  with check (bucket_id = 'payment-proofs');

drop policy if exists "payment_proofs_select_anon" on storage.objects;
create policy "payment_proofs_select_anon"
  on storage.objects for select to anon
  using (bucket_id = 'payment-proofs');
