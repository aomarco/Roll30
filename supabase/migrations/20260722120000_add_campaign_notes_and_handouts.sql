create table public.campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  kind text not null default 'note' check (kind in ('note','handout','lore','rule')),
  title text not null,
  body text not null default '',
  hidden boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_notes_campaign_id_idx on public.campaign_notes(campaign_id, created_at desc);
alter table public.campaign_notes enable row level security;
grant select, insert, update, delete on public.campaign_notes to authenticated;

create policy "members read revealed campaign notes"
on public.campaign_notes for select to authenticated
using (public.is_campaign_member(campaign_id) and (not hidden or public.is_campaign_gm(campaign_id)));

create policy "gms create campaign notes"
on public.campaign_notes for insert to authenticated
with check (public.is_campaign_gm(campaign_id) and created_by = (select auth.uid()));

create policy "gms update campaign notes"
on public.campaign_notes for update to authenticated
using (public.is_campaign_gm(campaign_id))
with check (public.is_campaign_gm(campaign_id));

create policy "gms delete campaign notes"
on public.campaign_notes for delete to authenticated
using (public.is_campaign_gm(campaign_id));
