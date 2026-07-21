-- Transactional Roll30 integration test. It creates disposable users and
-- gameplay records, exercises authenticated/RLS paths, and rolls everything
-- back. Run with psql against a migrated database or through the SQL editor.

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(1);

create or replace function pg_temp.roll30_assert(condition boolean, failure_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(condition, false) then
    raise exception 'Roll30 test failed: %', failure_message;
  end if;
end;
$$;

create or replace function pg_temp.roll30_expect_error(statement text, expected_message text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_message in sqlerrm) = 0 then
      raise exception 'Roll30 test failed: expected error containing "%", received "%"', expected_message, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Roll30 test failed: expected error containing "%", but the statement succeeded', expected_message;
end;
$$;

create temporary table roll30_test_context (
  key text primary key,
  id uuid,
  value text
) on commit drop;
grant all on roll30_test_context to authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('30000000-0000-4000-a000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roll30-gm-test@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Test GM"}', now(), now()),
  ('30000000-0000-4000-a000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roll30-player-test@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Test Player"}', now(), now()),
  ('30000000-0000-4000-a000-000000000103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roll30-outsider-test@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Test Outsider"}', now(), now());

select pg_temp.roll30_assert(
  (select count(*) from public.profiles where id::text like '30000000-0000-4000-a000-00000000010%') = 3,
  'the auth trigger did not create all three profiles'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000101","role":"authenticated","email":"roll30-gm-test@example.invalid"}', true);
insert into roll30_test_context(key, id, value)
select 'gm_campaign', id, join_code from public.create_roll30_campaign('Integration Test Campaign');
select pg_temp.roll30_assert(
  (select role = 'gm' from public.campaign_members where campaign_id = (select id from roll30_test_context where key = 'gm_campaign') and user_id = auth.uid()),
  'campaign creation did not create the GM membership'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000102","role":"authenticated","email":"roll30-player-test@example.invalid"}', true);
select public.join_roll30_campaign((select value from roll30_test_context where key = 'gm_campaign'));
select pg_temp.roll30_assert(
  public.is_campaign_member((select id from roll30_test_context where key = 'gm_campaign')),
  'joining by code did not create player membership'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000103","role":"authenticated","email":"roll30-outsider-test@example.invalid"}', true);
insert into roll30_test_context(key, id, value)
select 'outsider_campaign', id, join_code from public.create_roll30_campaign('Outsider Campaign');
select pg_temp.roll30_assert(
  (select count(*) from public.campaigns where id = (select id from roll30_test_context where key = 'gm_campaign')) = 0,
  'RLS exposed another campaign to an outsider'
);

reset role;

with created as (
  insert into public.scenes(campaign_id, name, scene_type, created_by, config)
  values ((select id from roll30_test_context where key = 'gm_campaign'), 'Test Scene', 'battle', '30000000-0000-4000-a000-000000000101', '{}')
  returning id
)
insert into roll30_test_context(key, id) select 'scene', id from created;

with created as (
  insert into public.characters(campaign_id, owner_id, kind, name, sheet, hp_current, hp_max)
  values ((select id from roll30_test_context where key = 'gm_campaign'), '30000000-0000-4000-a000-000000000102', 'pc', 'Test Hero', '{"speed":30,"vision":30,"armor_class":14,"attack":{"name":"Training Sword","bonus":50,"damage":3},"currency":{"gp":20}}', 10, 10)
  returning id
)
insert into roll30_test_context(key, id) select 'hero', id from created;

with created as (
  insert into public.characters(campaign_id, kind, name, sheet, hp_current, hp_max)
  values ((select id from roll30_test_context where key = 'gm_campaign'), 'monster', 'Test Target', '{"armor_class":10}', 12, 12)
  returning id
)
insert into roll30_test_context(key, id) select 'target', id from created;

update public.campaign_members
set character_id = (select id from roll30_test_context where key = 'hero')
where campaign_id = (select id from roll30_test_context where key = 'gm_campaign')
  and user_id = '30000000-0000-4000-a000-000000000102';

with created as (
  insert into public.sessions(campaign_id, scene_id, state)
  values ((select id from roll30_test_context where key = 'gm_campaign'), (select id from roll30_test_context where key = 'scene'), '{"fog":false,"walls":[],"lights":[],"reveals":{},"initiative":[]}')
  returning id
)
insert into roll30_test_context(key, id) select 'session', id from created;

with created as (
  insert into public.prompts(campaign_id, created_by, title, body)
  values ((select id from roll30_test_context where key = 'gm_campaign'), '30000000-0000-4000-a000-000000000101', 'Test Prompt', 'Answer me')
  returning id
)
insert into roll30_test_context(key, id) select 'prompt', id from created;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000101","role":"authenticated","email":"roll30-gm-test@example.invalid"}', true);
insert into roll30_test_context(key, id)
select 'hero_token', id from public.add_roll30_session_token(
  (select id from roll30_test_context where key = 'session'),
  (select id from roll30_test_context where key = 'hero')
);
insert into roll30_test_context(key, id)
select 'target_token', id from public.add_roll30_session_token(
  (select id from roll30_test_context where key = 'session'),
  (select id from roll30_test_context where key = 'target')
);
select public.add_roll30_initiative_entry(
  (select id from roll30_test_context where key = 'session'),
  (select id from roll30_test_context where key = 'hero_token'),
  18
);
select pg_temp.roll30_assert(
  (select jsonb_array_length(state -> 'initiative') from public.sessions where id = (select id from roll30_test_context where key = 'session')) = 1,
  'normalized token could not be added to initiative'
);

insert into roll30_test_context(key, id)
select 'snapshot', id from public.snapshot_roll30_session(
  (select id from roll30_test_context where key = 'session'), 'Before movement'
);
select pg_temp.roll30_assert(
  (select jsonb_array_length(state -> 'tokens') from public.session_snapshots where id = (select id from roll30_test_context where key = 'snapshot')) = 2,
  'snapshot did not include normalized tokens'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000102","role":"authenticated","email":"roll30-player-test@example.invalid"}', true);
select public.move_roll30_token(
  (select id from roll30_test_context where key = 'session'),
  (select id::text from roll30_test_context where key = 'hero_token'), 60, 50
);
select pg_temp.roll30_assert(
  (select x = 60 from public.session_tokens where id = (select id from roll30_test_context where key = 'hero_token')),
  'player could not move their owned token'
);
select pg_temp.roll30_expect_error(
  format('select public.move_roll30_token(%L::uuid,%L,55,55)',
    (select id from roll30_test_context where key = 'session'),
    (select id::text from roll30_test_context where key = 'target_token')),
  'You can only move your own token'
);
select public.change_roll30_hp((select id from roll30_test_context where key = 'hero'), -2);
select pg_temp.roll30_expect_error(
  format('select public.change_roll30_hp(%L::uuid,-2)', (select id from roll30_test_context where key = 'target')),
  'Not permitted'
);
insert into public.prompt_responses(prompt_id, user_id, response)
values ((select id from roll30_test_context where key = 'prompt'), auth.uid(), '{"text":"Ready"}');
select public.resolve_roll30_attack(
  (select id from roll30_test_context where key = 'hero'),
  (select id from roll30_test_context where key = 'target')
);
select pg_temp.roll30_assert(
  (select count(*) from public.messages where campaign_id = (select id from roll30_test_context where key = 'gm_campaign') and kind = 'attack') = 1,
  'server-resolved combat did not record an attack message'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000101","role":"authenticated","email":"roll30-gm-test@example.invalid"}', true);
select pg_temp.roll30_assert(
  (select count(*) from public.prompt_responses where prompt_id = (select id from roll30_test_context where key = 'prompt')) = 1,
  'GM could not read the player prompt response'
);
select public.restore_roll30_snapshot((select id from roll30_test_context where key = 'snapshot'));
select pg_temp.roll30_assert(
  (select x = 50 from public.session_tokens where id = (select id from roll30_test_context where key = 'hero_token')),
  'snapshot restore did not restore normalized token position'
);
select public.remove_roll30_session_token(
  (select id from roll30_test_context where key = 'session'),
  (select id from roll30_test_context where key = 'hero_token')
);
select pg_temp.roll30_assert(
  not exists (select 1 from public.session_tokens where id = (select id from roll30_test_context where key = 'hero_token')),
  'GM token removal did not delete the normalized token'
);
select pg_temp.roll30_assert(
  (select jsonb_array_length(state -> 'initiative') from public.sessions where id = (select id from roll30_test_context where key = 'session')) = 0,
  'token removal did not clean initiative state'
);
select public.regenerate_roll30_join_code((select id from roll30_test_context where key = 'gm_campaign'));
select pg_temp.roll30_assert(
  (select join_code from public.campaigns where id = (select id from roll30_test_context where key = 'gm_campaign')) <> (select value from roll30_test_context where key = 'gm_campaign'),
  'join-code rotation did not replace the old code'
);
select public.set_roll30_campaign_archived((select id from roll30_test_context where key = 'gm_campaign'), true);
select pg_temp.roll30_assert(
  (select archived_at is not null from public.campaigns where id = (select id from roll30_test_context where key = 'gm_campaign')),
  'campaign archive did not persist'
);
select public.set_roll30_campaign_archived((select id from roll30_test_context where key = 'gm_campaign'), false);
select public.set_roll30_member_role(
  (select id from roll30_test_context where key = 'gm_campaign'),
  '30000000-0000-4000-a000-000000000102', 'gm'
);
select public.set_roll30_member_role(
  (select id from roll30_test_context where key = 'gm_campaign'),
  '30000000-0000-4000-a000-000000000102', 'player'
);
select public.trash_roll30_campaign((select id from roll30_test_context where key = 'gm_campaign'));
select pg_temp.roll30_assert(
  not public.is_campaign_member((select id from roll30_test_context where key = 'gm_campaign')),
  'trashed campaign still authorized child-data access'
);
select public.restore_roll30_campaign((select id from roll30_test_context where key = 'gm_campaign'));

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000102","role":"authenticated","email":"roll30-player-test@example.invalid"}', true);
select public.leave_roll30_campaign((select id from roll30_test_context where key = 'gm_campaign'));
select pg_temp.roll30_assert(
  not public.is_campaign_member((select id from roll30_test_context where key = 'gm_campaign')),
  'leaving a campaign did not remove player membership'
);

reset role;
select pg_temp.roll30_assert(
  not has_table_privilege('anon', 'public.campaigns', 'SELECT'),
  'anonymous role still has a campaign table grant'
);
select pg_temp.roll30_assert(
  not has_function_privilege('anon', 'public.create_roll30_campaign(text)', 'EXECUTE'),
  'anonymous role still has an onboarding RPC grant'
);
select pg_temp.roll30_assert(
  has_function_privilege('authenticated', 'public.create_roll30_campaign(text)', 'EXECUTE'),
  'authenticated role lost the onboarding RPC grant'
);

select extensions.pass('Roll30 GM/player/outsider integration paths passed');
select * from extensions.finish();
rollback;
