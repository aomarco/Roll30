alter table public.session_tokens
  add column presentation jsonb not null default '{}'::jsonb;

create table public.scene_states (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  scene_config jsonb not null default '{}'::jsonb,
  objects jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index scene_states_scene_id_idx on public.scene_states(scene_id);
alter table public.scene_states enable row level security;
grant select,insert,update,delete on public.scene_states to authenticated;

alter table public.scene_templates
  add column scene_states jsonb not null default '[]'::jsonb;

create policy "campaign members read scene states"
on public.scene_states for select to authenticated
using (exists (
  select 1 from public.scenes scene_row
  where scene_row.id=scene_id and public.is_campaign_member(scene_row.campaign_id)
));

create policy "gms create scene states"
on public.scene_states for insert to authenticated
with check (exists (
  select 1 from public.scenes scene_row
  where scene_row.id=scene_id and public.is_campaign_gm(scene_row.campaign_id)
));

create policy "gms update scene states"
on public.scene_states for update to authenticated
using (exists (
  select 1 from public.scenes scene_row
  where scene_row.id=scene_id and public.is_campaign_gm(scene_row.campaign_id)
))
with check (exists (
  select 1 from public.scenes scene_row
  where scene_row.id=scene_id and public.is_campaign_gm(scene_row.campaign_id)
));

create policy "gms delete scene states"
on public.scene_states for delete to authenticated
using (exists (
  select 1 from public.scenes scene_row
  where scene_row.id=scene_id and public.is_campaign_gm(scene_row.campaign_id)
));

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='scene_states'
  ) then
    alter publication supabase_realtime add table public.scene_states;
  end if;
end;
$$;

create or replace function public.configure_roll30_token_presentation(
  target_token uuid,
  portrait_asset uuid default null,
  expression_name text default null,
  pose_name text default null,
  token_highlighted boolean default false
)
returns public.session_tokens
language plpgsql security definer set search_path=public
as $$
declare result public.session_tokens; campaign_key uuid;
begin
  select token.* into result
  from public.session_tokens token
  join public.sessions session_row on session_row.id=token.session_id
  where token.id=target_token and public.is_campaign_gm(session_row.campaign_id)
  for update of token;
  if result.id is null then raise exception 'Token not found'; end if;
  select campaign_id into campaign_key from public.sessions where id=result.session_id;
  if portrait_asset is not null and not exists(
    select 1 from public.campaign_assets
    where id=portrait_asset and campaign_id=campaign_key and kind in ('image','portrait')
  ) then raise exception 'Portrait is not an image from this campaign'; end if;
  if portrait_asset is not null then
    update public.campaign_assets set visible_to_players=true where id=portrait_asset;
  end if;
  if length(coalesce(expression_name,''))>80 or length(coalesce(pose_name,''))>80 then
    raise exception 'Expression and pose labels must be 80 characters or less';
  end if;
  update public.session_tokens set presentation=jsonb_strip_nulls(jsonb_build_object(
    'portrait_asset_id',portrait_asset,
    'expression',nullif(trim(expression_name),''),
    'pose',nullif(trim(pose_name),''),
    'highlighted',coalesce(token_highlighted,false)
  )) where id=result.id returning * into result;
  update public.sessions set updated_at=now() where id=result.session_id;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(result.session_id,auth.uid(),'token_presentation_changed',jsonb_build_object(
    'token_id',result.id,'character_id',result.character_id,'presentation',result.presentation
  ));
  return result;
end;
$$;

