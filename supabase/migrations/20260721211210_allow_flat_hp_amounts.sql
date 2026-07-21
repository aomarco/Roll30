create or replace function public.resolve_roll30_hp_change(target_character uuid, change_kind text, dice_expression text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters; before_hp integer; amount integer; next_hp integer; active_session uuid; result jsonb; normalized text;
begin
  select * into character_row from public.characters where id=target_character for update;
  if character_row.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(character_row.campaign_id) or character_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  if change_kind not in ('damage','healing') then raise exception 'Choose damage or healing'; end if;
  normalized:=trim(coalesce(dice_expression,''));
  if normalized~'^[0-9]{1,6}$' then amount:=normalized::integer;
  else amount:=private.roll30_dice(normalized,false); end if;
  if amount<0 or amount>999999 then raise exception 'HP amount must be between 0 and 999999'; end if;
  before_hp:=coalesce(character_row.hp_current,0);
  next_hp:=case when change_kind='damage' then greatest(0,before_hp-amount) else least(coalesce(character_row.hp_max,999999),before_hp+amount) end;
  update public.characters set hp_current=next_hp,updated_at=now() where id=character_row.id;
  select id into active_session from public.sessions where campaign_id=character_row.campaign_id and status='active';
  result:=jsonb_build_object('character_id',character_row.id,'name',character_row.name,'kind',change_kind,
    'expression',normalized,'amount',amount,'from_hp',before_hp,'hp',next_hp);
  if active_session is not null then
    insert into public.session_events(session_id,actor_id,event_type,payload)
    values(active_session,auth.uid(),'hp_changed',result||jsonb_build_object('delta',next_hp-before_hp,'source','dice'));
  end if;
  return result;
end;
$$;
