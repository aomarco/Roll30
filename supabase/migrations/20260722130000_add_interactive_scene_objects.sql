create table public.scene_objects (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  name text not null,
  object_type text not null default 'object' check (object_type in ('object','door','lever','trap','light')),
  x integer not null default 50 check (x between 0 and 100),
  y integer not null default 50 check (y between 0 and 100),
  state jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index scene_objects_scene_id_idx on public.scene_objects(scene_id);
alter table public.scene_objects enable row level security;
grant select, insert, update, delete on public.scene_objects to authenticated;

create policy "members read scene objects"
on public.scene_objects for select to authenticated
using (exists (select 1 from public.scenes s where s.id = scene_id and public.is_campaign_member(s.campaign_id)));

create policy "gms manage scene objects"
on public.scene_objects for all to authenticated
using (exists (select 1 from public.scenes s where s.id = scene_id and public.is_campaign_gm(s.campaign_id)))
with check (exists (select 1 from public.scenes s where s.id = scene_id and public.is_campaign_gm(s.campaign_id)));