create or replace function public.set_roll30_session_presentation(
  target_session uuid,
  time_of_day text,
  weather_name text,
  ambient_asset uuid default null,
  ambient_playing boolean default false
)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare result public.sessions; next_presentation jsonb;
begin
  select * into result from public.sessions where id=target_session for update;
  if result.id is null or not public.is_campaign_gm(result.campaign_id) then
    raise exception 'Only the GM can change table presentation';
  end if;
  if time_of_day not in ('dawn','day','dusk','night') then raise exception 'Unsupported time of day'; end if;
  if weather_name not in ('clear','rain','fog','storm','snow') then raise exception 'Unsupported weather'; end if;
  if ambient_asset is not null and not exists(
    select 1 from public.campaign_assets
    where id=ambient_asset and campaign_id=result.campaign_id and kind='audio'
  ) then raise exception 'Ambient track is not audio from this campaign'; end if;
  next_presentation:=jsonb_strip_nulls(jsonb_build_object(
    'time_of_day',time_of_day,
    'weather',weather_name,
    'ambient_asset_id',ambient_asset,
    'ambient_playing',coalesce(ambient_playing,false) and ambient_asset is not null,
    'ambient_started_at',case when coalesce(ambient_playing,false) and ambient_asset is not null then now() else null end
  ));
  update public.sessions
  set state=jsonb_set(coalesce(state,'{}'::jsonb),'{presentation}',next_presentation,true),updated_at=now()
  where id=result.id returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(result.id,auth.uid(),'table_presentation_changed',next_presentation);
  return result;
end;
$$;

create or replace function public.start_roll30_session(target_campaign uuid,target_scene uuid)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare scene_row public.scenes;result public.sessions;initial_state jsonb;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'Only a GM can start a session';end if;
  if exists(select 1 from public.sessions where campaign_id=target_campaign and status='active') then raise exception 'This campaign already has an active session';end if;
  select * into scene_row from public.scenes where id=target_scene and campaign_id=target_campaign and deleted_at is null;
  if scene_row.id is null then raise exception 'Scene not found';end if;
  initial_state:=jsonb_build_object('fog',false,'initiative','[]'::jsonb,'movement','{}'::jsonb,'presentation',jsonb_strip_nulls(jsonb_build_object(
    'time_of_day',coalesce(scene_row.config->>'time_of_day','day'),
    'weather',coalesce(scene_row.config->>'weather','clear'),
    'ambient_asset_id',scene_row.config->>'ambient_asset_id',
    'ambient_playing',false
  )));
  insert into public.sessions(campaign_id,scene_id,state) values(target_campaign,target_scene,initial_state) returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'session_started',jsonb_build_object('scene_id',target_scene,'session_code',result.session_code));
  return result;
end;
$$;

create or replace function public.change_roll30_session_scene(target_session uuid,target_scene uuid)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare result public.sessions;scene_row public.scenes;next_state jsonb;previous_scene uuid;
begin
  select * into result from public.sessions where id=target_session for update;
  if result.id is null or result.status<>'active' or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only a GM can change the active scene';end if;
  select * into scene_row from public.scenes where id=target_scene and campaign_id=result.campaign_id and deleted_at is null;
  if scene_row.id is null then raise exception 'Scene not found';end if;
  previous_scene:=result.scene_id;
  next_state:=jsonb_set(coalesce(result.state,'{}'::jsonb),'{movement}','{}'::jsonb,true);
  next_state:=jsonb_set(next_state,'{presentation}',jsonb_strip_nulls(jsonb_build_object(
    'time_of_day',coalesce(scene_row.config->>'time_of_day','day'),
    'weather',coalesce(scene_row.config->>'weather','clear'),
    'ambient_asset_id',scene_row.config->>'ambient_asset_id',
    'ambient_playing',false
  )),true);
  delete from public.session_exploration where session_id=target_session;
  delete from public.session_reveals where session_id=target_session;
  delete from public.session_map_tile_access where session_id=target_session;
  update public.sessions set scene_id=target_scene,state=next_state,updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'scene_changed',jsonb_build_object('from_scene_id',previous_scene,'scene_id',target_scene));
  return result;
end;
$$;

