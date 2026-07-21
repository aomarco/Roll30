alter table public.scene_objects drop constraint scene_objects_object_type_check;
alter table public.scene_objects add constraint scene_objects_object_type_check
  check (object_type in ('object','door','lever','trap','light','wall','terrain'));

alter table public.session_tokens
  add column size_ft numeric not null default 5 check (size_ft between 1 and 100),
  add column hidden boolean not null default false;

create or replace function public.move_roll30_token(
  target_session uuid,
  target_token text,
  target_x integer,
  target_y integer
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_session public.sessions;
  scene_row public.scenes;
  token public.session_tokens;
  other_token public.session_tokens;
  character_owner uuid;
  result public.sessions;
  origin_x integer;
  origin_y integer;
  destination_x integer := greatest(2, least(98, target_x));
  destination_y integer := greatest(2, least(98, target_y));
  blocker public.scene_objects;
  is_gm boolean;
  move_state jsonb;
  spent numeric;
  distance_feet numeric;
  movement_cost numeric;
  terrain_multiplier numeric := 1;
  map_width numeric;
  next_state jsonb;
  active_token text;
begin
  select * into current_session from public.sessions where id = target_session for update;
  if current_session.id is null or not public.is_campaign_member(current_session.campaign_id) then
    raise exception 'Not permitted';
  end if;
  select * into token
  from public.session_tokens
  where id = target_token::uuid and session_id = current_session.id
  for update;
  if token.id is null then raise exception 'Token not found'; end if;

  select owner_id into character_owner from public.characters where id = token.character_id;
  is_gm := public.is_campaign_gm(current_session.campaign_id);
  if not (is_gm or character_owner is not distinct from auth.uid()) then
    raise exception 'You can only move your own token';
  end if;

  select * into scene_row from public.scenes where id = current_session.scene_id;
  map_width := greatest(1, coalesce((scene_row.config ->> 'map_width_ft')::numeric, 100));
  active_token := current_session.state -> 'initiative' -> current_session.active_turn ->> 'token_id';
  if not is_gm and active_token is not null and active_token <> target_token then
    raise exception 'It is not this token''s turn';
  end if;

  origin_x := token.x;
  origin_y := token.y;
  distance_feet := sqrt(power(destination_x - origin_x, 2) + power(destination_y - origin_y, 2)) * map_width / 100;

  if scene_row.id is not null then
    select greatest(1, coalesce(max(coalesce((terrain.config ->> 'movement_multiplier')::numeric, 2)), 1))
    into terrain_multiplier
    from public.scene_objects terrain
    where terrain.scene_id = scene_row.id
      and terrain.object_type = 'terrain'
      and coalesce((terrain.state ->> 'active')::boolean, true)
      and terrain.config ? 'x2' and terrain.config ? 'y2'
      and destination_x between least(terrain.x, (terrain.config ->> 'x2')::integer) and greatest(terrain.x, (terrain.config ->> 'x2')::integer)
      and destination_y between least(terrain.y, (terrain.config ->> 'y2')::integer) and greatest(terrain.y, (terrain.config ->> 'y2')::integer);

    if not is_gm then
      for blocker in
        select * from public.scene_objects
        where scene_id = scene_row.id
          and object_type in ('wall', 'door')
          and config ? 'x2' and config ? 'y2'
          and (object_type = 'wall' or coalesce((state ->> 'active')::boolean, true))
      loop
        if private.roll30_segments_intersect(
          origin_x, origin_y, destination_x, destination_y,
          blocker.x, blocker.y,
          (blocker.config ->> 'x2')::double precision,
          (blocker.config ->> 'y2')::double precision
        ) then
          raise exception 'That movement crosses a wall or closed door';
        end if;
      end loop;

      for other_token in
        select * from public.session_tokens
        where session_id = current_session.id and id <> token.id
      loop
        if sqrt(power(destination_x - other_token.x, 2) + power(destination_y - other_token.y, 2))
           < ((token.size_ft + other_token.size_ft) / 2) / map_width * 100 then
          raise exception 'Another token occupies that space';
        end if;
      end loop;
    end if;
  end if;

  movement_cost := distance_feet * terrain_multiplier;
  move_state := coalesce(current_session.state -> 'movement', '{}'::jsonb);
  spent := case
    when coalesce((move_state -> target_token ->> 'turn')::integer, -1) = current_session.active_turn
      and coalesce((move_state -> target_token ->> 'round')::integer, -1) = current_session.round
      then coalesce((move_state -> target_token ->> 'spent')::numeric, 0)
    else 0
  end;
  if not is_gm and spent + movement_cost > token.speed then
    raise exception 'That move exceeds this token''s speed for the turn';
  end if;

  update public.session_tokens set x = destination_x, y = destination_y where id = token.id;
  move_state := jsonb_set(move_state, array[target_token], jsonb_build_object(
    'turn', current_session.active_turn,
    'round', current_session.round,
    'spent', spent + movement_cost
  ), true);
  next_state := jsonb_set(current_session.state, '{movement}', move_state, true);
  update public.sessions set state = next_state, updated_at = now()
  where id = target_session returning * into result;
  insert into public.session_events(session_id, actor_id, event_type, payload)
  values(target_session, auth.uid(), 'token_moved', jsonb_build_object(
    'token_id', target_token,
    'from_x', origin_x, 'from_y', origin_y,
    'x', destination_x, 'y', destination_y,
    'distance_feet', distance_feet,
    'movement_cost', movement_cost,
    'terrain_multiplier', terrain_multiplier
  ));
  return result;
end;
$$;

create or replace function public.configure_roll30_session_token(
  target_token uuid,
  token_size_ft numeric,
  token_hidden boolean
)
returns public.session_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.session_tokens;
begin
  select token.* into result
  from public.session_tokens token
  join public.sessions session_row on session_row.id = token.session_id
  where token.id = target_token and public.is_campaign_gm(session_row.campaign_id);
  if result.id is null then raise exception 'Token not found'; end if;
  update public.session_tokens
  set size_ft = greatest(1, least(100, token_size_ft)), hidden = token_hidden
  where id = result.id returning * into result;
  update public.sessions set updated_at = now() where id = result.session_id;
  insert into public.session_events(session_id, actor_id, event_type, payload)
  values(result.session_id, auth.uid(), 'token_configured', jsonb_build_object(
    'token_id', result.id, 'size_ft', result.size_ft, 'hidden', result.hidden
  ));
  return result;
end;
$$;

create or replace function public.get_visible_roll30_tokens(target_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.sessions;
  own_character_id uuid;
  own_token_id uuid;
  candidate public.session_tokens;
  vision jsonb;
  polygon jsonb;
  result jsonb := '[]'::jsonb;
  visible boolean;
begin
  select * into session_row from public.sessions where id = target_session;
  if session_row.id is null or not public.is_campaign_member(session_row.campaign_id) then
    raise exception 'Not permitted';
  end if;

  if public.is_campaign_gm(session_row.campaign_id) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', token.id, 'character_id', token.character_id, 'name', token.name,
      'x', token.x, 'y', token.y, 'speed', token.speed,
      'size_ft', token.size_ft, 'hidden', token.hidden
    ) order by token.created_at, token.id), '[]'::jsonb)
    into result from public.session_tokens token where token.session_id = session_row.id;
    return result;
  end if;

  select character_id into own_character_id
  from public.campaign_members
  where campaign_id = session_row.campaign_id and user_id = auth.uid();
  select id into own_token_id
  from public.session_tokens
  where session_id = session_row.id and character_id = own_character_id;

  if coalesce((session_row.state ->> 'fog')::boolean, false) = false
     and coalesce((select config ->> 'ambient_light' from public.scenes where id = session_row.scene_id), 'bright') = 'bright' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', token.id, 'character_id', token.character_id, 'name', token.name,
      'x', token.x, 'y', token.y, 'speed', token.speed,
      'size_ft', token.size_ft
    ) order by token.created_at, token.id), '[]'::jsonb)
    into result
    from public.session_tokens token
    where token.session_id = session_row.id and (not token.hidden or token.id = own_token_id);
    return result;
  end if;

  vision := public.get_roll30_player_vision(target_session);
  for candidate in select * from public.session_tokens where session_id = session_row.id loop
    visible := candidate.id = own_token_id;
    if not visible and not candidate.hidden then
      for polygon in
        select value from jsonb_array_elements(
          coalesce(vision -> 'current', '[]'::jsonb) || coalesce(vision -> 'reveals', '[]'::jsonb)
        )
      loop
        if private.roll30_point_in_polygon(candidate.x, candidate.y, polygon) then
          visible := true;
          exit;
        end if;
      end loop;
    end if;
    if visible then
      result := result || jsonb_build_array(jsonb_build_object(
        'id', candidate.id, 'character_id', candidate.character_id, 'name', candidate.name,
        'x', candidate.x, 'y', candidate.y, 'speed', candidate.speed,
        'size_ft', candidate.size_ft
      ));
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.snapshot_roll30_session(target_session uuid, snapshot_label text default null)
returns public.session_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  current_session public.sessions;
  token_state jsonb;
  snapshot_state jsonb;
  result public.session_snapshots;
