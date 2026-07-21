alter table public.campaign_notes
  add column rule_status text not null default 'active'
  check(rule_status in ('draft','active','retired'));

create or replace function public.set_roll30_member_character(
  target_campaign uuid,
  target_member uuid,
  target_character uuid default null
)
returns public.campaign_members
language plpgsql security definer set search_path=public
as $$
declare member_row public.campaign_members; character_row public.characters; previous_character uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'Only a GM can assign player characters'; end if;
  select * into member_row from public.campaign_members
  where campaign_id=target_campaign and user_id=target_member and role='player' for update;
  if member_row.user_id is null then raise exception 'Choose a player in this campaign'; end if;
  previous_character:=member_row.character_id;
  if target_character is not null then
    select * into character_row from public.characters where id=target_character and campaign_id=target_campaign and kind='pc' for update;
    if character_row.id is null then raise exception 'Choose a player character from this campaign'; end if;
    if exists(select 1 from public.campaign_members where campaign_id=target_campaign and character_id=target_character and user_id<>target_member) then
      raise exception 'That character is already assigned to another player';
    end if;
  end if;
  update public.campaign_members set character_id=target_character
  where campaign_id=target_campaign and user_id=target_member returning * into member_row;
  if previous_character is not null and previous_character is distinct from target_character then
    update public.characters set owner_id=null,updated_at=now() where id=previous_character and owner_id=target_member;
  end if;
  if target_character is not null then
    update public.characters set owner_id=target_member,updated_at=now() where id=target_character;
  end if;
  return member_row;
end;
$$;

revoke all on function public.set_roll30_member_character(uuid,uuid,uuid) from public,anon;
grant execute on function public.set_roll30_member_character(uuid,uuid,uuid) to authenticated;