drop policy if exists "members read revealed or safe live campaign assets" on public.campaign_assets;
create policy "members read revealed or safe live campaign assets"
on public.campaign_assets for select to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and (
      visible_to_players
      or exists (
        select 1 from public.scenes scene
        join public.sessions session_row on session_row.scene_id=scene.id and session_row.status='active'
        where scene.background_asset_id=campaign_assets.id
          and session_row.campaign_id=campaign_assets.campaign_id
          and coalesce((session_row.state->>'fog')::boolean,false)=false
          and coalesce(scene.config->>'ambient_light','bright')='bright'
      )
      or exists (
        select 1 from public.sessions session_row
        where session_row.campaign_id=campaign_assets.campaign_id and session_row.status='active'
          and session_row.state->'presentation'->>'ambient_asset_id'=campaign_assets.id::text
          and coalesce((session_row.state->'presentation'->>'ambient_playing')::boolean,false)
      )
    )
  )
);

drop policy if exists "members read revealed assets or authorized map tiles" on storage.objects;
create policy "members read revealed assets or authorized map tiles"
on storage.objects for select to authenticated
using (
  bucket_id='campaign-media'
  and (
    exists (
      select 1 from public.campaign_assets asset
      where asset.storage_path=name
        and (
          asset.visible_to_players
          or public.is_campaign_gm(asset.campaign_id)
          or exists (
            select 1 from public.scenes scene
            join public.sessions session_row on session_row.scene_id=scene.id and session_row.status='active'
            where scene.background_asset_id=asset.id and session_row.campaign_id=asset.campaign_id
              and public.is_campaign_member(asset.campaign_id)
              and coalesce((session_row.state->>'fog')::boolean,false)=false
              and coalesce(scene.config->>'ambient_light','bright')='bright'
          )
          or exists (
            select 1 from public.sessions session_row
            where session_row.campaign_id=asset.campaign_id and session_row.status='active'
              and public.is_campaign_member(asset.campaign_id)
              and session_row.state->'presentation'->>'ambient_asset_id'=asset.id::text
              and coalesce((session_row.state->'presentation'->>'ambient_playing')::boolean,false)
          )
        )
    )
    or exists (
      select 1 from public.scene_map_tiles tile
      join public.scenes scene on scene.id=tile.scene_id
      where tile.storage_path=name
        and (
          public.is_campaign_gm(scene.campaign_id)
          or exists (
            select 1 from public.session_map_tile_access access_row
            where access_row.tile_id=tile.id and access_row.user_id=(select auth.uid())
          )
        )
    )
  )
);

create or replace function public.save_roll30_scene_state(target_scene uuid,state_name text)
returns public.scene_states
language plpgsql security definer set search_path=public
as $$
declare scene_row public.scenes; object_data jsonb; result public.scene_states;
begin
  select * into scene_row from public.scenes where id=target_scene and deleted_at is null;
  if scene_row.id is null or not public.is_campaign_gm(scene_row.campaign_id) then
    raise exception 'Only the GM can save scene states';
  end if;
  if length(trim(state_name)) not between 1 and 120 then raise exception 'Scene state name is required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'object_type',object_type,'x',x,'y',y,'state',state,'config',config,
    'layer',layer,'z_index',z_index,'visible_to_players',visible_to_players
  ) order by z_index,created_at,id),'[]'::jsonb)
  into object_data from public.scene_objects where scene_id=target_scene;
  insert into public.scene_states(scene_id,name,scene_config,objects,created_by)
  values(target_scene,trim(state_name),scene_row.config,object_data,auth.uid()) returning * into result;
  return result;
end;
$$;

