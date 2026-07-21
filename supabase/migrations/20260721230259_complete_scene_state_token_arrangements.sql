alter table public.scene_states add column if not exists tokens jsonb;

create or replace function public.save_roll30_scene_state(target_scene uuid,state_name text)
returns public.scene_states
language plpgsql security definer set search_path=public
as $$
declare scene_row public.scenes;active_session uuid;object_data jsonb;token_data jsonb;result public.scene_states;
begin
  select * into scene_row from public.scenes where id=target_scene and deleted_at is null;
  if scene_row.id is null or not public.is_campaign_gm(scene_row.campaign_id) then raise exception 'Only the GM can save scene states';end if;
  if length(trim(state_name)) not between 1 and 120 then raise exception 'Scene state name is required';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'object_type',object_type,'x',x,'y',y,'state',state,'config',config,'layer',layer,'z_index',z_index,'visible_to_players',visible_to_players) order by z_index,created_at,id),'[]'::jsonb)
  into object_data from public.scene_objects where scene_id=target_scene;
  select id into active_session from public.sessions where campaign_id=scene_row.campaign_id and scene_id=target_scene and status='active';
  if active_session is not null then
    select coalesce(jsonb_agg(jsonb_build_object('character_id',character_id,'name',name,'x',x,'y',y,'speed',speed,'size_ft',size_ft,'hidden',hidden,'presentation',presentation) order by created_at,id),'[]'::jsonb)
    into token_data from public.session_tokens where session_id=active_session;
  else
    select coalesce(jsonb_agg(jsonb_build_object('character_id',config->>'character_id','name',name,'x',x,'y',y,'size_ft',coalesce((config->>'size_ft')::numeric,5),'hidden',coalesce((config->>'hidden')::boolean,false)) order by created_at,id),'[]'::jsonb)
    into token_data from public.scene_objects where scene_id=target_scene and object_type='token';
  end if;
  insert into public.scene_states(scene_id,name,scene_config,objects,tokens,created_by)
  values(target_scene,trim(state_name),scene_row.config,object_data,token_data,auth.uid()) returning * into result;
  return result;
end;
$$;

create or replace function public.duplicate_roll30_scene(source_scene uuid)
returns public.scenes
language plpgsql security definer set search_path=public
as $$
declare source public.scenes;created public.scenes;source_object public.scene_objects;created_object public.scene_objects;saved_state public.scene_states;object_map jsonb:='{}'::jsonb;remapped_objects jsonb;
begin
  select * into source from public.scenes where id=source_scene and deleted_at is null;if source.id is null then raise exception 'Scene not found';end if;if not public.is_campaign_gm(source.campaign_id) then raise exception 'Only the GM can duplicate scenes';end if;
  insert into public.scenes(campaign_id,name,scene_type,folder,background_asset_id,config,created_by) values(source.campaign_id,source.name||' copy',source.scene_type,source.folder,source.background_asset_id,source.config,auth.uid()) returning * into created;
  for source_object in select * from public.scene_objects where scene_id=source.id order by z_index,created_at,id loop insert into public.scene_objects(scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players) values(created.id,source_object.name,source_object.object_type,source_object.x,source_object.y,source_object.state,source_object.config,source_object.layer,source_object.z_index,source_object.visible_to_players) returning * into created_object;object_map:=object_map||jsonb_build_object(source_object.id::text,created_object.id::text);end loop;
  for saved_state in select * from public.scene_states where scene_id=source.id order by created_at,id loop select coalesce(jsonb_agg(jsonb_set(item,'{id}',to_jsonb(object_map->>(item->>'id')),true)),'[]'::jsonb) into remapped_objects from jsonb_array_elements(saved_state.objects) item where object_map?(item->>'id');insert into public.scene_states(scene_id,name,scene_config,objects,tokens,created_by) values(created.id,saved_state.name,saved_state.scene_config,remapped_objects,saved_state.tokens,auth.uid());end loop;
  return created;
end;
$$;

create or replace function public.save_roll30_scene_template(source_scene uuid,template_name text)
returns public.scene_templates
language plpgsql security definer set search_path=public
as $$
declare source public.scenes;result public.scene_templates;object_data jsonb;state_data jsonb;
begin
  select * into source from public.scenes where id=source_scene and deleted_at is null;if source.id is null or not public.is_campaign_gm(source.campaign_id) then raise exception 'Only the GM can save scene templates';end if;if length(trim(template_name)) not between 1 and 160 then raise exception 'Template name is required';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'object_type',object_type,'x',x,'y',y,'state',state,'config',config,'layer',layer,'z_index',z_index,'visible_to_players',visible_to_players) order by z_index,created_at,id),'[]'::jsonb) into object_data from public.scene_objects where scene_id=source.id;
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'scene_config',scene_config,'objects',objects,'tokens',tokens) order by created_at,id),'[]'::jsonb) into state_data from public.scene_states where scene_id=source.id;
  insert into public.scene_templates(campaign_id,name,scene_type,background_asset_id,config,objects,scene_states,created_by) values(source.campaign_id,trim(template_name),source.scene_type,source.background_asset_id,source.config,object_data,state_data,auth.uid()) returning * into result;return result;
end;
$$;

