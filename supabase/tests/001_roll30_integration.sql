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
  insert into public.characters(campaign_id, kind, name, sheet, hp_current, hp_max)
  values ((select id from roll30_test_context where key = 'gm_campaign'), 'monster', 'Test Reinforcement', '{"armor_class":12,"speed":30}', 8, 8)
  returning id
)
insert into roll30_test_context(key, id) select 'reinforcement', id from created;

with created as (
  insert into public.items(campaign_id, name, item_data)
  values ((select id from roll30_test_context where key = 'gm_campaign'), 'Test Potion', '{"type":"consumable","effect":{"healing":3}}')
  returning id
)
insert into roll30_test_context(key, id) select 'potion', id from created;

with created as (
  insert into public.shops(campaign_id,name,settings)
  values ((select id from roll30_test_context where key='gm_campaign'),'Test Shop','{"mode":"automatic","discount":50}') returning id
)
insert into roll30_test_context(key,id) select 'shop',id from created;
insert into public.shop_stock(shop_id,item_id,price,quantity,hidden)
values ((select id from roll30_test_context where key='shop'),(select id from roll30_test_context where key='potion'),4,3,false);

with created as (
  insert into public.scene_objects(scene_id,name,object_type,x,y,visible_to_players)
  values ((select id from roll30_test_context where key='scene'),'Secret trap','trap',20,20,false)
  returning id
)
insert into roll30_test_context(key,id) select 'secret_object',id from created;
with created as (
  insert into public.scene_objects(scene_id,name,object_type,x,y,config,state,visible_to_players)
  values ((select id from roll30_test_context where key='scene'),'Visible door','door',70,0,'{"x2":70,"y2":100}','{"active":true}',true)
  returning id
)
insert into roll30_test_context(key,id) select 'door',id from created;
insert into public.scene_objects(scene_id,name,object_type,x,y,config,visible_to_players)
values ((select id from roll30_test_context where key='scene'),'Vision wall','wall',80,0,'{"x2":80,"y2":100}',false);
insert into public.scene_objects(scene_id,name,object_type,x,y,config,state,visible_to_players)
values ((select id from roll30_test_context where key='scene'),'Difficult ground','terrain',50,40,'{"x2":65,"y2":60,"movement_multiplier":2}','{"active":true}',false);

with created as (
  insert into public.scene_triggers(scene_id,name,trigger,effects,run_once)
  values ((select id from roll30_test_context where key='scene'),'Test Fog','{"delay_seconds":0}','[{"type":"show_fog"}]',true) returning id
)
insert into roll30_test_context(key,id) select 'trigger',id from created;

with created as (
  insert into public.scene_triggers(scene_id,name,trigger,effects,run_once)
  values (
    (select id from roll30_test_context where key='scene'),
    'Lever opens door and calls reinforcements',
    jsonb_build_object('event','object_activated','object_id',(select id from roll30_test_context where key='secret_object'),'delay_seconds',0),
    jsonb_build_array(
      jsonb_build_object('type','toggle_object','object_id',(select id from roll30_test_context where key='door')),
      jsonb_build_object('type','spawn_character','character_id',(select id from roll30_test_context where key='reinforcement'),'x',60,'y',60),
      jsonb_build_object('type','message','text','Reinforcements arrive!')
    ),
    true
  ) returning id
)
insert into roll30_test_context(key,id) select 'chain_trigger',id from created;

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

update public.scenes
set background_asset_id = (select id from roll30_test_context where key='private_asset')
where id = (select id from roll30_test_context where key='scene');
insert into public.scene_map_tiles(scene_id,asset_id,tile_column,tile_row,grid_columns,grid_rows,storage_path)
select
  (select id from roll30_test_context where key='scene'),
  (select id from roll30_test_context where key='private_asset'),
  tile_column,0,4,1,
  (select id::text from roll30_test_context where key='gm_campaign')||'/map-tiles/test/'||tile_column||'.webp'
