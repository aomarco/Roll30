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

with created as (
  insert into public.items(campaign_id, name, item_data)
  values ((select id from roll30_test_context where key = 'gm_campaign'), 'Test Potion', '{"type":"consumable","effect":{"healing":3}}')
  returning id
)
insert into roll30_test_context(key, id) select 'potion', id from created;

with created as (
  insert into public.scene_objects(scene_id,name,object_type,x,y,visible_to_players)
  values ((select id from roll30_test_context where key='scene'),'Secret trap','trap',20,20,false)
  returning id
)
insert into roll30_test_context(key,id) select 'secret_object',id from created;
insert into public.scene_objects(scene_id,name,object_type,x,y,visible_to_players)
values ((select id from roll30_test_context where key='scene'),'Visible door','door',40,40,true);

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

with created as (
  insert into public.campaign_assets(campaign_id, uploaded_by, kind, storage_path, label, visible_to_players)
  values ((select id from roll30_test_context where key = 'gm_campaign'), '30000000-0000-4000-a000-000000000101', 'image', (select id::text from roll30_test_context where key = 'gm_campaign') || '/private-test.png', 'Private map', false)
  returning id
)
insert into roll30_test_context(key, id) select 'private_asset', id from created;

insert into public.campaign_notes(campaign_id, created_by, kind, title, body, hidden, audience, tags)
values
  ((select id from roll30_test_context where key = 'gm_campaign'), '30000000-0000-4000-a000-000000000101', 'note', 'GM secret', 'Hidden', true, '{}', '{secret}'),
  ((select id from roll30_test_context where key = 'gm_campaign'), '30000000-0000-4000-a000-000000000101', 'handout', 'Player clue', 'Visible', false, array['30000000-0000-4000-a000-000000000102'::uuid], '{clue}');

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
select public.grant_roll30_item((select id from roll30_test_context where key='hero'),(select id from roll30_test_context where key='potion'),3);
select public.move_roll30_scene_object((select id from roll30_test_context where key='secret_object'),25,25,'gm',2);
select pg_temp.roll30_assert((select x=25 and layer='gm' from public.scene_objects where id=(select id from roll30_test_context where key='secret_object')),'GM scene-builder movement did not persist');
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
select pg_temp.roll30_assert(
  (select count(*) from public.campaign_assets where campaign_id = (select id from roll30_test_context where key = 'gm_campaign')) = 0,
  'player could read unrevealed campaign media'
);
select pg_temp.roll30_assert(
  (select count(*) from public.campaign_notes where campaign_id = (select id from roll30_test_context where key = 'gm_campaign')) = 1,
  'note audience policy did not return exactly the addressed revealed note'
);
select pg_temp.roll30_assert((select count(*) from public.scene_objects where scene_id=(select id from roll30_test_context where key='scene'))=1,'player could read unrevealed scene-builder objects');
select public.update_roll30_character_sheet(
  (select id from roll30_test_context where key = 'hero'),
  0,
  '{"abilities":{"str":16,"dex":12,"con":14,"int":10,"wis":11,"cha":8},"armor_class":15,"speed":30,"vision":30,"conditions":[],"features":["Second Wind"],"resources":[{"name":"Second Wind","current":1,"max":1,"reset":"short"}],"spellcasting":{"ability":"wis","slots":[{"level":1,"current":2,"max":2}]},"equipment":["Training Sword"],"attacks":[{"name":"Training Sword","bonus":50,"damage_dice":"1d2+1","damage_type":"slashing"}],"attack":{"name":"Training Sword","bonus":50,"damage":3},"currency":{"gp":20}}',
  10,
  10,
  null
);
select pg_temp.roll30_assert(
  (select sheet_revision = 1 and sheet -> 'abilities' ->> 'str' = '16' from public.characters where id = (select id from roll30_test_context where key = 'hero')),
  'the player could not save their versioned character sheet'
);
select public.use_roll30_character_resource((select id from roll30_test_context where key='hero'),'Second Wind',1);
select pg_temp.roll30_assert((select sheet->'resources'->0->>'current'='0' from public.characters where id=(select id from roll30_test_context where key='hero')),'resource use did not decrement atomically');
select public.rest_roll30_character((select id from roll30_test_context where key='hero'),'short');
select pg_temp.roll30_assert((select sheet->'resources'->0->>'current'='1' from public.characters where id=(select id from roll30_test_context where key='hero')),'short rest did not restore its resource');
select public.use_roll30_spell_slot((select id from roll30_test_context where key='hero'),1);
select pg_temp.roll30_assert((select sheet->'spellcasting'->'slots'->0->>'current'='1' from public.characters where id=(select id from roll30_test_context where key='hero')),'spell slot did not decrement');
select public.rest_roll30_character((select id from roll30_test_context where key='hero'),'long');
select pg_temp.roll30_assert((select sheet->'spellcasting'->'slots'->0->>'current'='2' from public.characters where id=(select id from roll30_test_context where key='hero')),'long rest did not restore spell slots');
select pg_temp.roll30_expect_error(
  format('select public.update_roll30_character_sheet(%L::uuid,0,%L::jsonb,10,10,null)',
    (select id from roll30_test_context where key = 'hero'), '{"abilities":{"str":12}}'),
  'changed elsewhere'
);
select pg_temp.roll30_expect_error(
  format('select public.update_roll30_character_sheet(%L::uuid,0,%L::jsonb,12,12,null)',
    (select id from roll30_test_context where key = 'target'), '{}'),
  'Not permitted'
);
select pg_temp.roll30_expect_error(
  format('update public.characters set sheet = %L::jsonb where id = %L::uuid', '{}', (select id from roll30_test_context where key = 'hero')),
  'permission denied'
);
select pg_temp.roll30_expect_error(
  format('select public.move_roll30_token(%L::uuid,%L,55,55)',
    (select id from roll30_test_context where key = 'session'),
    (select id::text from roll30_test_context where key = 'target_token')),
  'You can only move your own token'
);
select public.change_roll30_hp((select id from roll30_test_context where key = 'hero'), -2);
select public.mutate_roll30_inventory((select id from roll30_test_context where key='hero'),(select id from roll30_test_context where key='potion'),'equip',1,null);
select public.mutate_roll30_inventory((select id from roll30_test_context where key='hero'),(select id from roll30_test_context where key='potion'),'transfer',1,(select id from roll30_test_context where key='target'));
select public.mutate_roll30_inventory((select id from roll30_test_context where key='hero'),(select id from roll30_test_context where key='potion'),'consume',1,null);
select pg_temp.roll30_assert(
  (select quantity=1 from public.character_inventory where character_id=(select id from roll30_test_context where key='hero') and item_id=(select id from roll30_test_context where key='potion'))
  and (select quantity=1 from public.character_inventory where character_id=(select id from roll30_test_context where key='target') and item_id=(select id from roll30_test_context where key='potion'))
  and (select hp_current=10 from public.characters where id=(select id from roll30_test_context where key='hero')),
  'equip, transfer, consume, or healing inventory behavior failed'
);
select pg_temp.roll30_expect_error(
  format('select public.change_roll30_hp(%L::uuid,-2)', (select id from roll30_test_context where key = 'target')),
  'Not permitted'
);
insert into public.prompt_responses(prompt_id, user_id, response)
values ((select id from roll30_test_context where key = 'prompt'), auth.uid(), '{"text":"Ready"}');
select public.set_roll30_condition((select id from roll30_test_context where key='hero'),'Prone',true,'Hold Person');
select pg_temp.roll30_assert((select sheet->'conditions' ? 'Prone' and sheet->>'concentration'='Hold Person' from public.characters where id=(select id from roll30_test_context where key='hero')),'condition or concentration state did not persist');
select public.set_roll30_condition((select id from roll30_test_context where key='hero'),'Prone',false,null);
select public.resolve_roll30_combat_attack(
  (select id from roll30_test_context where key = 'hero'),
  (select id from roll30_test_context where key = 'target'),0,1
);
select pg_temp.roll30_assert(
  (select count(*) from public.messages where campaign_id = (select id from roll30_test_context where key = 'gm_campaign') and kind = 'attack') = 1,
  'server-resolved combat did not record an attack message'
);
select public.change_roll30_hp((select id from roll30_test_context where key='hero'),-100);
select pg_temp.roll30_assert(((public.roll_roll30_death_save((select id from roll30_test_context where key='hero')))->>'roll')::integer between 1 and 20,'death save did not produce a server roll');

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
select pg_temp.roll30_expect_error(
  format('select public.trash_roll30_scene(%L::uuid)', (select id from roll30_test_context where key = 'scene')),
  'End the live session before moving this scene to trash'
);
select pg_temp.roll30_expect_error(
  format('select public.start_roll30_session(%L::uuid,%L::uuid)',(select id from roll30_test_context where key='gm_campaign'),(select id from roll30_test_context where key='scene')),
  'already has an active session'
);
select public.end_roll30_session((select id from roll30_test_context where key='session'));
select public.resume_roll30_session((select id from roll30_test_context where key='session'));
select pg_temp.roll30_assert((select status='active' and session_code is not null from public.sessions where id=(select id from roll30_test_context where key='session')),'session resume or code failed');
select public.end_roll30_session((select id from roll30_test_context where key='session'));
select public.trash_roll30_scene((select id from roll30_test_context where key = 'scene'));
select pg_temp.roll30_assert(
  (select count(*) from public.list_roll30_trashed_scenes((select id from roll30_test_context where key = 'gm_campaign'))) = 1,
  'trashed scene was not listed for the GM'
);
select public.restore_roll30_scene((select id from roll30_test_context where key = 'scene'));
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
update public.campaign_assets set visible_to_players = true where id = (select id from roll30_test_context where key = 'private_asset');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000102","role":"authenticated","email":"roll30-player-test@example.invalid"}', true);
select pg_temp.roll30_assert(
  (select count(*) from public.campaign_assets where id = (select id from roll30_test_context where key = 'private_asset')) = 1,
  'revealed campaign media was not visible to the player'
);
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
