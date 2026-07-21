alter table public.scene_objects drop constraint scene_objects_object_type_check;
alter table public.scene_objects add constraint scene_objects_object_type_check
check (object_type in ('object','door','lever','trap','light','wall','terrain','token'));

create or replace function public.save_roll30_scene_token(
  target_scene uuid,
  target_character uuid,
  target_x integer,
  target_y integer,
  token_size_ft numeric default 5,
  token_hidden boolean default false,
  target_object uuid default null
)
returns public.scene_objects
language plpgsql security definer set search_path=public
as $$
declare scene_row public.scenes;character_row public.characters;result public.scene_objects;next_config jsonb;
begin
  select * into scene_row from public.scenes where id=target_scene and deleted_at is null;
  if scene_row.id is null or not public.is_campaign_gm(scene_row.campaign_id) then raise exception 'Only a campaign GM can prepare scene tokens';end if;
  select * into character_row from public.characters where id=target_character and campaign_id=scene_row.campaign_id;
  if character_row.id is null then raise exception 'Character is not in this campaign';end if;
  if target_x not between 2 and 98 or target_y not between 2 and 98 then raise exception 'Token coordinates must be between 2 and 98';end if;
  if token_size_ft not between 1 and 100 then raise exception 'Token size must be between 1 and 100 feet';end if;
  next_config:=jsonb_build_object('character_id',character_row.id,'size_ft',token_size_ft,'hidden',coalesce(token_hidden,false));
  if target_object is null then
    if exists(select 1 from public.scene_objects where scene_id=target_scene and object_type='token' and config->>'character_id'=character_row.id::text) then raise exception 'This character is already prepared in the scene';end if;
    insert into public.scene_objects(scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players)
    values(target_scene,character_row.name,'token',target_x,target_y,'{}'::jsonb,next_config,'tokens',0,false) returning * into result;
  else
    select * into result from public.scene_objects where id=target_object and scene_id=target_scene and object_type='token';
    if result.id is null then raise exception 'Prepared token not found';end if;
    if exists(select 1 from public.scene_objects where scene_id=target_scene and object_type='token' and id<>result.id and config->>'character_id'=character_row.id::text) then raise exception 'This character is already prepared in the scene';end if;
    update public.scene_objects set name=character_row.name,x=target_x,y=target_y,config=next_config,layer='tokens',visible_to_players=false where id=result.id returning * into result;
  end if;
  return result;
end;
$$;

create or replace function public.start_roll30_session(target_campaign uuid,target_scene uuid)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare scene_row public.scenes;result public.sessions;initial_state jsonb;prepared_count integer;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'Only a GM can start a session';end if;
  if exists(select 1 from public.sessions where campaign_id=target_campaign and status='active') then raise exception 'This campaign already has an active session';end if;
  select * into scene_row from public.scenes where id=target_scene and campaign_id=target_campaign and deleted_at is null;
  if scene_row.id is null then raise exception 'Scene not found';end if;
  initial_state:=jsonb_build_object('fog',false,'initiative','[]'::jsonb,'movement','{}'::jsonb,'presentation',jsonb_strip_nulls(jsonb_build_object(
    'time_of_day',coalesce(scene_row.config->>'time_of_day','day'),'weather',coalesce(scene_row.config->>'weather','clear'),
    'ambient_asset_id',scene_row.config->>'ambient_asset_id','ambient_playing',false
  )));
  insert into public.sessions(campaign_id,scene_id,state) values(target_campaign,target_scene,initial_state) returning * into result;
  insert into public.session_tokens(session_id,character_id,name,x,y,speed,size_ft,hidden)
  select result.id,character_row.id,character_row.name,object_row.x,object_row.y,coalesce((character_row.sheet->>'speed')::numeric,30),coalesce((object_row.config->>'size_ft')::numeric,5),coalesce((object_row.config->>'hidden')::boolean,false)
  from public.scene_objects object_row join public.characters character_row on character_row.id=(object_row.config->>'character_id')::uuid
  where object_row.scene_id=target_scene and object_row.object_type='token' and character_row.campaign_id=target_campaign;
  get diagnostics prepared_count=row_count;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'session_started',jsonb_build_object('scene_id',target_scene,'session_code',result.session_code,'prepared_tokens',prepared_count));
  return result;
end;
$$;

create or replace function public.change_roll30_session_scene(target_session uuid,target_scene uuid)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare result public.sessions;scene_row public.scenes;next_state jsonb;previous_scene uuid;next_initiative jsonb;prepared_count integer;
begin
  select * into result from public.sessions where id=target_session for update;
  if result.id is null or result.status<>'active' or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only a GM can change the active scene';end if;
  select * into scene_row from public.scenes where id=target_scene and campaign_id=result.campaign_id and deleted_at is null;
  if scene_row.id is null then raise exception 'Scene not found';end if;
  previous_scene:=result.scene_id;
  perform private.create_roll30_session_snapshot(result.id,'Before scene change',auth.uid());
  delete from public.session_tokens token_row using public.characters character_row where token_row.session_id=result.id and character_row.id=token_row.character_id and character_row.kind<>'pc';
  insert into public.session_tokens(session_id,character_id,name,x,y,speed,size_ft,hidden)
  select result.id,character_row.id,character_row.name,object_row.x,object_row.y,coalesce((character_row.sheet->>'speed')::numeric,30),coalesce((object_row.config->>'size_ft')::numeric,5),coalesce((object_row.config->>'hidden')::boolean,false)
  from public.scene_objects object_row join public.characters character_row on character_row.id=(object_row.config->>'character_id')::uuid
  where object_row.scene_id=target_scene and object_row.object_type='token' and character_row.campaign_id=result.campaign_id
  on conflict(session_id,character_id) do update set name=excluded.name,x=excluded.x,y=excluded.y,speed=excluded.speed,size_ft=excluded.size_ft,hidden=excluded.hidden;
  get diagnostics prepared_count=row_count;
  select coalesce(jsonb_agg(entry),'[]'::jsonb) into next_initiative
  from jsonb_array_elements(coalesce(result.state->'initiative','[]'::jsonb)) entry
  where exists(select 1 from public.session_tokens token_row where token_row.session_id=result.id and token_row.id=(entry->>'token_id')::uuid);
  next_state:=jsonb_set(coalesce(result.state,'{}'::jsonb)-'presentation_dialog','{movement}','{}'::jsonb,true);
  next_state:=jsonb_set(next_state,'{initiative}',next_initiative,true);
  next_state:=jsonb_set(next_state,'{presentation}',jsonb_strip_nulls(jsonb_build_object(
    'time_of_day',coalesce(scene_row.config->>'time_of_day','day'),'weather',coalesce(scene_row.config->>'weather','clear'),
    'ambient_asset_id',scene_row.config->>'ambient_asset_id','ambient_playing',false
  )),true);
  delete from public.session_exploration where session_id=target_session;
  delete from public.session_reveals where session_id=target_session;
  delete from public.session_map_tile_access where session_id=target_session;
  update public.sessions set scene_id=target_scene,state=next_state,active_turn=0,updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'scene_changed',jsonb_build_object('from_scene_id',previous_scene,'scene_id',target_scene,'prepared_tokens',prepared_count));
  return result;
end;
$$;

revoke all on function public.save_roll30_scene_token(uuid,uuid,integer,integer,numeric,boolean,uuid) from public,anon;
grant execute on function public.save_roll30_scene_token(uuid,uuid,integer,integer,numeric,boolean,uuid) to authenticated;