create or replace function public.create_roll30_scene_from_template(template_id uuid,scene_name text)
returns public.scenes
language plpgsql security definer set search_path=public
as $$
declare template public.scene_templates;result public.scenes;source_object jsonb;created_object public.scene_objects;saved_state jsonb;object_map jsonb:='{}'::jsonb;remapped_objects jsonb;
begin
  select * into template from public.scene_templates where id=template_id;if template.id is null or not public.is_campaign_gm(template.campaign_id) then raise exception 'Only the GM can use scene templates';end if;if length(trim(scene_name)) not between 1 and 160 then raise exception 'Scene name is required';end if;
  insert into public.scenes(campaign_id,name,scene_type,background_asset_id,config,created_by) values(template.campaign_id,trim(scene_name),template.scene_type,template.background_asset_id,template.config,auth.uid()) returning * into result;
  for source_object in select value from jsonb_array_elements(template.objects) loop insert into public.scene_objects(scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players) values(result.id,source_object->>'name',source_object->>'object_type',(source_object->>'x')::integer,(source_object->>'y')::integer,coalesce(source_object->'state','{}'::jsonb),coalesce(source_object->'config','{}'::jsonb),coalesce(source_object->>'layer','objects'),coalesce((source_object->>'z_index')::integer,0),coalesce((source_object->>'visible_to_players')::boolean,false)) returning * into created_object;if source_object?'id' then object_map:=object_map||jsonb_build_object(source_object->>'id',created_object.id::text);end if;end loop;
  for saved_state in select value from jsonb_array_elements(template.scene_states) loop select coalesce(jsonb_agg(jsonb_set(item,'{id}',to_jsonb(object_map->>(item->>'id')),true)),'[]'::jsonb) into remapped_objects from jsonb_array_elements(coalesce(saved_state->'objects','[]'::jsonb)) item where object_map?(item->>'id');insert into public.scene_states(scene_id,name,scene_config,objects,tokens,created_by) values(result.id,saved_state->>'name',coalesce(saved_state->'scene_config','{}'::jsonb),remapped_objects,saved_state->'tokens',auth.uid());end loop;
  return result;
end;
$$;

create or replace function public.apply_roll30_scene_state(target_session uuid,target_state uuid)
returns public.scene_states
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions;state_row public.scene_states;before_snapshot public.session_snapshots;next_initiative jsonb;
begin
  select * into session_row from public.sessions where id=target_session and status='active' for update;if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can apply scene states';end if;
  select saved.* into state_row from public.scene_states saved join public.scenes scene_row on scene_row.id=saved.scene_id where saved.id=target_state and saved.scene_id=session_row.scene_id and scene_row.campaign_id=session_row.campaign_id;if state_row.id is null then raise exception 'Scene state is not for the active scene';end if;
  before_snapshot:=public.snapshot_roll30_session(target_session,'Before scene state: '||state_row.name);
  update public.scenes set config=state_row.scene_config,updated_at=now() where id=state_row.scene_id;
  delete from public.scene_objects current_object where current_object.scene_id=state_row.scene_id and not exists(select 1 from jsonb_array_elements(state_row.objects) item where (item->>'id')::uuid=current_object.id);
  insert into public.scene_objects(id,scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players)
  select item.id,state_row.scene_id,item.name,item.object_type,item.x,item.y,coalesce(item.state,'{}'::jsonb),coalesce(item.config,'{}'::jsonb),coalesce(item.layer,'objects'),coalesce(item.z_index,0),coalesce(item.visible_to_players,false)
  from jsonb_to_recordset(state_row.objects) as item(id uuid,name text,object_type text,x integer,y integer,state jsonb,config jsonb,layer text,z_index integer,visible_to_players boolean)
  on conflict(id) do update set name=excluded.name,object_type=excluded.object_type,x=excluded.x,y=excluded.y,state=excluded.state,config=excluded.config,layer=excluded.layer,z_index=excluded.z_index,visible_to_players=excluded.visible_to_players;
  if state_row.tokens is not null then
    delete from public.session_tokens current_token where current_token.session_id=target_session and not exists(select 1 from jsonb_array_elements(state_row.tokens) item where (item->>'character_id')::uuid=current_token.character_id);
    insert into public.session_tokens(session_id,character_id,name,x,y,speed,size_ft,hidden,presentation)
    select target_session,item.character_id,item.name,item.x,item.y,coalesce(item.speed,30),coalesce(item.size_ft,5),coalesce(item.hidden,false),coalesce(item.presentation,'{}'::jsonb)
    from jsonb_to_recordset(state_row.tokens) as item(character_id uuid,name text,x integer,y integer,speed numeric,size_ft numeric,hidden boolean,presentation jsonb)
    join public.characters character_row on character_row.id=item.character_id and character_row.campaign_id=session_row.campaign_id
    on conflict(session_id,character_id) do update set name=excluded.name,x=excluded.x,y=excluded.y,speed=excluded.speed,size_ft=excluded.size_ft,hidden=excluded.hidden,presentation=excluded.presentation;
    select coalesce(jsonb_agg(entry),'[]'::jsonb) into next_initiative from jsonb_array_elements(coalesce(session_row.state->'initiative','[]'::jsonb)) entry where exists(select 1 from public.session_tokens token_row where token_row.session_id=target_session and token_row.id=(entry->>'token_id')::uuid);
    update public.sessions set state=jsonb_set(state,'{initiative}',next_initiative,true),active_turn=0,updated_at=now() where id=session_row.id;
  else update public.sessions set updated_at=now() where id=session_row.id;end if;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(session_row.id,auth.uid(),'scene_state_applied',jsonb_build_object('scene_state_id',state_row.id,'name',state_row.name,'snapshot_id',before_snapshot.id));return state_row;
end;
$$;
