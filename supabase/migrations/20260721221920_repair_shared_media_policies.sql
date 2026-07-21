create index scene_states_created_by_idx on public.scene_states(created_by);

drop policy if exists "members read revealed or safe live campaign assets" on public.campaign_assets;
drop policy if exists "members read addressed or safe live campaign assets" on public.campaign_assets;
create policy "members read addressed or safe live campaign assets"
on public.campaign_assets for select to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and (
      (visible_to_players and (cardinality(audience)=0 or (select auth.uid())=any(audience)))
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
drop policy if exists "members read addressed assets or authorized map tiles" on storage.objects;
create policy "members read addressed assets or authorized map tiles"
on storage.objects for select to authenticated
using (
  bucket_id='campaign-media' and (
    exists (
      select 1 from public.campaign_assets asset
      where asset.storage_path=name and (
        public.is_campaign_gm(asset.campaign_id)
        or (
          public.is_campaign_member(asset.campaign_id)
          and asset.visible_to_players
          and (cardinality(asset.audience)=0 or (select auth.uid())=any(asset.audience))
        )
        or exists (
          select 1 from public.scenes scene
          join public.sessions session_row on session_row.scene_id=scene.id and session_row.status='active'
          where scene.background_asset_id=asset.id
            and session_row.campaign_id=asset.campaign_id
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
      where tile.storage_path=name and (
        public.is_campaign_gm(scene.campaign_id)
        or exists (
          select 1 from public.session_map_tile_access access_row
          where access_row.tile_id=tile.id and access_row.user_id=(select auth.uid())
        )
      )
    )
  )
);
