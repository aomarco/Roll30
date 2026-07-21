alter table public.scene_objects
  add column layer text not null default 'objects' check (layer in ('background','objects','tokens','gm')),
  add column z_index integer not null default 0,
  add column visible_to_players boolean not null default false;

create index scene_objects_layer_order_idx on public.scene_objects(scene_id,layer,z_index);

drop policy if exists "members read scene objects" on public.scene_objects;
create policy "members read revealed scene objects" on public.scene_objects for select to authenticated
using (
  visible_to_players
  and exists (
    select 1 from public.scenes s
    where s.id=scene_id and public.is_campaign_member(s.campaign_id) and s.deleted_at is null
  )
);

create or replace function public.move_roll30_scene_object(target_object uuid,target_x integer,target_y integer,target_layer text default null,target_z integer default null)
returns public.scene_objects language plpgsql security definer set search_path=public as $$
declare object_row public.scene_objects; scene_row public.scenes; result public.scene_objects;
begin
  select * into object_row from public.scene_objects where id=target_object for update;
  if object_row.id is null then raise exception 'Scene object not found'; end if;
  select * into scene_row from public.scenes where id=object_row.scene_id;
  if not public.is_campaign_gm(scene_row.campaign_id) then raise exception 'Only a GM can move scene objects'; end if;
  if target_layer is not null and target_layer not in ('background','objects','tokens','gm') then raise exception 'Unknown scene layer'; end if;
  update public.scene_objects set x=greatest(0,least(100,target_x)),y=greatest(0,least(100,target_y)),layer=coalesce(target_layer,layer),z_index=coalesce(target_z,z_index) where id=target_object returning * into result;
  return result;
end; $$;

revoke all on function public.move_roll30_scene_object(uuid,integer,integer,text,integer) from public,anon;
grant execute on function public.move_roll30_scene_object(uuid,integer,integer,text,integer) to authenticated;
