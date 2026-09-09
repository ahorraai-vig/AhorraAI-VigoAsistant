-- ============================================================
-- OBRACLIMA CORE SCHEMA (Single Source of Truth)
-- Version: 1.0.0
-- Migration: 002_obraclima_core.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1. OBRACLIMA CONFIG (Single row per company; default: ObraClima)
create table if not exists obraclima_config (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'OBRA-CLIMA S.L.',
  nif text not null default 'B75571059',
  address text default 'RÚA ESCULTOR NOGUEIRA, Nº 4-BAJO',
  postal_code text default '36205',
  city text default 'VIGO',
  province text default 'PONTEVEDRA',
  phone text default '+34 986 000 000',
  email text default 'info@obraclima.es',
  iban text default 'ES39 2080 5025 3130 4004 4857',
  payment_method text default 'Transferencia Bancaria.',
  default_iva numeric not null default 21,
  invoice_series text not null default '2026',
  budget_series text not null default '2026',
  next_invoice_number integer not null default 29,
  next_budget_number integer not null default 49,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed company config if empty
insert into obraclima_config (
  company_name, nif, address, postal_code, city, province, phone, email, iban,
  payment_method, default_iva, invoice_series, budget_series, next_invoice_number, next_budget_number
)
select
  'OBRA-CLIMA S.L.', 'B75571059', 'RÚA ESCULTOR NOGUEIRA, Nº 4-BAJO', '36205', 'VIGO', 'PONTEVEDRA',
  '+34 986 000 000', 'info@obraclima.es', 'ES39 2080 5025 3130 4004 4857',
  'Transferencia Bancaria.', 21, '2026', '2026', 29, 49
where not exists (select 1 from obraclima_config limit 1);

-- 2. CLIENTS (Customers directory)
create table if not exists obraclima_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text default '',
  postal_code text default '',
  city text default 'Vigo',
  province text default 'Pontevedra',
  nif text default '',
  phone text default '',
  email text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed initial clients if empty
insert into obraclima_clients (id, name, address, postal_code, city, province, nif)
values
  ('c1000000-0000-0000-0000-000000000001', 'Mari Carmen Alonso Vicente', 'C/ Julio Xesto nº 2, Segundo C', '36770', 'O Rosal', 'Pontevedra', '76891822Q'),
  ('c2000000-0000-0000-0000-000000000002', 'Iria Dominguez Valladares', 'Rua Pastoriza 12', '36900', 'Marin', 'Pontevedra', '77417846F')
on conflict do nothing;

-- 3. OFFICIAL CATALOG (Tarifas y partidas oficiales ObraClima)
create table if not exists obraclima_catalog_official (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  category text default 'General',
  price numeric not null default 0,
  unit text not null default 'ud',
  description_short text,
  image_url text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_obraclima_catalog_official_code on obraclima_catalog_official(code);
create index if not exists idx_obraclima_catalog_official_category on obraclima_catalog_official(category);

-- Seed initial official catalog if empty
insert into obraclima_catalog_official (code, name, category, unit, price)
select code, name, category, unit, price from (values
  ('AC001', 'Instalación split básico con canaleta y soportes', 'Instalación', 'ud', 180::numeric),
  ('EQ001', 'Suministro de 2 maquinas de aire acondicionado marca FREEO de 3,5 kw y 5 kw', 'Equipos', 'ud', 1500::numeric),
  ('SRV001', 'Mantenimiento preventivo anual de equipos de climatización', 'Servicios', 'ud', 120::numeric),
  ('EQ002', 'Split Daikin Sensira 3.5 kW frío/calor A++', 'Equipos', 'ud', 650::numeric),
  ('MAT001', 'Línea frigorífica de cobre aislado y cableado hasta 5m', 'Material', 'ml', 45::numeric)
) as t(code, name, category, unit, price)
where not exists (select 1 from obraclima_catalog_official limit 1);

-- 4. PROSPECTED CATALOG (Cerebro IA / Precios y referencias de mercado extraídas)
create table if not exists obraclima_catalog_prospected (
  id uuid primary key default gen_random_uuid(),
  sku text,
  name text not null,
  price numeric,
  currency text not null default 'EUR',
  category text,
  description_raw text,
  description_short text,
  specs jsonb not null default '[]'::jsonb,
  origen_url text not null,
  image_url text,
  image_cached_path text,
  metodo_extraccion text,
  enrich_status text not null default 'pending', -- pending | ok | failed | stale
  enriched_at timestamptz,
  fecha_captura timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists obraclima_catalog_prospected_url_sku_idx
  on obraclima_catalog_prospected (origen_url, coalesce(sku, ''));

create index if not exists idx_obraclima_catalog_prospected_enrich_status
  on obraclima_catalog_prospected(enrich_status);
create index if not exists idx_obraclima_catalog_prospected_category
  on obraclima_catalog_prospected(category);

-- 5. BUDGETS (Presupuestos de ObraClima)
create table if not exists obraclima_budgets (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  series text not null default '2026',
  client_id uuid references obraclima_clients(id) on delete set null,
  status text not null default 'Borrador',
  notes text default '',
  items jsonb not null default '[]'::jsonb, -- items array: [{ sku, name, description, quantity, unitPrice, unit, source }]
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  client_snapshot jsonb, -- snapshot { name, nif, address, phone, email, ... }
  pdf_path text,
  converted_to_invoice boolean not null default false,
  invoice_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_obraclima_budgets_number on obraclima_budgets(number);
create index if not exists idx_obraclima_budgets_client_id on obraclima_budgets(client_id);

-- 6. INVOICES (Facturas de ObraClima)
create table if not exists obraclima_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  series text not null default '2026',
  budget_id uuid references obraclima_budgets(id) on delete set null,
  budget_reference text,
  client_id uuid references obraclima_clients(id) on delete set null,
  status text not null default 'Emitida',
  notes text default '',
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  client_snapshot jsonb,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_obraclima_invoices_number on obraclima_invoices(number);
create index if not exists idx_obraclima_invoices_client_id on obraclima_invoices(client_id);

-- ============================================================
-- STORAGE BUCKET (Media / Cached images)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('obraclima-media', 'obraclima-media', true)
on conflict (id) do nothing;

-- ============================================================
-- RLS (Row Level Security) POLICIES
-- NOTE: The server accesses these tables via Supabase SERVICE_ROLE key,
-- which bypasses RLS safely. Anon access is denied by default.
-- ============================================================
alter table obraclima_config enable row level security;
alter table obraclima_clients enable row level security;
alter table obraclima_catalog_official enable row level security;
alter table obraclima_catalog_prospected enable row level security;
alter table obraclima_budgets enable row level security;
alter table obraclima_invoices enable row level security;

-- Authenticated admins can view/manage
create policy "Admins have full access to obraclima_config"
  on obraclima_config for all
  using (auth.role() = 'service_role' or exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

create policy "Admins have full access to obraclima_clients"
  on obraclima_clients for all
  using (auth.role() = 'service_role' or exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

create policy "Admins have full access to obraclima_catalog_official"
  on obraclima_catalog_official for all
  using (auth.role() = 'service_role' or exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

create policy "Admins have full access to obraclima_catalog_prospected"
  on obraclima_catalog_prospected for all
  using (auth.role() = 'service_role' or exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

create policy "Admins have full access to obraclima_budgets"
  on obraclima_budgets for all
  using (auth.role() = 'service_role' or exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

create policy "Admins have full access to obraclima_invoices"
  on obraclima_invoices for all
  using (auth.role() = 'service_role' or exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));
