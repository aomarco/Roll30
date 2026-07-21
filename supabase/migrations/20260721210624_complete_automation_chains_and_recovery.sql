create table public.session_event_undos (
  original_event_id bigint primary key references public.session_events(id) on delete cascade,
  undo_event_id bigint unique references public.session_events(id) on delete cascade,
  undone_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.session_event_undos enable row level security;
grant select on public.session_event_undos to authenticated;
create policy "gms read session action undos"
on public.session_event_undos for select to authenticated
using (exists (
  select 1 from public.session_events event_row
  join public.sessions session_row on session_row.id=event_row.session_id
  where event_row.id=original_event_id and public.is_campaign_gm(session_row.campaign_id)
));

create index automation_executions_session_status_run_idx
on public.automation_executions(session_id,status,run_at);

create or replace function public.snapshot_roll30_session(target_session uuid, snapshot_label text default null)
returns public.session_snapshots
language plpgsql security definer set search_path=public
as $$
declare
  current_session public.sessions;
  token_state jsonb;
  object_state jsonb;
  snapshot_state jsonb;
  result public.session_snapshots;
begin
  select * into current_session from public.sessions where id=target_session for update;
  if current_session.id is null or not public.is_campaign_gm(current_session.campaign_id) then
    raise exception 'Only the GM can save a snapshot';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',token.id,'character_id',token.character_id,'name',token.name,'x',token.x,'y',token.y,
    'speed',token.speed,'size_ft',token.size_ft,'hidden',token.hidden
  ) order by token.created_at,token.id),'[]'::jsonb)
  into token_state from public.session_tokens token where token.session_id=target_session;
  select coalesce(jsonb_agg(jsonb_build_object('id',object_row.id,'state',object_row.state) order by object_row.id),'[]'::jsonb)
  into object_state from public.scene_objects object_row where object_row.scene_id=current_session.scene_id;
  snapshot_state:=jsonb_set(coalesce(current_session.state,'{}'::jsonb),'{tokens}',token_state,true);
  snapshot_state:=jsonb_set(snapshot_state,'{scene_objects}',object_state,true);
  insert into public.session_snapshots(session_id,created_by,label,state,session_round,session_active_turn,scene_id)
  values(target_session,auth.uid(),coalesce(nullif(trim(snapshot_label),''),'Snapshot'),snapshot_state,current_session.round,current_session.active_turn,current_session.scene_id)
  returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'snapshot_saved',jsonb_build_object('snapshot_id',result.id,'label',result.label));
  return result;
end;
$$;

create or replace function public.restore_roll30_snapshot(target_snapshot uuid)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare
  snapshot_row public.session_snapshots;
  result public.sessions;
  restored_state jsonb;
  object_snapshot jsonb;
begin
  select * into snapshot_row from public.session_snapshots where id=target_snapshot;
  select * into result from public.sessions where id=snapshot_row.session_id for update;
  if snapshot_row.id is null or result.id is null or not public.is_campaign_gm(result.campaign_id) then
    raise exception 'Only the GM can restore a snapshot';
  end if;
  delete from public.session_tokens where session_id=result.id;
  insert into public.session_tokens(id,session_id,character_id,name,x,y,speed,size_ft,hidden)
  select case when token?'id' then (token->>'id')::uuid else gen_random_uuid() end,
    result.id,character.id,coalesce(nullif(token->>'name',''),character.name),
    greatest(2,least(98,coalesce((token->>'x')::integer,50))),
    greatest(2,least(98,coalesce((token->>'y')::integer,50))),
    greatest(1,coalesce((token->>'speed')::numeric,(character.sheet->>'speed')::numeric,30)),
    greatest(1,least(100,coalesce((token->>'size_ft')::numeric,5))),
    coalesce((token->>'hidden')::boolean,false)
  from jsonb_array_elements(coalesce(snapshot_row.state->'tokens','[]'::jsonb)) token
  join public.characters character on character.id=(token->>'character_id')::uuid and character.campaign_id=result.campaign_id;
  for object_snapshot in select value from jsonb_array_elements(coalesce(snapshot_row.state->'scene_objects','[]'::jsonb)) loop
    update public.scene_objects set state=coalesce(object_snapshot->'state','{}'::jsonb)
    where id=(object_snapshot->>'id')::uuid and scene_id=snapshot_row.scene_id;
  end loop;
  restored_state:=coalesce(snapshot_row.state,'{}'::jsonb)-'tokens'-'scene_objects';
  update public.sessions set state=restored_state,round=coalesce(snapshot_row.session_round,round),
    active_turn=coalesce(snapshot_row.session_active_turn,active_turn),scene_id=coalesce(snapshot_row.scene_id,scene_id),updated_at=now()
  where id=result.id returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(result.id,auth.uid(),'snapshot_restored',jsonb_build_object('snapshot_id',snapshot_row.id,'label',snapshot_row.label));
  return result;
