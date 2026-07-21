create table public.access_gate_config (
  singleton boolean primary key default true check (singleton),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_gate_attempts (
  ip text primary key,
  failure_count integer not null default 0 check (failure_count >= 0),
  first_failed_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.access_gate_config enable row level security;
alter table public.access_gate_attempts enable row level security;
revoke all on table public.authorized_ips from anon, authenticated;
revoke all on table public.access_gate_config from anon, authenticated;
revoke all on table public.access_gate_attempts from anon, authenticated;

create or replace function public.validate_access_password(client_ip text, password_attempt text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  configured_hash text;
  attempts public.access_gate_attempts%rowtype;
  normalized_failures integer;
begin
  if exists (select 1 from public.authorized_ips where ip = client_ip) then
    return jsonb_build_object('allowed', true);
  end if;

  select password_hash into configured_hash from public.access_gate_config where singleton = true;
  if configured_hash is null then raise exception 'Access gate is not configured'; end if;

  select * into attempts from public.access_gate_attempts where ip = client_ip for update;
  if attempts.blocked_until is not null and attempts.blocked_until > now() then
    return jsonb_build_object('allowed', false, 'blocked', true, 'retry_after_seconds', ceil(extract(epoch from attempts.blocked_until - now())));
  end if;

  if password_attempt is not null and extensions.crypt(password_attempt, configured_hash) = configured_hash then
    insert into public.authorized_ips (ip) values (client_ip) on conflict (ip) do nothing;
    delete from public.access_gate_attempts where ip = client_ip;
    return jsonb_build_object('allowed', true);
  end if;

  normalized_failures := case when attempts.ip is null or attempts.first_failed_at < now() - interval '15 minutes' then 1 else attempts.failure_count + 1 end;
  insert into public.access_gate_attempts (ip, failure_count, first_failed_at, blocked_until, updated_at)
  values (client_ip, normalized_failures, case when attempts.ip is null or attempts.first_failed_at < now() - interval '15 minutes' then now() else attempts.first_failed_at end, case when normalized_failures >= 5 then now() + interval '15 minutes' else null end, now())
  on conflict (ip) do update set failure_count = excluded.failure_count, first_failed_at = excluded.first_failed_at, blocked_until = excluded.blocked_until, updated_at = excluded.updated_at
  returning * into attempts;

  return jsonb_build_object('allowed', false, 'blocked', coalesce(attempts.blocked_until > now(), false), 'attempts_remaining', greatest(0, 5 - normalized_failures));
end;
$$;

revoke all on function public.validate_access_password(text, text) from public, anon, authenticated;
grant execute on function public.validate_access_password(text, text) to service_role;