from generate_series(0,3) tile_column;

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
-- Place the target behind the private test wall as GM setup. This is fixture
-- positioning, not a gameplay movement, so it intentionally bypasses the
-- movement RPC's wall-crossing rule.
update public.session_tokens set x = 75, y = 50
where id = (select id from roll30_test_context where key = 'target_token');
select public.configure_roll30_session_token(
  (select id from roll30_test_context where key='target_token'), 10, false
);
select public.add_roll30_initiative_entry(
  (select id from roll30_test_context where key = 'session'),
  (select id from roll30_test_context where key = 'hero_token'),
  18
);
select public.grant_roll30_item((select id from roll30_test_context where key='hero'),(select id from roll30_test_context where key='potion'),3);
select public.move_roll30_scene_object((select id from roll30_test_context where key='secret_object'),25,25,'gm',2);
select pg_temp.roll30_assert((select x=25 and layer='gm' from public.scene_objects where id=(select id from roll30_test_context where key='secret_object')),'GM scene-builder movement did not persist');
select public.execute_roll30_trigger((select id from roll30_test_context where key='trigger'),(select id from roll30_test_context where key='session'),'test-key');
select pg_temp.roll30_assert((select (state->>'fog')::boolean from public.sessions where id=(select id from roll30_test_context where key='session')),'automation effect did not update session state');
select pg_temp.roll30_expect_error(format('select public.execute_roll30_trigger(%L::uuid,%L::uuid,%L)',(select id from roll30_test_context where key='trigger'),(select id from roll30_test_context where key='session'),'test-key'),'Execution key already exists');
select public.activate_roll30_scene_object((select id from roll30_test_context where key='session'),(select id from roll30_test_context where key='secret_object'));
select pg_temp.roll30_assert(
  exists(select 1 from public.session_tokens where session_id=(select id from roll30_test_context where key='session') and character_id=(select id from roll30_test_context where key='reinforcement'))
  and (select not coalesce((state->>'active')::boolean,false) from public.scene_objects where id=(select id from roll30_test_context where key='door'))
  and (select count(*)=1 from public.automation_executions where trigger_id=(select id from roll30_test_context where key='chain_trigger') and status='completed'),
  'automatic object trigger chain did not toggle the door, spawn reinforcement, and log once'
);
select pg_temp.roll30_assert(
  (public.preview_roll30_last_undo((select id from roll30_test_context where key='session'))->>'event_type')='automation_chain_completed',
  'automation chain was not available for recovery preview'
);
select public.undo_roll30_last_action((select id from roll30_test_context where key='session'));
select pg_temp.roll30_assert(
  not exists(select 1 from public.session_tokens where session_id=(select id from roll30_test_context where key='session') and character_id=(select id from roll30_test_context where key='reinforcement'))
  and (select coalesce((state->>'active')::boolean,false) from public.scene_objects where id=(select id from roll30_test_context where key='door'))
  and (select not coalesce((state->>'active')::boolean,false) from public.scene_objects where id=(select id from roll30_test_context where key='secret_object')),
  'automation chain undo did not restore tokens and scene object states'
);
insert into roll30_test_context(key,id)
select 'check_request',id from public.send_roll30_message(
  (select id from roll30_test_context where key='gm_campaign'),'check_request','Make a Perception check',
  '30000000-0000-4000-a000-000000000102','1d20'
);
select public.set_roll30_manual_reveal((select id from roll30_test_context where key='session'),array['30000000-0000-4000-a000-000000000102'::uuid],'[[10,40],[20,40],[20,60],[10,60]]');
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
  (select (payload->>'movement_cost')::numeric=20 from public.session_events where event_type='token_moved' and payload->>'token_id'=(select id::text from roll30_test_context where key='hero_token') order by id desc limit 1),
  'map scale or difficult-terrain movement cost was not applied in feet'
);
select pg_temp.roll30_expect_error(
  format('select public.move_roll30_token(%L::uuid,%L,%L,%L)',
    (select id from roll30_test_context where key='session'),
    (select id::text from roll30_test_context where key='hero_token'), 68, 50),
  'Another token occupies that space'
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
select pg_temp.roll30_assert(
  (select jsonb_array_length(result->'current'->0)=72 and jsonb_array_length(result->'reveals')=1 from (select public.get_roll30_player_vision((select id from roll30_test_context where key='session')) result) vision)
  and (select max((point->>0)::numeric)<=70.001 from (select public.get_roll30_player_vision((select id from roll30_test_context where key='session')) result) vision cross join lateral jsonb_array_elements(vision.result->'current'->0) point),
  'server visibility polygon, closed-door occlusion, or manual reveal failed'
);
-- The visibility RPC persists exploration. Check it in the next statement so
-- PostgreSQL advances the command snapshot and exposes the completed upsert.
select pg_temp.roll30_assert(
  (select count(*)=1 from public.session_exploration where session_id=(select id from roll30_test_context where key='session') and user_id=auth.uid()),
  'explored fog was not persisted for the player'
);
select pg_temp.roll30_assert(
  (select jsonb_array_length(public.get_visible_roll30_tokens((select id from roll30_test_context where key='session')))) = 1,
  'a token behind a private wall leaked into the player visibility result'
);
select pg_temp.roll30_assert(
  (select jsonb_array_length(public.get_roll30_visible_map_tiles((select id from roll30_test_context where key='session')))) = 3,
  'secure map tiling did not grant exactly the current, explored, and manually revealed tiles'
);
select pg_temp.roll30_assert(
  (select count(*) from public.session_map_tile_access where session_id=(select id from roll30_test_context where key='session') and user_id=auth.uid()) = 3,
  'authorized map tile access was not persisted for private Storage enforcement'
);
select pg_temp.roll30_expect_error(
  format('select public.set_roll30_manual_reveal(%L::uuid,%L::uuid[],%L::jsonb)',
    (select id from roll30_test_context where key='session'), '{}', '[[0,0],[101,0],[0,1]]'),
  'Only the GM can reveal map regions'
);
select pg_temp.roll30_expect_error(
  format('select public.clear_roll30_exploration(%L::uuid,null)',
    (select id from roll30_test_context where key='session')),
  'Only the GM can clear explored fog'
);
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
select public.resolve_roll30_hp_change((select id from roll30_test_context where key='hero'),'healing','1');
select pg_temp.roll30_assert(
  (select hp_current=9 from public.characters where id=(select id from roll30_test_context where key='hero'))
  and exists(select 1 from public.session_events where session_id=(select id from roll30_test_context where key='session') and event_type='hp_changed' and payload->>'source'='dice'),
  'server-rolled healing or HP history did not persist'
);
select public.mutate_roll30_inventory((select id from roll30_test_context where key='hero'),(select id from roll30_test_context where key='potion'),'equip',1,null);
select public.mutate_roll30_inventory((select id from roll30_test_context where key='hero'),(select id from roll30_test_context where key='potion'),'transfer',1,(select id from roll30_test_context where key='target'));
select public.mutate_roll30_inventory((select id from roll30_test_context where key='hero'),(select id from roll30_test_context where key='potion'),'consume',1,null);
select pg_temp.roll30_assert(
  (select quantity=1 from public.character_inventory where character_id=(select id from roll30_test_context where key='hero') and item_id=(select id from roll30_test_context where key='potion'))
  and (select quantity=1 from public.character_inventory where character_id=(select id from roll30_test_context where key='target') and item_id=(select id from roll30_test_context where key='potion'))
  and (select hp_current=10 from public.characters where id=(select id from roll30_test_context where key='hero')),
  'equip, transfer, consume, or healing inventory behavior failed'
);
select public.request_roll30_purchase((select id from roll30_test_context where key='shop'),(select id from roll30_test_context where key='potion'),(select id from roll30_test_context where key='hero'),1);
select pg_temp.roll30_assert(
  (select sheet->'currency'->>'gp'='18' from public.characters where id=(select id from roll30_test_context where key='hero'))
  and (select quantity=2 from public.shop_stock where shop_id=(select id from roll30_test_context where key='shop') and item_id=(select id from roll30_test_context where key='potion')),
  'discounted automatic purchase did not charge or deplete stock atomically'
);
select pg_temp.roll30_expect_error(
  format('select public.change_roll30_hp(%L::uuid,-2)', (select id from roll30_test_context where key = 'target')),
  'Not permitted'
);
select public.submit_roll30_prompt_response((select id from roll30_test_context where key='prompt'),'{"text":"Ready"}');
select public.send_roll30_message((select id from roll30_test_context where key='gm_campaign'),'roll','Perception',null,'1d20+3');
select public.respond_roll30_check_request((select id from roll30_test_context where key='check_request'),'1d20+5');
select pg_temp.roll30_assert(
  exists(select 1 from public.messages where sender_id=auth.uid() and recipient_id='30000000-0000-4000-a000-000000000101' and body->>'reply_to'=(select id::text from roll30_test_context where key='check_request')),
  'player check-request response was not rolled and returned privately to the GM'
);
select pg_temp.roll30_expect_error(
  format('select public.respond_roll30_check_request(%L::uuid,%L)',(select id from roll30_test_context where key='check_request'),'1d20'),
  'already answered'
);
select pg_temp.roll30_expect_error(
  format('select public.send_roll30_message(%L::uuid,%L,%L,%L::uuid,null)',(select id from roll30_test_context where key='gm_campaign'),'whisper','Nope','30000000-0000-4000-a000-000000000103'),
  'Recipient is not in this campaign'
);
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
select public.set_roll30_prompt_status((select id from roll30_test_context where key='prompt'),'closed');
select pg_temp.roll30_assert((select status='closed' from public.prompts where id=(select id from roll30_test_context where key='prompt')),'GM could not close a prompt');
select public.mark_roll30_messages_read((select id from roll30_test_context where key='gm_campaign'));
select pg_temp.roll30_assert(
  (public.preview_roll30_last_undo((select id from roll30_test_context where key='session'))->>'event_type')='hp_changed',
  'HP change was not offered as the latest reversible action'
);
select public.undo_roll30_last_action((select id from roll30_test_context where key='session'));
select pg_temp.roll30_assert(
  (select hp_current=10 from public.characters where id=(select id from roll30_test_context where key='hero')),
  'HP undo did not restore the previous hit points'
);
select public.restore_roll30_snapshot((select id from roll30_test_context where key = 'snapshot'));
select pg_temp.roll30_assert(
  (select x = 50 from public.session_tokens where id = (select id from roll30_test_context where key = 'hero_token')),
  'snapshot restore did not restore normalized token position'
);
select public.advance_roll30_turn((select id from roll30_test_context where key='session'));
select pg_temp.roll30_assert((select round=2 from public.sessions where id=(select id from roll30_test_context where key='session')),'round did not advance or checkpoint');
select public.rewind_roll30_round((select id from roll30_test_context where key='session'));
select pg_temp.roll30_assert((select round=1 from public.sessions where id=(select id from roll30_test_context where key='session')),'round rewind did not restore session metadata');
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
select public.set_roll30_asset_audience(
  (select id from roll30_test_context where key = 'private_asset'),
  true,
  array['30000000-0000-4000-a000-000000000102'::uuid]
);
select pg_temp.roll30_expect_error(
  format('select public.set_roll30_asset_audience(%L::uuid,true,array[%L::uuid])',
    (select id from roll30_test_context where key = 'private_asset'),
    '30000000-0000-4000-a000-000000000103'),
  'non-player'
);
select public.set_roll30_shop_stock(
  (select id from roll30_test_context where key='shop'),
  (select id from roll30_test_context where key='potion'),
  9,7,true
);
select pg_temp.roll30_assert(
  (select price=9 and quantity=7 and hidden from public.shop_stock where shop_id=(select id from roll30_test_context where key='shop') and item_id=(select id from roll30_test_context where key='potion')),
  'GM shop stock editing did not persist'
);
select public.remove_roll30_shop_stock(
  (select id from roll30_test_context where key='shop'),
  (select id from roll30_test_context where key='potion')
);
select pg_temp.roll30_assert(
  not exists(select 1 from public.shop_stock where shop_id=(select id from roll30_test_context where key='shop') and item_id=(select id from roll30_test_context where key='potion')),
  'GM shop stock removal did not persist'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-a000-000000000102","role":"authenticated","email":"roll30-player-test@example.invalid"}', true);
select pg_temp.roll30_assert(
  (select count(*) from public.campaign_assets where id = (select id from roll30_test_context where key = 'private_asset')) = 1,
  'addressed campaign media was not visible to the selected player'
);
select pg_temp.roll30_expect_error(
  format('select public.set_roll30_shop_stock(%L::uuid,%L::uuid,1,1,false)',
    (select id from roll30_test_context where key='shop'),
    (select id from roll30_test_context where key='potion')),
  'Only a campaign GM'
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
  not has_table_privilege('authenticated', 'public.session_reveals', 'INSERT,UPDATE,DELETE'),
  'clients can bypass the checked manual-reveal RPC'
);
select pg_temp.roll30_assert(
  has_function_privilege('authenticated', 'public.create_roll30_campaign(text)', 'EXECUTE'),
  'authenticated role lost the onboarding RPC grant'
);

select extensions.pass('Roll30 GM/player/outsider integration paths passed');
select * from extensions.finish();
rollback;
