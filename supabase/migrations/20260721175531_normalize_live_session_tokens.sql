-- Token positions are intentionally separate from the broadly shared session state.
create table public.session_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  name text not null,
  x integer not null check (x between 2 and 98),
  y integer not null check (y between 2 and 98),
  speed numeric not null default 30 check (speed > 0),
  created_at timestamptz not null default now(),
  unique(session_id, character_id)
);
create index session_tokens_session_idx on public.session_tokens(session_id);
alter table public.session_tokens enable row level security;
grant select,insert,update,delete on public.session_tokens to authenticated;
create policy "gms manage session tokens" on public.session_tokens for all to authenticated
using (exists (select 1 from public.sessions s where s.id=session_id and public.is_campaign_gm(s.campaign_id)))
with check (exists (select 1 from public.sessions s where s.id=session_id and public.is_campaign_gm(s.campaign_id)));
create policy "players read own session token" on public.session_tokens for select to authenticated
using (exists (select 1 from public.characters c where c.id=character_id and c.owner_id=(select auth.uid())));

insert into public.session_tokens(id,session_id,character_id,name,x,y,speed)
select (token->>'id')::uuid,s.id,(token->>'character_id')::uuid,token->>'name',greatest(2,least(98,(token->>'x')::integer)),greatest(2,least(98,(token->>'y')::integer)),coalesce((token->>'speed')::numeric,30)
from public.sessions s cross join lateral jsonb_array_elements(coalesce(s.state->'tokens','[]'::jsonb)) token
on conflict (id) do nothing;
update public.sessions set state=jsonb_set(state,'{tokens}','[]'::jsonb,true) where jsonb_array_length(coalesce(state->'tokens','[]'::jsonb))>0;