create or replace function public.duplicate_roll30_scene(source_scene uuid)
returns public.scenes
language plpgsql security definer set search_path=public
as $$
declare source public.scenes;created public.scenes;source_object public.scene_objects;created_object public.scene_objects;saved_state public.scene_states;object_map jsonb:='{}'::jsonb;remapped_objects jsonb;
begin
  select * into source from public.scenes where id=source_scene and deleted_at is null;
  if source.id is null then raise exception 'Scene not found';end if;
  if not public.is_campaign_gm(source.campaign_id) then raise exception 'Only the GM can duplicate scenes';end if;
  insert into public.scenes(campaign_id,name,scene_type,folder,background_asset_id,config,created_by)
  values(source.campaign_id,source.name||' copy',source.scene_type,source.folder,source.background_asset_id,source.config,auth.uid()) returning * into created;
  for source_object in select * from public.scene_objects where scene_id=source.id order by z_index,created_at,id loop
    insert into public.scene_objects(scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players)
    values(created.id,source_object.name,source_object.object_type,source_object.x,source_object.y,source_object.state,source_object.config,source_object.layer,source_object.z_index,source_object.visible_to_players)
    returning * into created_object;
    object_map:=object_map||jsonb_build_object(source_object.id::text,created_object.id::text);
  end loop;
  for saved_state in select * from public.scene_states where scene_id=source.id order by created_at,id loop
    select coalesce(jsonb_agg(jsonb_set(item,'{id}',to_jsonb(object_map->>(item->>'id')),true)),'[]'::jsonb)
    into remapped_objects from jsonb_array_elements(saved_state.objects) item where object_map?(item->>'id');
    insert into public.scene_states(scene_id,name,scene_config,objects,created_by)
    values(created.id,saved_state.name,saved_state.scene_config,remapped_objects,auth.uid());
  end loop;
  return created;
end;
$$;

create or replace function public.save_roll30_scene_template(source_scene uuid,template_name text)
returns public.scene_templates
language plpgsql security definer set search_path=public
as $$
declare source public.scenes;result public.scene_templates;object_data jsonb;state_data jsonb;
begin
  select * into source from public.scenes where id=source_scene and deleted_at is null;
  if source.id is null or not public.is_campaign_gm(source.campaign_id) then raise exception 'Only the GM can save scene templates';end if;
  if length(trim(template_name)) not between 1 and 160 then raise exception 'Template name is required';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'object_type',object_type,'x',x,'y',y,'state',state,'config',config,'layer',layer,'z_index',z_index,'visible_to_players',visible_to_players) order by z_index,created_at,id),'[]'::jsonb)
  into object_data from public.scene_objects where scene_id=source.id;
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'scene_config',scene_config,'objects',objects) order by created_at,id),'[]'::jsonb)
  into state_data from public.scene_states where scene_id=source.id;
  insert into public.scene_templates(campaign_id,name,scene_type,background_asset_id,config,objects,scene_states,created_by)
  values(source.campaign_id,trim(template_name),source.scene_type,source.background_asset_id,source.config,object_data,state_data,auth.uid()) returning * into result;
  return result;
end;
$$;

create or replace function public.create_roll30_scene_from_template(template_id uuid,scene_name text)
returns public.scenes
language plpgsql security definer set search_path=public
as $$
declare template public.scene_templates;result public.scenes;source_object jsonb;created_object public.scene_objects;saved_state jsonb;object_map jsonb:='{}'::jsonb;remapped_objects jsonb;
begin
  select * into template from public.scene_templates where id=template_id;
  if template.id is null or not public.is_campaign_gm(template.campaign_id) then raise exception 'Only the GM can use scene templates';end if;
  if length(trim(scene_name)) not between 1 and 160 then raise exception 'Scene name is required';end if;
  insert into public.scenes(campaign_id,name,scene_type,background_asset_id,config,created_by)
  values(template.campaign_id,trim(scene_name),template.scene_type,template.background_asset_id,template.config,auth.uid()) returning * into result;
  for source_object in select value from jsonb_array_elements(template.objects) loop
    insert into public.scene_objects(scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players)
    values(result.id,source_object->>'name',source_object->>'object_type',(source_object->>'x')::integer,(source_object->>'y')::integer,coalesce(source_object->'state','{}'::jsonb),coalesce(source_object->'config','{}'::jsonb),coalesce(source_object->>'layer','objects'),coalesce((source_object->>'z_index')::integer,0),coalesce((source_object->>'visible_to_players')::boolean,false))
    returning * into created_object;
    if source_object?'id' then object_map:=object_map||jsonb_build_object(source_object->>'id',created_object.id::text);end if;
  end loop;
  for saved_state in select value from jsonb_array_elements(template.scene_states) loop
    select coalesce(jsonb_agg(jsonb_set(item,'{id}',to_jsonb(object_map->>(item->>'id')),true)),'[]'::jsonb)
    into remapped_objects from jsonb_array_elements(coalesce(saved_state->'objects','[]'::jsonb)) item where object_map?(item->>'id');
    insert into public.scene_states(scene_id,name,scene_config,objects,created_by)
    values(result.id,saved_state->>'name',coalesce(saved_state->'scene_config','{}'::jsonb),remapped_objects,auth.uid());
  end loop;
  return result;
