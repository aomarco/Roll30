create or replace function public.duplicate_roll30_scene(source_scene uuid)
returns public.scenes
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.scenes;
  created public.scenes;
begin
  select * into source from public.scenes where id = source_scene;
  if source.id is null then raise exception 'Scene not found'; end if;
  if not public.is_campaign_gm(source.campaign_id) then raise exception 'Only the GM can duplicate scenes'; end if;
  insert into public.scenes(campaign_id,name,scene_type,folder,background_asset_id,config,created_by)
  values(source.campaign_id,source.name || ' copy',source.scene_type,source.folder,source.background_asset_id,source.config,auth.uid())
  returning * into created;
  insert into public.scene_objects(scene_id,name,object_type,x,y,state,config)
  select created.id,name,object_type,x,y,state,config from public.scene_objects where scene_id = source.id;
  return created;
end;
$$;

revoke all on function public.duplicate_roll30_scene(uuid) from public, anon;
grant execute on function public.duplicate_roll30_scene(uuid) to authenticated;
