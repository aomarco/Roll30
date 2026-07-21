alter table public.scenes add column deleted_at timestamptz;
create index scenes_campaign_lifecycle_idx on public.scenes(campaign_id, deleted_at, folder, created_at);

drop policy if exists "members read scenes" on public.scenes;
create policy "members read active scenes"
on public.scenes for select to authenticated
using (deleted_at is null and public.is_campaign_member(campaign_id));

create or replace function public.trash_roll30_scene(target_scene uuid)
returns public.scenes
language plpgsql
security definer
set search_path = public
as $$
declare result public.scenes;
begin
  select * into result from public.scenes where id = target_scene for update;
  if result.id is null or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only a campaign GM can trash scenes'; end if;
  if exists (select 1 from public.sessions where scene_id = result.id and status = 'active') then
    raise exception 'End the live session before moving this scene to trash';
  end if;
  update public.scenes set deleted_at = now(), updated_at = now() where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.restore_roll30_scene(target_scene uuid)
returns public.scenes
language plpgsql
security definer
set search_path = public
as $$
declare result public.scenes;
begin
  select * into result from public.scenes where id = target_scene for update;
  if result.id is null or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only a campaign GM can restore scenes'; end if;
  update public.scenes set deleted_at = null, updated_at = now() where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.list_roll30_trashed_scenes(target_campaign uuid)
returns setof public.scenes
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'Only a campaign GM can view trashed scenes'; end if;
  return query select * from public.scenes where campaign_id = target_campaign and deleted_at is not null order by deleted_at desc;
end;
$$;

create or replace function public.delete_roll30_scene_permanently(target_scene uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare scene_campaign uuid; trashed_at timestamptz;
begin
  select campaign_id, deleted_at into scene_campaign, trashed_at from public.scenes where id = target_scene for update;
  if scene_campaign is null or not public.is_campaign_gm(scene_campaign) then raise exception 'Only a campaign GM can permanently delete scenes'; end if;
  if trashed_at is null then raise exception 'Move the scene to trash before deleting it permanently'; end if;
  delete from public.scenes where id = target_scene;
end;
$$;

revoke all on function public.trash_roll30_scene(uuid) from public, anon;
revoke all on function public.restore_roll30_scene(uuid) from public, anon;
revoke all on function public.list_roll30_trashed_scenes(uuid) from public, anon;
revoke all on function public.delete_roll30_scene_permanently(uuid) from public, anon;
grant execute on function public.trash_roll30_scene(uuid) to authenticated;
grant execute on function public.restore_roll30_scene(uuid) to authenticated;
grant execute on function public.list_roll30_trashed_scenes(uuid) to authenticated;
grant execute on function public.delete_roll30_scene_permanently(uuid) to authenticated;
