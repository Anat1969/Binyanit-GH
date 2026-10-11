-- Applied through the Supabase SQL tool one statement per call (multi-line batches hang the connector).
-- Removal is soft (archived / active flags): DELETE statements need an interactive confirmation the tool cannot surface.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.binyanit_admin_secret (id smallint primary key default 1 check (id = 1), code_hash text not null);
alter table public.binyanit_admin_secret enable row level security; -- no policies: unreadable through the API
-- functions: binyanit_admin_check, binyanit_admin_docs, binyanit_admin_doc_save, binyanit_admin_doc_archive,
--            binyanit_admin_replace_layer, binyanit_admin_replace_plan_text (security definer, all check the code hash)
alter table public.binyanit_plan_documents add column if not exists archived boolean not null default false;
alter table public.binyanit_layers add column if not exists active boolean not null default true;
create table if not exists public.binyanit_plan_text (id bigserial primary key, ord integer not null, kind text not null check (kind in ('heading','para','item','table')), section text, title text, body text not null, page integer, source text not null default 'הוראות התכנית', active boolean not null default true);
-- layer kinds added: special_guidelines, well_site, building_restriction
-- binyanit_lookup now returns special_guidelines and nearest_well_m and reads active rows only
