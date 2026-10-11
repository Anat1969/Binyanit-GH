-- Building renewal plan 603-0972307 (Ashdod). Shared project: every object carries the binyanit_ prefix.
create extension if not exists postgis with schema extensions;

-- Documents library -------------------------------------------------------
create table if not exists public.binyanit_plan_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('binding', 'background', 'historical', 'indirect')),
  description text,
  file_url text,
  source_url text,
  published boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.binyanit_plan_documents enable row level security;
drop policy if exists "binyanit docs public read" on public.binyanit_plan_documents;
create policy "binyanit docs public read" on public.binyanit_plan_documents
  for select to anon, authenticated using (published);

-- Spatial layers (digitized from the tashrit) -----------------------------
create table if not exists public.binyanit_layers (
  id bigserial primary key,
  kind text not null check (kind in (
    'plan_boundary', 'street_class', 'public_allocation_zone',
    'urban_renewal_search_zone', 'well_radius', 'quarter')),
  name text,
  props jsonb not null default '{}'::jsonb,
  geom extensions.geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now()
);
create index if not exists binyanit_layers_geom_idx on public.binyanit_layers using gist (geom);
create index if not exists binyanit_layers_kind_idx on public.binyanit_layers (kind);
alter table public.binyanit_layers enable row level security;
drop policy if exists "binyanit layers public read" on public.binyanit_layers;
create policy "binyanit layers public read" on public.binyanit_layers
  for select to anon, authenticated using (true);

-- Address checks: anonymous statistics only, no address and no personal data
create table if not exists public.binyanit_address_checks (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  quarter text check (char_length(quarter) <= 10),
  in_plan boolean,
  street_class text check (street_class in ('cityWide', 'activeFrontage', 'massTransit')),
  existing_floors smallint check (existing_floors between 1 and 60),
  existing_units smallint check (existing_units between 0 and 2000),
  eligible_routes text[] check (cardinality(eligible_routes) <= 3)
);
alter table public.binyanit_address_checks enable row level security;
drop policy if exists "binyanit checks anon insert" on public.binyanit_address_checks;
create policy "binyanit checks anon insert" on public.binyanit_address_checks
  for insert to anon, authenticated with check (true);

-- Q&A log ------------------------------------------------------------------
create table if not exists public.binyanit_qa_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  question text not null check (char_length(question) <= 1000),
  cited_sections text[] not null default '{}',
  refused boolean not null default false,
  mode text not null check (mode in ('llm', 'retrieval', 'faq'))
);
alter table public.binyanit_qa_logs enable row level security;
drop policy if exists "binyanit qa anon insert" on public.binyanit_qa_logs;
create policy "binyanit qa anon insert" on public.binyanit_qa_logs
  for insert to anon, authenticated with check (true);

-- Quarter quotas -------------------------------------------------------------
create table if not exists public.binyanit_quarter_counters (
  quarter text primary key,
  sort smallint not null default 0,
  threshold integer check (threshold >= 0),
  units_used integer check (units_used >= 0),
  units_in_process integer check (units_in_process >= 0),
  updated_at timestamptz,
  note text
);
alter table public.binyanit_quarter_counters enable row level security;
drop policy if exists "binyanit quarters public read" on public.binyanit_quarter_counters;
create policy "binyanit quarters public read" on public.binyanit_quarter_counters
  for select to anon, authenticated using (true);

insert into public.binyanit_quarter_counters (quarter, sort, threshold) values
  ('א', 1, null), ('ב', 2, null), ('ג', 3, 400), ('ד', 4, 1200), ('ה', 5, null), ('ו', 6, null),
  ('ז', 7, null), ('ח', 8, 100), ('ט', 9, null), ('י', 10, null), ('יא', 11, null), ('יב', 12, null)
on conflict (quarter) do update set threshold = excluded.threshold, sort = excluded.sort;

-- Spatial lookup for one point ----------------------------------------------
create or replace function public.binyanit_lookup(p_lon double precision, p_lat double precision)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  with pt as (select st_setsrid(st_makepoint(p_lon, p_lat), 4326) as g),
  loaded as (select array_agg(distinct kind) as kinds from binyanit_layers)
  select jsonb_build_object(
    'loaded', coalesce((select to_jsonb(kinds) from loaded), '[]'::jsonb),
    'in_plan', case when exists (select 1 from binyanit_layers where kind = 'plan_boundary')
      then exists (select 1 from binyanit_layers l, pt where l.kind = 'plan_boundary' and st_intersects(l.geom, pt.g))
      else null end,
    'street_class', case when exists (select 1 from binyanit_layers where kind = 'street_class')
      then coalesce((
        select l.props->>'class' from binyanit_layers l, pt
        where l.kind = 'street_class' and st_dwithin(l.geom::geography, pt.g::geography, coalesce((l.props->>'buffer_m')::float, 35))
        order by case l.props->>'class' when 'massTransit' then 0 when 'activeFrontage' then 1 else 2 end
        limit 1), 'cityWide')
      else null end,
    'public_allocation_zone', case when exists (select 1 from binyanit_layers where kind = 'public_allocation_zone')
      then exists (select 1 from binyanit_layers l, pt where l.kind = 'public_allocation_zone' and st_intersects(l.geom, pt.g))
      else null end,
    'urban_renewal_search_zone', case when exists (select 1 from binyanit_layers where kind = 'urban_renewal_search_zone')
      then exists (select 1 from binyanit_layers l, pt where l.kind = 'urban_renewal_search_zone' and st_intersects(l.geom, pt.g))
      else null end,
    'well_radius', case when exists (select 1 from binyanit_layers where kind = 'well_radius')
      then exists (select 1 from binyanit_layers l, pt where l.kind = 'well_radius' and st_intersects(l.geom, pt.g))
      else null end,
    'quarter', (select l.name from binyanit_layers l, pt where l.kind = 'quarter' and st_intersects(l.geom, pt.g) limit 1)
  );
$$;

create or replace function public.binyanit_layer_geojson(p_kind text)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'geometry', st_asgeojson(st_simplifypreservetopology(geom, 0.00001))::jsonb,
      'properties', props || jsonb_build_object('name', name, 'kind', kind)
    )), '[]'::jsonb))
  from binyanit_layers where kind = p_kind;
$$;

grant execute on function public.binyanit_lookup(double precision, double precision) to anon, authenticated;
grant execute on function public.binyanit_layer_geojson(text) to anon, authenticated;