begin
  select * into current_session from public.sessions where id = target_session for update;
  if current_session.id is null or not public.is_campaign_gm(current_session.campaign_id) then
    raise exception 'Only the GM can save a snapshot';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', token.id, 'character_id', token.character_id, 'name', token.name,
    'x', token.x, 'y', token.y, 'speed', token.speed,
    'size_ft', token.size_ft, 'hidden', token.hidden
  ) order by token.created_at, token.id), '[]'::jsonb)
  into token_state from public.session_tokens token where token.session_id = target_session;
  snapshot_state := jsonb_set(coalesce(current_session.state, '{}'::jsonb), '{tokens}', token_state, true);
  insert into public.session_snapshots(
    session_id, created_by, label, state, session_round, session_active_turn, scene_id
  ) values(
    target_session, auth.uid(), coalesce(nullif(trim(snapshot_label), ''), 'Snapshot'),
    snapshot_state, current_session.round, current_session.active_turn, current_session.scene_id
  ) returning * into result;
  insert into public.session_events(session_id, actor_id, event_type, payload)
  values(target_session, auth.uid(), 'snapshot_saved', jsonb_build_object('snapshot_id', result.id, 'label', result.label));
  return result;
end;
$$;

create or replace function public.restore_roll30_snapshot(target_snapshot uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot_row public.session_snapshots;
  result public.sessions;
  restored_state jsonb;
begin
  select * into snapshot_row from public.session_snapshots where id = target_snapshot;
  select * into result from public.sessions where id = snapshot_row.session_id for update;
  if snapshot_row.id is null or result.id is null or not public.is_campaign_gm(result.campaign_id) then
    raise exception 'Only the GM can restore a snapshot';
  end if;
  delete from public.session_tokens where session_id = result.id;
  insert into public.session_tokens(id, session_id, character_id, name, x, y, speed, size_ft, hidden)
  select
    case when token ? 'id' then (token ->> 'id')::uuid else gen_random_uuid() end,
    result.id,
    character.id,
    coalesce(nullif(token ->> 'name', ''), character.name),
    greatest(2, least(98, coalesce((token ->> 'x')::integer, 50))),
    greatest(2, least(98, coalesce((token ->> 'y')::integer, 50))),
    greatest(1, coalesce((token ->> 'speed')::numeric, (character.sheet ->> 'speed')::numeric, 30)),
    greatest(1, least(100, coalesce((token ->> 'size_ft')::numeric, 5))),
    coalesce((token ->> 'hidden')::boolean, false)
  from jsonb_array_elements(coalesce(snapshot_row.state -> 'tokens', '[]'::jsonb)) token
  join public.characters character
    on character.id = (token ->> 'character_id')::uuid
   and character.campaign_id = result.campaign_id;
  restored_state := coalesce(snapshot_row.state, '{}'::jsonb) - 'tokens';
  update public.sessions set
    state = restored_state,
    round = coalesce(snapshot_row.session_round, round),
    active_turn = coalesce(snapshot_row.session_active_turn, active_turn),
    scene_id = coalesce(snapshot_row.scene_id, scene_id),
    updated_at = now()
  where id = result.id returning * into result;
  insert into public.session_events(session_id, actor_id, event_type, payload)
  values(result.id, auth.uid(), 'snapshot_restored', jsonb_build_object(
    'snapshot_id', snapshot_row.id, 'label', snapshot_row.label
  ));
  return result;
end;
$$;

revoke all on function public.move_roll30_token(uuid, text, integer, integer) from public, anon;
revoke all on function public.configure_roll30_session_token(uuid, numeric, boolean) from public, anon;
revoke all on function public.get_visible_roll30_tokens(uuid) from public, anon;
grant execute on function public.move_roll30_token(uuid, text, integer, integer) to authenticated;
grant execute on function public.configure_roll30_session_token(uuid, numeric, boolean) to authenticated;
grant execute on function public.get_visible_roll30_tokens(uuid) to authenticated;