end;
$$;

create or replace function private.queue_roll30_event_triggers(
  target_session uuid,
  target_event text,
  source_object uuid,
  event_key text
)
returns integer
language plpgsql security definer set search_path=public
as $$
declare
  session_row public.sessions;
  rule public.scene_triggers;
  execution_key text;
  delay_seconds integer;
  queued integer:=0;
  inserted integer;
begin
  select * into session_row from public.sessions where id=target_session;
  for rule in
    select * from public.scene_triggers
    where scene_id=session_row.scene_id and enabled and trigger->>'event'=target_event
      and (not (trigger?'object_id') or (trigger->>'object_id')::uuid=source_object)
    order by created_at,id
  loop
    if rule.run_once and exists(select 1 from public.automation_executions where trigger_id=rule.id and session_id=target_session and status='completed') then
      continue;
    end if;
    execution_key:=target_event||':'||event_key||':'||rule.id::text;
    delay_seconds:=greatest(0,least(86400,coalesce((rule.trigger->>'delay_seconds')::integer,0)));
    insert into public.automation_executions(trigger_id,session_id,idempotency_key,status,run_at)
    values(rule.id,target_session,execution_key,'scheduled',now()+make_interval(secs=>delay_seconds))
    on conflict(trigger_id,session_id,idempotency_key) do nothing;
    get diagnostics inserted=row_count;
    if inserted=0 then continue; end if;
    queued:=queued+1;
    if delay_seconds=0 then
      perform private.apply_roll30_trigger(rule.id,target_session,execution_key);
    else
      insert into public.session_events(session_id,actor_id,event_type,payload)
      values(target_session,auth.uid(),'trigger_scheduled',jsonb_build_object(
        'trigger_id',rule.id,'name',rule.name,'run_at',now()+make_interval(secs=>delay_seconds),'key',execution_key
      ));
    end if;
  end loop;
  return queued;
end;
$$;

create or replace function public.activate_roll30_scene_object(target_session uuid,target_object uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  session_row public.sessions;
  object_row public.scene_objects;
  before_snapshot public.session_snapshots;
  source_event public.session_events;
  chain_event public.session_events;
  was_active boolean;
  now_active boolean;
  trigger_count integer;
begin
  select * into session_row from public.sessions where id=target_session and status='active' for update;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then
    raise exception 'Only the GM can activate scene objects';
  end if;
  select * into object_row from public.scene_objects where id=target_object and scene_id=session_row.scene_id for update;
  if object_row.id is null then raise exception 'Object is not in the active scene'; end if;
  before_snapshot:=public.snapshot_roll30_session(target_session,'Before '||object_row.name||' activation');
  was_active:=coalesce((object_row.state->>'active')::boolean,false);
  now_active:=not was_active;
  update public.scene_objects set state=jsonb_set(coalesce(state,'{}'::jsonb),'{active}',to_jsonb(now_active),true)
  where id=object_row.id;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'object_toggled',jsonb_build_object(
    'object_id',object_row.id,'name',object_row.name,'from_active',was_active,'active',now_active
  )) returning * into source_event;
  trigger_count:=private.queue_roll30_event_triggers(target_session,'object_activated',object_row.id,source_event.id::text);
  if trigger_count>0 then
    insert into public.session_events(session_id,actor_id,event_type,payload)
    values(target_session,auth.uid(),'automation_chain_completed',jsonb_build_object(
      'snapshot_id',before_snapshot.id,'source_event_id',source_event.id,'source_object_id',object_row.id,
      'name',object_row.name,'trigger_count',trigger_count
    )) returning * into chain_event;
  end if;
  return jsonb_build_object('object_id',object_row.id,'active',now_active,'triggers',trigger_count,'undo_snapshot',before_snapshot.id);
