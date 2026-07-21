create table public.session_exploration (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  polygons jsonb not null default '[]'::jsonb check (jsonb_typeof(polygons) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table public.session_reveals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  audience uuid[] not null default '{}',
  polygon jsonb not null check (jsonb_typeof(polygon) = 'array'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index session_reveals_session_idx on public.session_reveals(session_id, enabled);
alter table public.session_exploration enable row level security;
alter table public.session_reveals enable row level security;
grant select on public.session_exploration, public.session_reveals to authenticated;

create policy "players read own exploration"
on public.session_exploration for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.sessions s
    where s.id = session_id and public.is_campaign_gm(s.campaign_id)
  )
);

create policy "members read addressed reveals"
on public.session_reveals for select to authenticated
using (
  enabled
  and exists (
    select 1 from public.sessions s
    where s.id = session_id and public.is_campaign_member(s.campaign_id)
  )
  and (
    cardinality(audience) = 0
    or (select auth.uid()) = any(audience)
    or exists (
      select 1 from public.sessions s
      where s.id = session_id and public.is_campaign_gm(s.campaign_id)
    )
  )
);

-- Cast 72 rays from a token or light and stop each ray at the first wall or
-- closed door. Coordinates are percentages of the map, so the same geometry
-- works at every browser size and zoom level.
create or replace function private.roll30_visibility_polygon(
  target_scene uuid,
  origin_x numeric,
  origin_y numeric,
  radius numeric
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  ray integer;
  angle numeric;
  dx numeric;
  dy numeric;
  nearest numeric;
  obstacle public.scene_objects;
  sx numeric;
  sy numeric;
  denominator numeric;
  ray_distance numeric;
  segment_distance numeric;
  points jsonb := '[]'::jsonb;
  point_x numeric;
  point_y numeric;
begin
  for ray in 0..71 loop
    angle := 2 * pi() * ray / 72.0;
    dx := cos(angle);
    dy := sin(angle);
    nearest := radius;

    for obstacle in
      select *
      from public.scene_objects
      where scene_id = target_scene
        and object_type in ('wall', 'door')
        and config ? 'x2'
        and config ? 'y2'
        and (
          object_type = 'wall'
          or coalesce((state ->> 'active')::boolean, true)
        )
    loop
      sx := (obstacle.config ->> 'x2')::numeric - obstacle.x;
      sy := (obstacle.config ->> 'y2')::numeric - obstacle.y;
      denominator := dx * sy - dy * sx;
      if abs(denominator) > 0.000001 then
        ray_distance := ((obstacle.x - origin_x) * sy - (obstacle.y - origin_y) * sx) / denominator;
        segment_distance := ((obstacle.x - origin_x) * dy - (obstacle.y - origin_y) * dx) / denominator;
        if ray_distance >= 0 and ray_distance < nearest and segment_distance between 0 and 1 then
          nearest := ray_distance;
        end if;
      end if;
    end loop;

    point_x := greatest(0, least(100, origin_x + dx * nearest));
    point_y := greatest(0, least(100, origin_y + dy * nearest));
    points := points || jsonb_build_array(jsonb_build_array(round(point_x, 3), round(point_y, 3)));
  end loop;
  return points;
end;
$$;

create or replace function private.roll30_point_in_polygon(
  point_x numeric,
  point_y numeric,
  polygon jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  vertex_count integer := coalesce(jsonb_array_length(polygon), 0);
  i integer;
  j integer;
  xi numeric;
  yi numeric;
  xj numeric;
  yj numeric;
  inside boolean := false;
begin
  if vertex_count < 3 then return false; end if;
  j := vertex_count - 1;
  for i in 0..vertex_count - 1 loop
    xi := (polygon -> i ->> 0)::numeric;
    yi := (polygon -> i ->> 1)::numeric;
    xj := (polygon -> j ->> 0)::numeric;
    yj := (polygon -> j ->> 1)::numeric;
    if ((yi > point_y) <> (yj > point_y))
       and point_x < ((xj - xi) * (point_y - yi) / nullif(yj - yi, 0) + xi) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end;
$$;

create or replace function public.get_roll30_player_vision(target_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.sessions;
  scene_row public.scenes;
  own_character public.characters;
  own_token public.session_tokens;
  map_width numeric;
  sight_feet numeric;
  darkvision_feet numeric;
  base_radius numeric;
  light_radius numeric;
  ambient_light text;
  current_polygons jsonb := '[]'::jsonb;
  current_polygon jsonb;
  light public.scene_objects;
  reveals jsonb;
  explored jsonb;
  exploration_entry jsonb;
  light_is_blocked boolean;
begin
  select * into session_row from public.sessions where id = target_session;
  if session_row.id is null or not public.is_campaign_member(session_row.campaign_id) then
    raise exception 'Not permitted';
  end if;

  if public.is_campaign_gm(session_row.campaign_id) then
    return jsonb_build_object(
      'current', jsonb_build_array(jsonb_build_array(
        jsonb_build_array(0, 0), jsonb_build_array(100, 0),
        jsonb_build_array(100, 100), jsonb_build_array(0, 100)
      )),
      'explored', '[]'::jsonb,
      'reveals', '[]'::jsonb,
      'gm', true
    );
  end if;

  select * into scene_row from public.scenes where id = session_row.scene_id;
  select c.* into own_character
  from public.campaign_members m
  join public.characters c on c.id = m.character_id
  where m.campaign_id = session_row.campaign_id and m.user_id = auth.uid();
  select * into own_token
  from public.session_tokens
  where session_id = session_row.id and character_id = own_character.id;

  if own_token.id is null or scene_row.id is null then
    return jsonb_build_object('current', '[]'::jsonb, 'explored', '[]'::jsonb, 'reveals', '[]'::jsonb, 'gm', false);
  end if;

  map_width := greatest(1, coalesce((scene_row.config ->> 'map_width_ft')::numeric, 100));
  ambient_light := coalesce(scene_row.config ->> 'ambient_light', 'bright');
  sight_feet := greatest(0, coalesce((own_character.sheet ->> 'vision')::numeric, 30));
  darkvision_feet := greatest(0, coalesce((own_character.sheet ->> 'darkvision')::numeric, 0));
  base_radius := case ambient_light
    when 'dark' then darkvision_feet / map_width * 100
    when 'dim' then greatest(darkvision_feet, sight_feet / 2) / map_width * 100
    else sight_feet / map_width * 100
  end;

  if base_radius > 0 then
    current_polygon := private.roll30_visibility_polygon(
      scene_row.id, own_token.x, own_token.y, least(150, base_radius)
    );
    current_polygons := jsonb_build_array(current_polygon);
  end if;

  for light in
    select * from public.scene_objects
    where scene_id = scene_row.id
      and object_type = 'light'
      and coalesce((state ->> 'active')::boolean, true)
  loop
    light_is_blocked := exists (
      select 1 from public.scene_objects blocker
      where blocker.scene_id = scene_row.id
        and blocker.object_type in ('wall', 'door')
        and blocker.config ? 'x2' and blocker.config ? 'y2'
        and (blocker.object_type = 'wall' or coalesce((blocker.state ->> 'active')::boolean, true))
        and private.roll30_segments_intersect(
          own_token.x, own_token.y, light.x, light.y,
          blocker.x, blocker.y,
          (blocker.config ->> 'x2')::double precision,
          (blocker.config ->> 'y2')::double precision
        )
    );
    if not light_is_blocked
       and sqrt(power(light.x - own_token.x, 2) + power(light.y - own_token.y, 2)) <= sight_feet / map_width * 100 then
      light_radius := greatest(0, coalesce((light.config ->> 'radius')::numeric, 20)) / map_width * 100;
      if light_radius > 0 then
        current_polygons := current_polygons || jsonb_build_array(
          private.roll30_visibility_polygon(scene_row.id, light.x, light.y, least(150, light_radius))
        );
      end if;
    end if;
  end loop;

  select coalesce(jsonb_agg(reveal_row.polygon order by reveal_row.created_at), '[]'::jsonb)
  into reveals
  from public.session_reveals reveal_row
  where reveal_row.session_id = session_row.id
    and reveal_row.enabled
    and (cardinality(reveal_row.audience) = 0 or auth.uid() = any(reveal_row.audience));

  exploration_entry := jsonb_build_object('at', now(), 'polygons', current_polygons);
  insert into public.session_exploration(session_id, user_id, polygons)
  values(session_row.id, auth.uid(), jsonb_build_array(exploration_entry))
  on conflict(session_id, user_id) do update set
    polygons = case
      when jsonb_array_length(public.session_exploration.polygons) >= 50
        then (public.session_exploration.polygons - 0) || jsonb_build_array(exploration_entry)
      else public.session_exploration.polygons || jsonb_build_array(exploration_entry)
    end,
    updated_at = now()
  returning polygons into explored;

  return jsonb_build_object(
    'current', current_polygons,
    'explored', explored,
    'reveals', reveals,
    'gm', false,
    'ambient_light', ambient_light
  );
end;
$$;

-- Token rows are filtered with the same current-visibility polygons used by
-- the fog renderer. Explored-but-currently-dark areas never disclose creatures.
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

  if public.is_campaign_gm(session_row.campaign_id)
     or (
       coalesce((session_row.state ->> 'fog')::boolean, false) = false
       and coalesce((select config ->> 'ambient_light' from public.scenes where id = session_row.scene_id), 'bright') = 'bright'
     ) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', token.id, 'character_id', token.character_id, 'name', token.name,
      'x', token.x, 'y', token.y, 'speed', token.speed
    ) order by token.created_at, token.id), '[]'::jsonb)
    into result
    from public.session_tokens token
    where token.session_id = session_row.id;
    return result;
  end if;

  select character_id into own_character_id
  from public.campaign_members
  where campaign_id = session_row.campaign_id and user_id = auth.uid();
  select id into own_token_id
  from public.session_tokens
  where session_id = session_row.id and character_id = own_character_id;
  vision := public.get_roll30_player_vision(target_session);

  for candidate in select * from public.session_tokens where session_id = session_row.id loop
    visible := candidate.id = own_token_id;
    if not visible then
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
        'x', candidate.x, 'y', candidate.y, 'speed', candidate.speed
      ));
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.set_roll30_manual_reveal(
  target_session uuid,
  target_audience uuid[],
  reveal_polygon jsonb
)
returns public.session_reveals
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.sessions;
  member_id uuid;
  point jsonb;
  result public.session_reveals;
