create table public.scene_templates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  scene_type text not null check (scene_type in ('playing','battle')),
  background_asset_id uuid references public.campaign_assets(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  objects jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index scene_templates_campaign_idx on public.scene_templates(campaign_id,created_at desc);
alter table public.scene_templates enable row level security;
grant select,insert,update,delete on public.scene_templates to authenticated;
create policy "members read scene templates" on public.scene_templates for select to authenticated using (public.is_campaign_member(campaign_id));
create policy "gms manage scene templates" on public.scene_templates for all to authenticated using (public.is_campaign_gm(campaign_id)) with check (public.is_campaign_gm(campaign_id) and created_by = (select auth.uid()));

create or replace function public.save_roll30_scene_template(source_scene uuid, template_name text)
returns public.scene_templates language plpgsql security definer set search_path = public as $$
declare source public.scenes; result public.scene_templates; object_data jsonb;
begin
  select * into source from public.scenes where id=source_scene;
  if source.id is null or not public.is_campaign_gm(source.campaign_id) then raise exception 'Only the GM can save scene templates'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'object_type',object_type,'x',x,'y',y,'state',state,'config',config)),'[]'::jsonb) into object_data from public.scene_objects where scene_id=source.id;
  insert into public.scene_templates(campaign_id,name,scene_type,background_asset_id,config,objects,created_by) values(source.campaign_id,template_name,source.scene_type,source.background_asset_id,source.config,object_data,auth.uid()) returning * into result;
  return result;
end;
$$;

create or replace function public.create_roll30_scene_from_template(template_id uuid, scene_name text)
returns public.scenes language plpgsql security definer set search_path = public as $$
declare template public.scene_templates; result public.scenes;
begin
  select * into template from public.scene_templates where id=template_id;
  if template.id is null or not public.is_campaign_gm(template.campaign_id) then raise exception 'Only the GM can use scene templates'; end if;
  insert into public.scenes(campaign_id,name,scene_type,background_asset_id,config,created_by) values(template.campaign_id,scene_name,template.scene_type,template.background_asset_id,template.config,auth.uid()) returning * into result;
  insert into public.scene_objects(scene_id,name,object_type,x,y,state,config) select result.id,name,object_type,x,y,state,config from jsonb_to_recordset(template.objects) as x(name text,object_type text,x integer,y integer,state jsonb,config jsonb);
  return result;
end;
$$;

revoke all on function public.save_roll30_scene_template(uuid,text) from public,anon;
revoke all on function public.create_roll30_scene_from_template(uuid,text) from public,anon;
grant execute on function public.save_roll30_scene_template(uuid,text) to authenticated;
grant execute on function public.create_roll30_scene_from_template(uuid,text) to authenticated;