end;
$$;

create or replace function public.create_roll30_automation_rule(
  target_scene uuid,
  rule_name text,
  trigger_event text,
  source_object uuid,
  delay_seconds integer,
  run_only_once boolean,
  rule_effects jsonb
)
returns public.scene_triggers
language plpgsql security definer set search_path=public
as $$
declare scene_row public.scenes; effect jsonb; result public.scene_triggers;
begin
  select * into scene_row from public.scenes where id=target_scene and deleted_at is null;
  if scene_row.id is null or not public.is_campaign_gm(scene_row.campaign_id) then raise exception 'Only a GM can create automation'; end if;
  if length(trim(rule_name)) not between 1 and 120 then raise exception 'Rule name must be from 1 to 120 characters'; end if;
  if trigger_event not in ('manual','object_activated') then raise exception 'Unsupported automation event'; end if;
  if trigger_event='object_activated' and not exists(select 1 from public.scene_objects where id=source_object and scene_id=target_scene) then
    raise exception 'Choose a source object from this scene';
  end if;
  if jsonb_typeof(rule_effects)<>'array' or jsonb_array_length(rule_effects) not between 1 and 10 then raise exception 'Choose from 1 to 10 effects'; end if;
  for effect in select value from jsonb_array_elements(rule_effects) loop
    if effect->>'type' not in ('show_fog','clear_fog','advance_round','toggle_object','set_object_state','spawn_character','message') then raise exception 'Unsupported automation effect'; end if;
    if effect->>'type' in ('toggle_object','set_object_state') and not exists(select 1 from public.scene_objects where id=(effect->>'object_id')::uuid and scene_id=target_scene) then raise exception 'Effect object is not in this scene'; end if;
    if effect->>'type'='spawn_character' and not exists(select 1 from public.characters where id=(effect->>'character_id')::uuid and campaign_id=scene_row.campaign_id) then raise exception 'Spawn character is not in this campaign'; end if;
    if effect->>'type'='message' and length(trim(coalesce(effect->>'text',''))) not between 1 and 2000 then raise exception 'Automation message must be from 1 to 2000 characters'; end if;
  end loop;
  insert into public.scene_triggers(scene_id,name,trigger,effects,run_once)
  values(target_scene,trim(rule_name),jsonb_build_object(
    'event',trigger_event,'object_id',case when trigger_event='object_activated' then source_object else null end,
    'delay_seconds',greatest(0,least(86400,coalesce(delay_seconds,0)))
  ),rule_effects,coalesce(run_only_once,false)) returning * into result;
  return result;
end;
$$;

