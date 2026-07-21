-- Keep initiative, snapshots, and token lifecycle consistent after session
-- tokens moved out of the broadly readable sessions.state document.

create index if not exists session_snapshots_session_id_idx on public.session_snapshots(session_id);
create index if not exists session_snapshots_created_by_idx on public.session_snapshots(created_by);
create index if not exists session_tokens_character_id_idx on public.session_tokens(character_id);

create or replace function public.snapshot_roll30_session(target_session uuid, snapshot_label text default null)
returns public.session_snapshots
language plpgsql
security definer
set search_path=public
as $$
declare
  current_session public.sessions;
  token_state jsonb;
  snapshot_state jsonb;
  result public.session_snapshots;
begin
  select * into current_session from public.sessions where id=target_session for update;
  if current_session.id is null or not public.is_campaign_gm(current_session.campaign_id) then
    raise exception 'Only the GM can save a snapshot';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,
    'character_id',t.character_id,
    'name',t.name,
    'x',t.x,
    'y',t.y,
    'speed',t.speed
  ) order by t.created_at,t.id),'[]'::jsonb)
  into token_state
  from public.session_tokens t
  where t.session_id=target_session;

  snapshot_state := jsonb_set(coalesce(current_session.state,'{}'::jsonb),'{tokens}',token_state,true);
  insert into public.session_snapshots(session_id,created_by,label,state)
  values(target_session,auth.uid(),nullif(trim(snapshot_label),''),snapshot_state)
  returning * into result;

  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'snapshot_saved',jsonb_build_object('snapshot_id',result.id,'label',result.label));
  return result;
end;
$$;

create or replace function public.restore_roll30_snapshot(target_snapshot uuid)
returns public.sessions
language plpgsql
security definer
set search_path=public
as $$
declare
  snap public.session_snapshots;
  result public.sessions;
  restored_state jsonb;
begin
  select * into snap from public.session_snapshots where id=target_snapshot;
  if snap.id is null then raise exception 'Snapshot not found'; end if;

  select * into result from public.sessions where id=snap.session_id for update;
  if result.id is null or not public.is_campaign_gm(result.campaign_id) then
    raise exception 'Only the GM can restore a snapshot';
  end if;

  if snap.state ? 'tokens' then
    delete from public.session_tokens where session_id=result.id;
    insert into public.session_tokens(id,session_id,character_id,name,x,y,speed)
    select
      case when token ? 'id' then (token->>'id')::uuid else gen_random_uuid() end,
      result.id,
      character.id,
      coalesce(nullif(token->>'name',''),character.name),
      greatest(2,least(98,coalesce((token->>'x')::integer,50))),
      greatest(2,least(98,coalesce((token->>'y')::integer,50))),
      greatest(1,coalesce((token->>'speed')::numeric,(character.sheet->>'speed')::numeric,30))
    from jsonb_array_elements(coalesce(snap.state->'tokens','[]'::jsonb)) token
    join public.characters character
      on character.id=(token->>'character_id')::uuid
     and character.campaign_id=result.campaign_id;
  end if;

  restored_state := coalesce(snap.state,'{}'::jsonb) - 'tokens';
  update public.sessions
  set state=restored_state,updated_at=now()
  where id=result.id
  returning * into result;

  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(result.id,auth.uid(),'snapshot_restored',jsonb_build_object('snapshot_id',target_snapshot));
  return result;
end;
$$;

create or replace function public.add_roll30_initiative_entry(target_session uuid, target_token uuid, target_score numeric)
returns public.sessions
language plpgsql
security definer
set search_path=public
as $$
declare
  current_session public.sessions;
  token public.session_tokens;
  entries jsonb;
  result public.sessions;