end;
$$;

create or replace function public.apply_roll30_scene_state(target_session uuid,target_state uuid)
returns public.scene_states
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions; state_row public.scene_states; before_snapshot public.session_snapshots;
begin
  select * into session_row from public.sessions where id=target_session and status='active' for update;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then
    raise exception 'Only the GM can apply scene states';
  end if;
  select saved.* into state_row from public.scene_states saved
  join public.scenes scene_row on scene_row.id=saved.scene_id
  where saved.id=target_state and saved.scene_id=session_row.scene_id and scene_row.campaign_id=session_row.campaign_id;
  if state_row.id is null then raise exception 'Scene state is not for the active scene'; end if;
  before_snapshot:=public.snapshot_roll30_session(target_session,'Before scene state: '||state_row.name);
  update public.scenes set config=state_row.scene_config,updated_at=now() where id=state_row.scene_id;
  delete from public.scene_objects current_object
  where current_object.scene_id=state_row.scene_id
    and not exists(select 1 from jsonb_array_elements(state_row.objects) item where (item->>'id')::uuid=current_object.id);
  insert into public.scene_objects(id,scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players)
  select item.id,state_row.scene_id,item.name,item.object_type,item.x,item.y,
    coalesce(item.state,'{}'::jsonb),coalesce(item.config,'{}'::jsonb),coalesce(item.layer,'objects'),
    coalesce(item.z_index,0),coalesce(item.visible_to_players,false)
  from jsonb_to_recordset(state_row.objects) as item(
    id uuid,name text,object_type text,x integer,y integer,state jsonb,config jsonb,
    layer text,z_index integer,visible_to_players boolean
  )
  on conflict(id) do update set
    name=excluded.name,object_type=excluded.object_type,x=excluded.x,y=excluded.y,state=excluded.state,
    config=excluded.config,layer=excluded.layer,z_index=excluded.z_index,visible_to_players=excluded.visible_to_players;
  update public.sessions set updated_at=now() where id=session_row.id;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(session_row.id,auth.uid(),'scene_state_applied',jsonb_build_object(
    'scene_state_id',state_row.id,'name',state_row.name,'snapshot_id',before_snapshot.id
  ));
  return state_row;
end;
$$;

