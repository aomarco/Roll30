create or replace function public.duplicate_roll30_scene(source_scene uuid)
returns public.scenes
language plpgsql security definer set search_path=public
as $$
declare source public.scenes; created public.scenes;
begin
  select * into source from public.scenes where id=source_scene and deleted_at is null;
  if source.id is null then raise exception 'Scene not found'; end if;
  if not public.is_campaign_gm(source.campaign_id) then raise exception 'Only the GM can duplicate scenes'; end if;
  insert into public.scenes(campaign_id,name,scene_type,folder,background_asset_id,config,created_by)
  values(source.campaign_id,source.name||' copy',source.scene_type,source.folder,source.background_asset_id,source.config,auth.uid())
  returning * into created;
  insert into public.scene_objects(scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players)
  select created.id,name,object_type,x,y,state,config,layer,z_index,visible_to_players
  from public.scene_objects where scene_id=source.id;
  return created;
end;
$$;

create or replace function public.save_roll30_scene_template(source_scene uuid,template_name text)
returns public.scene_templates
language plpgsql security definer set search_path=public
as $$
declare source public.scenes; result public.scene_templates; object_data jsonb;
begin
  select * into source from public.scenes where id=source_scene and deleted_at is null;
  if source.id is null or not public.is_campaign_gm(source.campaign_id) then raise exception 'Only the GM can save scene templates'; end if;
  if length(trim(template_name)) not between 1 and 160 then raise exception 'Template name is required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',name,'object_type',object_type,'x',x,'y',y,'state',state,'config',config,
    'layer',layer,'z_index',z_index,'visible_to_players',visible_to_players
  ) order by z_index,created_at,id),'[]'::jsonb) into object_data
  from public.scene_objects where scene_id=source.id;
  insert into public.scene_templates(campaign_id,name,scene_type,background_asset_id,config,objects,created_by)
  values(source.campaign_id,trim(template_name),source.scene_type,source.background_asset_id,source.config,object_data,auth.uid())
  returning * into result;
  return result;
end;
$$;

create or replace function public.create_roll30_scene_from_template(template_id uuid,scene_name text)
returns public.scenes
language plpgsql security definer set search_path=public
as $$
declare template public.scene_templates; result public.scenes;
begin
  select * into template from public.scene_templates where id=template_id;
  if template.id is null or not public.is_campaign_gm(template.campaign_id) then raise exception 'Only the GM can use scene templates'; end if;
  if length(trim(scene_name)) not between 1 and 160 then raise exception 'Scene name is required'; end if;
  insert into public.scenes(campaign_id,name,scene_type,background_asset_id,config,created_by)
  values(template.campaign_id,trim(scene_name),template.scene_type,template.background_asset_id,template.config,auth.uid())
  returning * into result;
  insert into public.scene_objects(scene_id,name,object_type,x,y,state,config,layer,z_index,visible_to_players)
  select result.id,item.name,item.object_type,item.x,item.y,coalesce(item.state,'{}'::jsonb),coalesce(item.config,'{}'::jsonb),
    coalesce(item.layer,'objects'),coalesce(item.z_index,0),coalesce(item.visible_to_players,false)
  from jsonb_to_recordset(template.objects) as item(
    name text,object_type text,x integer,y integer,state jsonb,config jsonb,layer text,z_index integer,visible_to_players boolean
  );
  return result;
end;
$$;
