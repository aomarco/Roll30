-- Original private-site gate foundation. The password validator and lockout
-- tables are added by the following access-gate migration.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.authorized_ips (
  ip text primary key,
  created_at timestamptz not null default now()
);

alter table public.authorized_ips enable row level security;
revoke all on public.authorized_ips from anon, authenticated;

