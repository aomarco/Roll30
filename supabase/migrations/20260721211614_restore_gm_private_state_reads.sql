drop policy "members read revealed scene objects" on public.scene_objects;
create policy "authorized scene object reads" on public.scene_objects for select to authenticated using(
  exists(select 1 from public.scenes scene where scene.id=scene_id and (
    public.is_campaign_gm(scene.campaign_id)
    or (visible_to_players and scene.deleted_at is null and public.is_campaign_member(scene.campaign_id))
  ))
);

drop policy "players read authorized map tiles" on public.scene_map_tiles;
create policy "authorized secure map tile reads" on public.scene_map_tiles for select to authenticated using(
  exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id))
  or exists(select 1 from public.session_map_tile_access access_row where access_row.tile_id=id and access_row.user_id=(select auth.uid()))
);

drop policy "players read own session token" on public.session_tokens;
create policy "authorized session token reads" on public.session_tokens for select to authenticated using(
  exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id))
  or exists(select 1 from public.characters character where character.id=character_id and character.owner_id=(select auth.uid()))
);
