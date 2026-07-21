alter table public.campaigns add column archived_at timestamptz;
alter table public.campaigns add column deleted_at timestamptz;
create index campaigns_owner_lifecycle_idx on public.campaigns(owner_id, deleted_at, archived_at);

-- Trashed campaigns immediately stop authorizing access to their child data.
create or replace function public.is_campaign_member(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members member
    join public.campaigns campaign on campaign.id = member.campaign_id
    where member.campaign_id = target_campaign
      and member.user_id = (select auth.uid())
      and campaign.deleted_at is null
  );
$$;

create or replace function public.is_campaign_gm(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members member
    join public.campaigns campaign on campaign.id = member.campaign_id
    where member.campaign_id = target_campaign
      and member.user_id = (select auth.uid())
      and member.role = 'gm'
      and campaign.deleted_at is null
  );
$$;

create policy "owners read owned campaigns"
on public.campaigns for select to authenticated
using (owner_id = (select auth.uid()));

create or replace function public.regenerate_roll30_join_code(target_campaign uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare result public.campaigns;
begin
  select * into result from public.campaigns where id = target_campaign for update;
  if result.id is null or result.deleted_at is not null then raise exception 'Campaign not found'; end if;
  if not public.is_campaign_gm(result.id) then raise exception 'Only a campaign GM can rotate the join code'; end if;
  loop
    begin
      update public.campaigns
      set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), updated_at = now()
      where id = result.id returning * into result;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  return result;
end;
$$;

create or replace function public.set_roll30_campaign_archived(target_campaign uuid, should_archive boolean)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare result public.campaigns;
begin
  select * into result from public.campaigns where id = target_campaign for update;
  if result.id is null or result.owner_id is distinct from auth.uid() or result.deleted_at is not null then
    raise exception 'Only the campaign owner can change its archive state';
  end if;
  update public.campaigns set archived_at = case when should_archive then now() else null end, updated_at = now()
  where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.trash_roll30_campaign(target_campaign uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare result public.campaigns;
begin
  select * into result from public.campaigns where id = target_campaign for update;
  if result.id is null or result.owner_id is distinct from auth.uid() then
    raise exception 'Only the campaign owner can move it to trash';
  end if;
  update public.campaigns set deleted_at = now(), archived_at = null, updated_at = now()
  where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.restore_roll30_campaign(target_campaign uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare result public.campaigns;
begin
  select * into result from public.campaigns where id = target_campaign for update;
  if result.id is null or result.owner_id is distinct from auth.uid() then
    raise exception 'Only the campaign owner can restore it';
  end if;
  update public.campaigns set deleted_at = null, updated_at = now()
  where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.leave_roll30_campaign(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare campaign_owner uuid;
begin
  select owner_id into campaign_owner from public.campaigns where id = target_campaign;
  if campaign_owner is null then raise exception 'Campaign not found'; end if;
  if campaign_owner is not distinct from auth.uid() then raise exception 'The campaign owner cannot leave their own campaign'; end if;
  delete from public.campaign_members where campaign_id = target_campaign and user_id = auth.uid();
  if not found then raise exception 'You are not a member of this campaign'; end if;
end;
$$;

create or replace function public.set_roll30_member_role(target_campaign uuid, target_user uuid, target_role text)
returns public.campaign_members
language plpgsql
security definer
set search_path = public
as $$
declare campaign_owner uuid; result public.campaign_members;
begin
  if target_role not in ('gm', 'player') then raise exception 'Choose GM or player'; end if;
  select owner_id into campaign_owner from public.campaigns where id = target_campaign and deleted_at is null;
  if campaign_owner is distinct from auth.uid() then raise exception 'Only the campaign owner can change member roles'; end if;
  if target_user is not distinct from campaign_owner then raise exception 'The campaign owner must remain a GM'; end if;
  update public.campaign_members set role = target_role
  where campaign_id = target_campaign and user_id = target_user
  returning * into result;
  if result.user_id is null then raise exception 'Campaign member not found'; end if;
  return result;
end;
$$;

create or replace function public.remove_roll30_campaign_member(target_campaign uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare campaign_owner uuid; target_member_role text;
begin
  select owner_id into campaign_owner from public.campaigns where id = target_campaign and deleted_at is null;
  if campaign_owner is null or not public.is_campaign_gm(target_campaign) then raise exception 'Only a campaign GM can remove members'; end if;
  if target_user is not distinct from campaign_owner then raise exception 'The campaign owner cannot be removed'; end if;
  select role into target_member_role from public.campaign_members where campaign_id = target_campaign and user_id = target_user;
  if target_member_role is null then raise exception 'Campaign member not found'; end if;
  if target_member_role = 'gm' and campaign_owner is distinct from auth.uid() then raise exception 'Only the campaign owner can remove another GM'; end if;
  delete from public.campaign_members where campaign_id = target_campaign and user_id = target_user;
end;
$$;

revoke all on function public.regenerate_roll30_join_code(uuid) from public, anon;
revoke all on function public.set_roll30_campaign_archived(uuid, boolean) from public, anon;
revoke all on function public.trash_roll30_campaign(uuid) from public, anon;
revoke all on function public.restore_roll30_campaign(uuid) from public, anon;
revoke all on function public.leave_roll30_campaign(uuid) from public, anon;
revoke all on function public.set_roll30_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_roll30_campaign_member(uuid, uuid) from public, anon;
grant execute on function public.regenerate_roll30_join_code(uuid) to authenticated;
grant execute on function public.set_roll30_campaign_archived(uuid, boolean) to authenticated;
grant execute on function public.trash_roll30_campaign(uuid) to authenticated;
grant execute on function public.restore_roll30_campaign(uuid) to authenticated;
grant execute on function public.leave_roll30_campaign(uuid) to authenticated;
grant execute on function public.set_roll30_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_roll30_campaign_member(uuid, uuid) to authenticated;