create or replace function public.preview_roll30_snapshot(target_snapshot uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare snapshot_row public.session_snapshots; session_row public.sessions; current_tokens integer; snapshot_tokens integer; current_objects integer; snapshot_objects integer;
begin
  select * into snapshot_row from public.session_snapshots where id=target_snapshot;
  select * into session_row from public.sessions where id=snapshot_row.session_id;
  if snapshot_row.id is null or session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can preview recovery'; end if;
  select count(*) into current_tokens from public.session_tokens where session_id=session_row.id;
  select count(*) into current_objects from public.scene_objects where scene_id=session_row.scene_id;
  snapshot_tokens:=jsonb_array_length(coalesce(snapshot_row.state->'tokens','[]'::jsonb));
  snapshot_objects:=jsonb_array_length(coalesce(snapshot_row.state->'scene_objects','[]'::jsonb));
  return jsonb_build_object('label',snapshot_row.label,'created_at',snapshot_row.created_at,
    'current',jsonb_build_object('round',session_row.round,'turn',session_row.active_turn,'tokens',current_tokens,'objects',current_objects,'scene_id',session_row.scene_id),
    'snapshot',jsonb_build_object('round',snapshot_row.session_round,'turn',snapshot_row.session_active_turn,'tokens',snapshot_tokens,'objects',snapshot_objects,'scene_id',snapshot_row.scene_id));
end;
$$;

create or replace function public.preview_roll30_last_undo(target_session uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare session_row public.sessions; event_row public.session_events;
begin
  select * into session_row from public.sessions where id=target_session;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can preview undo'; end if;
  select event_item.* into event_row from public.session_events event_item
  where event_item.session_id=target_session
    and event_item.event_type in ('automation_chain_completed','token_moved','object_toggled')
    and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id)
  order by event_item.created_at desc,event_item.id desc limit 1;
  if event_row.id is null then return jsonb_build_object('available',false); end if;
  return jsonb_build_object('available',true,'event_id',event_row.id,'event_type',event_row.event_type,
    'created_at',event_row.created_at,'name',coalesce(event_row.payload->>'name',event_row.event_type),
    'summary',case event_row.event_type
      when 'automation_chain_completed' then 'Restore the table to before this automation chain'
      when 'token_moved' then 'Move the token back to its previous position'
      else 'Restore the object to its previous state' end);
end;
$$;

create or replace function public.undo_roll30_last_action(target_session uuid)
returns public.session_events
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions; event_row public.session_events; undo_event public.session_events; token_key text; move_state jsonb; spent numeric;
begin
  select * into session_row from public.sessions where id=target_session for update;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can undo table actions'; end if;
  select event_item.* into event_row from public.session_events event_item
  where event_item.session_id=target_session
    and event_item.event_type in ('automation_chain_completed','token_moved','object_toggled')
    and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id)
  order by event_item.created_at desc,event_item.id desc limit 1 for update;
  if event_row.id is null then raise exception 'There is no reversible action to undo'; end if;
  if event_row.event_type='automation_chain_completed' then
    perform public.restore_roll30_snapshot((event_row.payload->>'snapshot_id')::uuid);
  elsif event_row.event_type='token_moved' then
    update public.session_tokens set x=(event_row.payload->>'from_x')::integer,y=(event_row.payload->>'from_y')::integer
    where id=(event_row.payload->>'token_id')::uuid and session_id=target_session;
    token_key:=event_row.payload->>'token_id'; move_state:=coalesce(session_row.state->'movement','{}'::jsonb);
    spent:=greatest(0,coalesce((move_state->token_key->>'spent')::numeric,0)-coalesce((event_row.payload->>'movement_cost')::numeric,0));
    if move_state?token_key then move_state:=jsonb_set(move_state,array[token_key,'spent'],to_jsonb(spent),false); end if;
    update public.sessions set state=jsonb_set(state,'{movement}',move_state,true),updated_at=now() where id=target_session;
  else
    update public.scene_objects set state=jsonb_set(coalesce(state,'{}'::jsonb),'{active}',to_jsonb(coalesce((event_row.payload->>'from_active')::boolean,false)),true)
    where id=(event_row.payload->>'object_id')::uuid and scene_id=session_row.scene_id;
    update public.sessions set updated_at=now() where id=target_session;
  end if;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'action_undone',jsonb_build_object('original_event_id',event_row.id,'original_type',event_row.event_type))
  returning * into undo_event;
  insert into public.session_event_undos(original_event_id,undo_event_id,undone_by)
  values(event_row.id,undo_event.id,auth.uid());
  return undo_event;
end;
$$;

revoke all on function public.activate_roll30_scene_object(uuid,uuid) from public,anon;
revoke all on function public.create_roll30_automation_rule(uuid,text,text,uuid,integer,boolean,jsonb) from public,anon;
revoke all on function public.preview_roll30_snapshot(uuid) from public,anon;
revoke all on function public.preview_roll30_last_undo(uuid) from public,anon;
revoke all on function public.undo_roll30_last_action(uuid) from public,anon;
grant execute on function public.activate_roll30_scene_object(uuid,uuid) to authenticated;
grant execute on function public.create_roll30_automation_rule(uuid,text,text,uuid,integer,boolean,jsonb) to authenticated;
grant execute on function public.preview_roll30_snapshot(uuid) to authenticated;
grant execute on function public.preview_roll30_last_undo(uuid) to authenticated;
grant execute on function public.undo_roll30_last_action(uuid) to authenticated;