create or replace function public.get_visible_roll30_tokens(target_session uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions;own_character_id uuid;own_token_id uuid;candidate public.session_tokens;vision jsonb;polygon jsonb;result jsonb:='[]'::jsonb;visible boolean;
begin
  select * into session_row from public.sessions where id=target_session;
  if session_row.id is null or not public.is_campaign_member(session_row.campaign_id) then raise exception 'Not permitted';end if;
  if public.is_campaign_gm(session_row.campaign_id) then
    select coalesce(jsonb_agg(jsonb_build_object('id',token.id,'character_id',token.character_id,'name',token.name,'x',token.x,'y',token.y,'speed',token.speed,'size_ft',token.size_ft,'hidden',token.hidden,'presentation',token.presentation) order by token.created_at,token.id),'[]'::jsonb)
    into result from public.session_tokens token where token.session_id=session_row.id;return result;
  end if;
  select character_id into own_character_id from public.campaign_members where campaign_id=session_row.campaign_id and user_id=auth.uid();
  select id into own_token_id from public.session_tokens where session_id=session_row.id and character_id=own_character_id;
  if coalesce((session_row.state->>'fog')::boolean,false)=false and coalesce((select config->>'ambient_light' from public.scenes where id=session_row.scene_id),'bright')='bright' then
    select coalesce(jsonb_agg(jsonb_build_object('id',token.id,'character_id',token.character_id,'name',token.name,'x',token.x,'y',token.y,'speed',token.speed,'size_ft',token.size_ft,'presentation',token.presentation) order by token.created_at,token.id),'[]'::jsonb)
    into result from public.session_tokens token where token.session_id=session_row.id and (not token.hidden or token.id=own_token_id);return result;
  end if;
  vision:=public.get_roll30_player_vision(target_session);
  for candidate in select * from public.session_tokens where session_id=session_row.id loop
    visible:=candidate.id=own_token_id;
    if not visible and not candidate.hidden then
      for polygon in select value from jsonb_array_elements(coalesce(vision->'current','[]'::jsonb)||coalesce(vision->'reveals','[]'::jsonb)) loop
        if private.roll30_point_in_polygon(candidate.x,candidate.y,polygon) then visible:=true;exit;end if;
      end loop;
    end if;
    if visible then result:=result||jsonb_build_array(jsonb_build_object('id',candidate.id,'character_id',candidate.character_id,'name',candidate.name,'x',candidate.x,'y',candidate.y,'speed',candidate.speed,'size_ft',candidate.size_ft,'presentation',candidate.presentation));end if;
  end loop;
  return result;
end;
$$;

create or replace function public.snapshot_roll30_session(target_session uuid,snapshot_label text default null)
returns public.session_snapshots
language plpgsql security definer set search_path=public
as $$
declare current_session public.sessions;token_state jsonb;object_state jsonb;snapshot_state jsonb;result public.session_snapshots;
begin
  select * into current_session from public.sessions where id=target_session for update;
  if current_session.id is null or not public.is_campaign_gm(current_session.campaign_id) then raise exception 'Only the GM can save a snapshot';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'character_id',character_id,'name',name,'x',x,'y',y,'speed',speed,'size_ft',size_ft,'hidden',hidden,'presentation',presentation) order by created_at,id),'[]'::jsonb) into token_state from public.session_tokens where session_id=target_session;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'object_type',object_type,'x',x,'y',y,'state',state,'config',config,'layer',layer,'z_index',z_index,'visible_to_players',visible_to_players) order by z_index,created_at,id),'[]'::jsonb) into object_state from public.scene_objects where scene_id=current_session.scene_id;
  snapshot_state:=jsonb_set(coalesce(current_session.state,'{}'::jsonb),'{tokens}',token_state,true);
  snapshot_state:=jsonb_set(snapshot_state,'{scene_objects}',object_state,true);
  insert into public.session_snapshots(session_id,created_by,label,state,session_round,session_active_turn,scene_id)
  values(target_session,auth.uid(),coalesce(nullif(trim(snapshot_label),''),'Snapshot'),snapshot_state,current_session.round,current_session.active_turn,current_session.scene_id) returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,auth.uid(),'snapshot_saved',jsonb_build_object('snapshot_id',result.id,'label',result.label));
  return result;
end;
$$;