begin
  select * into session_row from public.sessions where id = target_session;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then
    raise exception 'Only the GM can reveal map regions';
  end if;
  if jsonb_typeof(reveal_polygon) <> 'array' or jsonb_array_length(reveal_polygon) < 3 then
    raise exception 'Reveal polygon needs at least three points';
  end if;
  for point in select value from jsonb_array_elements(reveal_polygon) loop
    if jsonb_typeof(point) <> 'array'
       or jsonb_array_length(point) <> 2
       or jsonb_typeof(point -> 0) <> 'number'
       or jsonb_typeof(point -> 1) <> 'number'
       or (point ->> 0)::numeric not between 0 and 100
       or (point ->> 1)::numeric not between 0 and 100 then
      raise exception 'Reveal coordinates must be numeric map percentages from 0 to 100';
    end if;
  end loop;
  foreach member_id in array coalesce(target_audience, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.campaign_members
      where campaign_id = session_row.campaign_id and user_id = member_id and role = 'player'
    ) then
      raise exception 'Reveal audience contains a non-player';
    end if;
  end loop;

  insert into public.session_reveals(session_id, audience, polygon)
  values(session_row.id, coalesce(target_audience, '{}'::uuid[]), reveal_polygon)
  returning * into result;
  update public.sessions set updated_at = now() where id = session_row.id;
  return result;