begin
  select * into current_session from public.sessions where id=target_session for update;
  if current_session.id is null or not public.is_campaign_gm(current_session.campaign_id) then
    raise exception 'Only the GM can change initiative';
  end if;
  select * into token from public.session_tokens where id=target_token and session_id=target_session;
  if token.id is null then raise exception 'Token not found in this session'; end if;
  if target_score is null or target_score < -1000 or target_score > 1000 then raise exception 'Invalid initiative score'; end if;

  select coalesce(jsonb_agg(item order by coalesce((item->>'score')::numeric,0) desc,item->>'name'),'[]'::jsonb)
  into entries
  from (
    select value as item
    from jsonb_array_elements(coalesce(current_session.state->'initiative','[]'::jsonb))
    where value->>'token_id'<>target_token::text
    union all
    select jsonb_build_object('token_id',token.id,'name',token.name,'score',target_score)
  ) ordered_entries;

  update public.sessions
  set state=jsonb_set(coalesce(state,'{}'::jsonb),'{initiative}',entries,true),active_turn=0,updated_at=now()
  where id=target_session
  returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'initiative_added',jsonb_build_object('token_id',target_token,'score',target_score));
  return result;
end;
$$;

create or replace function public.remove_roll30_initiative_entry(target_session uuid, target_token uuid)
returns public.sessions
language plpgsql
security definer
set search_path=public
as $$
declare
  current_session public.sessions;
  entries jsonb;
  next_turn integer;
  result public.sessions;
begin
  select * into current_session from public.sessions where id=target_session for update;
  if current_session.id is null or not public.is_campaign_gm(current_session.campaign_id) then
    raise exception 'Only the GM can change initiative';
  end if;
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb)
  into entries
  from jsonb_array_elements(coalesce(current_session.state->'initiative','[]'::jsonb)) with ordinality
  where value->>'token_id'<>target_token::text;
  next_turn := case when jsonb_array_length(entries)=0 then 0 else least(current_session.active_turn,jsonb_array_length(entries)-1) end;
  update public.sessions
  set state=jsonb_set(coalesce(state,'{}'::jsonb),'{initiative}',entries,true),active_turn=next_turn,updated_at=now()
  where id=target_session
  returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'initiative_removed',jsonb_build_object('token_id',target_token));
  return result;
end;
$$;

create or replace function public.remove_roll30_session_token(target_session uuid, target_token uuid)
returns public.sessions
language plpgsql
security definer
set search_path=public
as $$
declare
  current_session public.sessions;
  token public.session_tokens;
  entries jsonb;
  movement jsonb;
  next_state jsonb;
  next_turn integer;
  result public.sessions;
begin
  select * into current_session from public.sessions where id=target_session for update;
  if current_session.id is null or not public.is_campaign_gm(current_session.campaign_id) then
    raise exception 'Only the GM can remove tokens';
  end if;
  select * into token from public.session_tokens where id=target_token and session_id=target_session for update;
  if token.id is null then raise exception 'Token not found in this session'; end if;

  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb)
  into entries
  from jsonb_array_elements(coalesce(current_session.state->'initiative','[]'::jsonb)) with ordinality
  where value->>'token_id'<>target_token::text;
  movement := coalesce(current_session.state->'movement','{}'::jsonb) - target_token::text;
  next_state := jsonb_set(coalesce(current_session.state,'{}'::jsonb),'{initiative}',entries,true);
  next_state := jsonb_set(next_state,'{movement}',movement,true);
  next_turn := case when jsonb_array_length(entries)=0 then 0 else least(current_session.active_turn,jsonb_array_length(entries)-1) end;

  delete from public.session_tokens where id=target_token;
  update public.sessions
  set state=next_state,active_turn=next_turn,updated_at=now()
  where id=target_session
  returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'token_removed',jsonb_build_object('token_id',target_token,'character_id',token.character_id));
  return result;
end;
$$;

revoke all on function public.snapshot_roll30_session(uuid,text) from public,anon;
revoke all on function public.restore_roll30_snapshot(uuid) from public,anon;
revoke all on function public.add_roll30_initiative_entry(uuid,uuid,numeric) from public,anon;
revoke all on function public.remove_roll30_initiative_entry(uuid,uuid) from public,anon;
revoke all on function public.remove_roll30_session_token(uuid,uuid) from public,anon;
grant execute on function public.snapshot_roll30_session(uuid,text) to authenticated;
grant execute on function public.restore_roll30_snapshot(uuid) to authenticated;
grant execute on function public.add_roll30_initiative_entry(uuid,uuid,numeric) to authenticated;
grant execute on function public.remove_roll30_initiative_entry(uuid,uuid) to authenticated;
grant execute on function public.remove_roll30_session_token(uuid,uuid) to authenticated;