create or replace function public.restore_roll30_snapshot(target_snapshot uuid)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare snapshot_row public.session_snapshots;result public.sessions;restored_state jsonb;
begin
  select * into snapshot_row from public.session_snapshots where id=target_snapshot;
  select * into result from public.sessions where id=snapshot_row.session_id for update;
  if snapshot_row.id is null or result.id is null or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only the GM can restore a snapshot';end if;
  delete from public.session_tokens where session_id=result.id;
  insert into public.session_tokens(id,session_id,character_id,name,x,y,speed,size_ft,hidden,presentation)
  select case when token?'id' then (token->>'id')::uuid else gen_random_uuid() end,result.id,character.id,coalesce(nullif(token->>'name',''),character.name),greatest(2,least(98,coalesce((token->>'x')::integer,50))),greatest(2,least(98,coalesce((token->>'y')::integer,50))),greatest(1,coalesce((token->>'speed')::numeric,(character.sheet->>'speed')::numeric,30)),greatest(1,least(100,coalesce((token->>'size_ft')::numeric,5))),coalesce((token->>'hidden')::boolean,false),coalesce(token->'presentation','{}'::jsonb)
  from jsonb_array_elements(coalesce(snapshot_row.state->'tokens','[]'::jsonb)) token join public.characters character on character.id=(token->>'character_id')::uuid and character.campaign_id=result.campaign_id;
  delete from public.scene_objects current_object where current_object.scene_id=snapshot_row.scene_id and not exists(select 1 from jsonb_array_elements(coalesce(snapshot_row.state->'scene_objects','[]'::jsonb)) item where (item->>'id')::uuid=current_object.id);
  insert into public.scene_objects(id,scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players)
  select item.id,snapshot_row.scene_id,item.name,item.object_type,item.x,item.y,coalesce(item.state,'{}'::jsonb),coalesce(item.config,'{}'::jsonb),coalesce(item.layer,'objects'),coalesce(item.z_index,0),coalesce(item.visible_to_players,false)
  from jsonb_to_recordset(coalesce(snapshot_row.state->'scene_objects','[]'::jsonb)) as item(id uuid,name text,object_type text,x integer,y integer,state jsonb,config jsonb,layer text,z_index integer,visible_to_players boolean)
  on conflict(id) do update set name=excluded.name,object_type=excluded.object_type,x=excluded.x,y=excluded.y,state=excluded.state,config=excluded.config,layer=excluded.layer,z_index=excluded.z_index,visible_to_players=excluded.visible_to_players;
  restored_state:=coalesce(snapshot_row.state,'{}'::jsonb)-'tokens'-'scene_objects';
  update public.sessions set state=restored_state,round=coalesce(snapshot_row.session_round,round),active_turn=coalesce(snapshot_row.session_active_turn,active_turn),scene_id=coalesce(snapshot_row.scene_id,scene_id),updated_at=now() where id=result.id returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'snapshot_restored',jsonb_build_object('snapshot_id',snapshot_row.id,'label',snapshot_row.label));
  return result;
end;
$$;

create or replace function public.preview_roll30_last_undo(target_session uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare session_row public.sessions;event_row public.session_events;
begin
  select * into session_row from public.sessions where id=target_session;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can preview undo';end if;
  select event_item.* into event_row from public.session_events event_item where event_item.session_id=target_session and event_item.event_type in ('automation_chain_completed','scene_state_applied','token_moved','object_toggled','hp_changed','combat_attack') and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id) order by event_item.created_at desc,event_item.id desc limit 1;
  if event_row.id is null then return jsonb_build_object('available',false);end if;
  return jsonb_build_object('available',true,'event_id',event_row.id,'event_type',event_row.event_type,'created_at',event_row.created_at,'name',coalesce(event_row.payload->>'name',event_row.event_type),'summary',case event_row.event_type when 'automation_chain_completed' then 'Restore the table to before this automation chain' when 'scene_state_applied' then 'Restore the table to before this scene state' when 'token_moved' then 'Move the token back to its previous position' when 'hp_changed' then 'Restore the previous hit points' when 'combat_attack' then 'Undo this attack and restore its target' else 'Restore the object to its previous state' end);
end;
$$;