end;
$$;

create or replace function public.set_roll30_manual_reveal_enabled(
  target_reveal uuid,
  reveal_enabled boolean
)
returns public.session_reveals
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.session_reveals;
begin
  select reveal.* into result
  from public.session_reveals reveal
  join public.sessions session_row on session_row.id = reveal.session_id
  where reveal.id = target_reveal and public.is_campaign_gm(session_row.campaign_id);
  if result.id is null then raise exception 'Reveal not found'; end if;
  update public.session_reveals set enabled = reveal_enabled where id = result.id returning * into result;
  update public.sessions set updated_at = now() where id = result.session_id;
  return result;
end;
$$;

create or replace function public.clear_roll30_exploration(target_session uuid, target_user uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.sessions;
  deleted_count integer;
begin
  select * into session_row from public.sessions where id = target_session;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then
    raise exception 'Only the GM can clear explored fog';
  end if;
  if target_user is not null and not exists (
    select 1 from public.campaign_members
    where campaign_id = session_row.campaign_id and user_id = target_user and role = 'player'
  ) then
    raise exception 'Player is not in this campaign';
  end if;
  delete from public.session_exploration
  where session_id = target_session and (target_user is null or user_id = target_user);
  get diagnostics deleted_count = row_count;
  update public.sessions set updated_at = now() where id = session_row.id;
  return deleted_count;
end;
$$;

revoke all on function public.get_roll30_player_vision(uuid) from public, anon;
revoke all on function public.get_visible_roll30_tokens(uuid) from public, anon;
revoke all on function public.set_roll30_manual_reveal(uuid, uuid[], jsonb) from public, anon;
revoke all on function public.set_roll30_manual_reveal_enabled(uuid, boolean) from public, anon;
revoke all on function public.clear_roll30_exploration(uuid, uuid) from public, anon;
grant execute on function public.get_roll30_player_vision(uuid) to authenticated;
grant execute on function public.get_visible_roll30_tokens(uuid) to authenticated;
grant execute on function public.set_roll30_manual_reveal(uuid, uuid[], jsonb) to authenticated;
grant execute on function public.set_roll30_manual_reveal_enabled(uuid, boolean) to authenticated;
grant execute on function public.clear_roll30_exploration(uuid, uuid) to authenticated;
