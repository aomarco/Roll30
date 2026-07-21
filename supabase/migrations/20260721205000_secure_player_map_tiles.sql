create table public.scene_map_tiles (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  asset_id uuid not null references public.campaign_assets(id) on delete cascade,
  tile_column integer not null check (tile_column >= 0),
  tile_row integer not null check (tile_row >= 0),
  grid_columns integer not null check (grid_columns between 1 and 64),
  grid_rows integer not null check (grid_rows between 1 and 64),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  unique(scene_id, tile_column, tile_row)
);

create table public.session_map_tile_access (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tile_id uuid not null references public.scene_map_tiles(id) on delete cascade,
  visibility text not null check (visibility in ('current', 'explored')),
  updated_at timestamptz not null default now(),
  primary key(session_id, user_id, tile_id)
);

create index scene_map_tiles_scene_idx on public.scene_map_tiles(scene_id);
create index session_map_tile_access_user_idx on public.session_map_tile_access(user_id, session_id);
alter table public.scene_map_tiles enable row level security;
alter table public.session_map_tile_access enable row level security;
grant select, insert, update, delete on public.scene_map_tiles to authenticated;
grant select on public.session_map_tile_access to authenticated;
revoke insert, update, delete on public.session_map_tile_access from authenticated;

create policy "gms manage secure map tiles"
on public.scene_map_tiles for all to authenticated
using (
  exists (
    select 1 from public.scenes scene
    where scene.id = scene_id and public.is_campaign_gm(scene.campaign_id)
  )
)
with check (
  exists (
    select 1 from public.scenes scene
    where scene.id = scene_id and public.is_campaign_gm(scene.campaign_id)
  )
);

create policy "players read authorized map tiles"
on public.scene_map_tiles for select to authenticated
using (
  exists (
    select 1 from public.session_map_tile_access access_row
    where access_row.tile_id = id and access_row.user_id = (select auth.uid())
  )
);

create policy "members read own map tile access"
on public.session_map_tile_access for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.sessions session_row
    where session_row.id = session_id and public.is_campaign_gm(session_row.campaign_id)
  )
);

create or replace function public.get_roll30_visible_map_tiles(target_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.sessions;
  tile public.scene_map_tiles;
  vision jsonb;
  polygon jsonb;
  exploration_entry jsonb;
  center_x numeric;
  center_y numeric;
  is_current boolean;
  is_explored boolean;
  result jsonb;
begin
  select * into session_row from public.sessions where id = target_session;
  if session_row.id is null or not public.is_campaign_member(session_row.campaign_id) then
    raise exception 'Not permitted';
  end if;

  if public.is_campaign_gm(session_row.campaign_id) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', tile_row.id,
      'storage_path', tile_row.storage_path,
      'column', tile_row.tile_column,
      'row', tile_row.tile_row,
      'columns', tile_row.grid_columns,
      'rows', tile_row.grid_rows,
      'visibility', 'current'
    ) order by tile_row.tile_row, tile_row.tile_column), '[]'::jsonb)
    into result
    from public.scene_map_tiles tile_row
    where tile_row.scene_id = session_row.scene_id;
    return result;
  end if;

  vision := public.get_roll30_player_vision(target_session);
  delete from public.session_map_tile_access
  where session_id = session_row.id and user_id = auth.uid();

  for tile in
    select * from public.scene_map_tiles where scene_id = session_row.scene_id
  loop
    center_x := (tile.tile_column + 0.5) / tile.grid_columns * 100;
    center_y := (tile.tile_row + 0.5) / tile.grid_rows * 100;
    is_current := false;
    is_explored := false;

    for polygon in
      select value from jsonb_array_elements(
        coalesce(vision -> 'current', '[]'::jsonb) || coalesce(vision -> 'reveals', '[]'::jsonb)
      )
    loop
      if private.roll30_point_in_polygon(center_x, center_y, polygon) then
        is_current := true;
        exit;
      end if;
    end loop;

    if not is_current then
      for exploration_entry in
        select value from jsonb_array_elements(coalesce(vision -> 'explored', '[]'::jsonb))
      loop
        for polygon in
          select value from jsonb_array_elements(coalesce(exploration_entry -> 'polygons', '[]'::jsonb))
        loop
          if private.roll30_point_in_polygon(center_x, center_y, polygon) then
            is_explored := true;
            exit;
          end if;
        end loop;
        exit when is_explored;
      end loop;
    end if;

    if is_current or is_explored then
      insert into public.session_map_tile_access(session_id, user_id, tile_id, visibility)
      values(session_row.id, auth.uid(), tile.id, case when is_current then 'current' else 'explored' end)
      on conflict(session_id, user_id, tile_id) do update set
        visibility = excluded.visibility,
        updated_at = now();
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', tile_row.id,
    'storage_path', tile_row.storage_path,
    'column', tile_row.tile_column,
    'row', tile_row.tile_row,
    'columns', tile_row.grid_columns,
    'rows', tile_row.grid_rows,
    'visibility', access_row.visibility
  ) order by tile_row.tile_row, tile_row.tile_column), '[]'::jsonb)
  into result
  from public.session_map_tile_access access_row
  join public.scene_map_tiles tile_row on tile_row.id = access_row.tile_id
  where access_row.session_id = session_row.id and access_row.user_id = auth.uid();
  return result;
end;
$$;

-- A fogged/dark active background is never readable as a complete image by a
-- player. The tile RPC above grants only the subset represented by their sight
-- and explored-fog history. Explicitly revealed library media remains shared.
drop policy if exists "members read revealed or live campaign assets" on public.campaign_assets;
create policy "members read revealed or safe live campaign assets"
on public.campaign_assets for select to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and (
      visible_to_players
      or exists (
        select 1
        from public.scenes scene
        join public.sessions session_row on session_row.scene_id = scene.id and session_row.status = 'active'
        where scene.background_asset_id = campaign_assets.id
          and session_row.campaign_id = campaign_assets.campaign_id
          and coalesce((session_row.state ->> 'fog')::boolean, false) = false
          and coalesce(scene.config ->> 'ambient_light', 'bright') = 'bright'
      )
    )
  )
);

drop policy if exists "members read revealed or live campaign media" on storage.objects;
create policy "members read revealed assets or authorized map tiles"
on storage.objects for select to authenticated
using (
  bucket_id = 'campaign-media'
  and (
    exists (
      select 1 from public.campaign_assets asset
      where asset.storage_path = name
        and (
          asset.visible_to_players
          or public.is_campaign_gm(asset.campaign_id)
          or exists (
            select 1
            from public.scenes scene
            join public.sessions session_row on session_row.scene_id = scene.id and session_row.status = 'active'
            where scene.background_asset_id = asset.id
              and session_row.campaign_id = asset.campaign_id
              and public.is_campaign_member(asset.campaign_id)
              and coalesce((session_row.state ->> 'fog')::boolean, false) = false
              and coalesce(scene.config ->> 'ambient_light', 'bright') = 'bright'
          )
        )
    )
    or exists (
      select 1
      from public.scene_map_tiles tile
      join public.scenes scene on scene.id = tile.scene_id
      where tile.storage_path = name
        and (
          public.is_campaign_gm(scene.campaign_id)
          or exists (
            select 1 from public.session_map_tile_access access_row
            where access_row.tile_id = tile.id and access_row.user_id = (select auth.uid())
          )
        )
    )
  )
);

revoke all on function public.get_roll30_visible_map_tiles(uuid) from public, anon;
grant execute on function public.get_roll30_visible_map_tiles(uuid) to authenticated;