create or replace function public.undo_roll30_last_action(target_session uuid)
returns public.session_events
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions;event_row public.session_events;undo_event public.session_events;token_key text;move_state jsonb;spent numeric;character_key text;character_row public.characters;restored_sheet jsonb;
begin
  select * into session_row from public.sessions where id=target_session for update;if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can undo table actions';end if;
  select event_item.* into event_row from public.session_events event_item where event_item.session_id=target_session and event_item.event_type in ('automation_chain_completed','scene_state_applied','token_moved','object_toggled','hp_changed','combat_attack') and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id) order by event_item.created_at desc,event_item.id desc limit 1 for update;
  if event_row.id is null then raise exception 'There is no reversible action to undo';end if;
  if event_row.event_type in ('automation_chain_completed','scene_state_applied') then perform public.restore_roll30_snapshot((event_row.payload->>'snapshot_id')::uuid);
  elsif event_row.event_type='token_moved' then update public.session_tokens set x=(event_row.payload->>'from_x')::integer,y=(event_row.payload->>'from_y')::integer where id=(event_row.payload->>'token_id')::uuid and session_id=target_session;token_key:=event_row.payload->>'token_id';move_state:=coalesce(session_row.state->'movement','{}'::jsonb);spent:=greatest(0,coalesce((move_state->token_key->>'spent')::numeric,0)-coalesce((event_row.payload->>'movement_cost')::numeric,0));if move_state?token_key then move_state:=jsonb_set(move_state,array[token_key,'spent'],to_jsonb(spent),false);end if;update public.sessions set state=jsonb_set(state,'{movement}',move_state,true),updated_at=now() where id=target_session;
  elsif event_row.event_type in ('hp_changed','combat_attack') then character_key:=case when event_row.event_type='combat_attack' then 'target_id' else 'character_id' end;select * into character_row from public.characters where id=(event_row.payload->>character_key)::uuid and campaign_id=session_row.campaign_id for update;restored_sheet:=character_row.sheet;if event_row.payload?'from_temp_hp' then restored_sheet:=jsonb_set(restored_sheet,'{temp_hp}',to_jsonb((event_row.payload->>'from_temp_hp')::integer),true);end if;if event_row.event_type='combat_attack' and event_row.payload->>'concentration' is not null then restored_sheet:=jsonb_set(restored_sheet,'{concentration}',to_jsonb(event_row.payload->>'concentration'),true);end if;update public.characters set hp_current=(event_row.payload->>'from_hp')::integer,sheet=restored_sheet,sheet_revision=sheet_revision+case when restored_sheet is distinct from character_row.sheet then 1 else 0 end,updated_at=now() where id=character_row.id;update public.sessions set updated_at=now() where id=target_session;
  else update public.scene_objects set state=jsonb_set(coalesce(state,'{}'::jsonb),'{active}',to_jsonb(coalesce((event_row.payload->>'from_active')::boolean,false)),true) where id=(event_row.payload->>'object_id')::uuid and scene_id=session_row.scene_id;update public.sessions set updated_at=now() where id=target_session;end if;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,auth.uid(),'action_undone',jsonb_build_object('original_event_id',event_row.id,'original_type',event_row.event_type)) returning * into undo_event;insert into public.session_event_undos(original_event_id,undo_event_id,undone_by) values(event_row.id,undo_event.id,auth.uid());return undo_event;
end;
$$;

revoke all on function public.configure_roll30_token_presentation(uuid,uuid,text,text,boolean) from public,anon;
revoke all on function public.set_roll30_session_presentation(uuid,text,text,uuid,boolean) from public,anon;
revoke all on function public.save_roll30_scene_state(uuid,text) from public,anon;
revoke all on function public.apply_roll30_scene_state(uuid,uuid) from public,anon;
grant execute on function public.configure_roll30_token_presentation(uuid,uuid,text,text,boolean) to authenticated;
grant execute on function public.set_roll30_session_presentation(uuid,text,text,uuid,boolean) to authenticated;
grant execute on function public.save_roll30_scene_state(uuid,text) to authenticated;
grant execute on function public.apply_roll30_scene_state(uuid,uuid) to authenticated;
