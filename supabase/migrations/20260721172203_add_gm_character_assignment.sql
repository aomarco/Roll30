-- Assigning a character must be a GM-only action and the PC must belong to
-- the same campaign as the member receiving it.
create or replace function public.assign_roll30_character(target_member uuid, target_character uuid)
returns public.campaign_members
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_character public.characters;
  selected_member public.campaign_members;
begin
  select * into selected_character from public.characters where id = target_character;
  if selected_character.id is null or selected_character.kind <> 'pc' then
    raise exception 'Choose a player character from this campaign';
  end if;

  if not public.is_campaign_gm(selected_character.campaign_id) then
    raise exception 'Only the GM can assign player characters';
  end if;

  select * into selected_member
  from public.campaign_members
  where campaign_id = selected_character.campaign_id and user_id = target_member
  for update;
  if selected_member.user_id is null then
    raise exception 'That member does not belong to this campaign';
  end if;

  update public.campaign_members
  set character_id = selected_character.id
  where campaign_id = selected_member.campaign_id and user_id = selected_member.user_id
  returning * into selected_member;
  return selected_member;
end;
$$;

revoke all on function public.assign_roll30_character(uuid, uuid) from public, anon;
grant execute on function public.assign_roll30_character(uuid, uuid) to authenticated;
