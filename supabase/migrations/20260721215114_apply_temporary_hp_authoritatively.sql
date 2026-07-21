create or replace function public.change_roll30_hp(target_character uuid,delta integer)
returns public.characters
language plpgsql security definer set search_path=public
as $$
declare result public.characters;before_hp integer;before_temp integer;next_hp integer;next_temp integer;active_session uuid;next_sheet jsonb;
begin
  select * into result from public.characters where id=target_character for update;
  if result.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(result.campaign_id) or result.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  before_hp:=coalesce(result.hp_current,0);before_temp:=greatest(0,coalesce((result.sheet->>'temp_hp')::integer,0));
  if delta<0 then next_temp:=greatest(0,before_temp+delta);next_hp:=greatest(0,before_hp-greatest(0,-delta-before_temp));
  else next_temp:=before_temp;next_hp:=least(coalesce(result.hp_max,999999),before_hp+delta);end if;
  next_sheet:=jsonb_set(result.sheet,'{temp_hp}',to_jsonb(next_temp),true);
  if before_hp=0 and next_hp>0 then next_sheet:=jsonb_set(next_sheet,'{death_saves}','{"successes":0,"failures":0}'::jsonb,true); end if;
  update public.characters set hp_current=next_hp,sheet=next_sheet,
    sheet_revision=sheet_revision+case when next_sheet is distinct from result.sheet then 1 else 0 end,updated_at=now()
  where id=target_character returning * into result;
  select id into active_session from public.sessions where campaign_id=result.campaign_id and status='active';
  if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload)
    values(active_session,auth.uid(),'hp_changed',jsonb_build_object('character_id',result.id,'name',result.name,
      'from_hp',before_hp,'hp',next_hp,'from_temp_hp',before_temp,'temp_hp',next_temp,
      'absorbed_by_temp',before_temp-next_temp,'delta',next_hp-before_hp,'source','manual'));end if;
  return result;
end;
$$;

create or replace function public.resolve_roll30_hp_change(target_character uuid,change_kind text,dice_expression text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters;before_hp integer;before_temp integer;amount integer;next_hp integer;next_temp integer;active_session uuid;result jsonb;next_sheet jsonb;
begin
  select * into character_row from public.characters where id=target_character for update;
  if character_row.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(character_row.campaign_id) or character_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  if change_kind not in ('damage','healing') then raise exception 'Choose damage or healing'; end if;
  amount:=private.roll30_dice(dice_expression,false);if amount<0 then raise exception 'HP amount cannot be negative'; end if;
  before_hp:=coalesce(character_row.hp_current,0);before_temp:=greatest(0,coalesce((character_row.sheet->>'temp_hp')::integer,0));
  if change_kind='damage' then next_temp:=greatest(0,before_temp-amount);next_hp:=greatest(0,before_hp-greatest(0,amount-before_temp));
  else next_temp:=before_temp;next_hp:=least(coalesce(character_row.hp_max,999999),before_hp+amount);end if;
  next_sheet:=jsonb_set(character_row.sheet,'{temp_hp}',to_jsonb(next_temp),true);
  if change_kind='healing' and before_hp=0 and next_hp>0 then next_sheet:=jsonb_set(next_sheet,'{death_saves}','{"successes":0,"failures":0}'::jsonb,true);end if;
  update public.characters set hp_current=next_hp,sheet=next_sheet,
    sheet_revision=sheet_revision+case when next_sheet is distinct from character_row.sheet then 1 else 0 end,updated_at=now()
  where id=character_row.id;
  result:=jsonb_build_object('character_id',character_row.id,'name',character_row.name,'kind',change_kind,'expression',dice_expression,
    'amount',amount,'from_hp',before_hp,'hp',next_hp,'from_temp_hp',before_temp,'temp_hp',next_temp,'absorbed_by_temp',before_temp-next_temp);
  select id into active_session from public.sessions where campaign_id=character_row.campaign_id and status='active';
  if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload)
    values(active_session,auth.uid(),'hp_changed',result||jsonb_build_object('delta',next_hp-before_hp,'source','dice'));end if;
  return result;
end;
$$;

create or replace function public.resolve_roll30_combat_attack(attacker_id uuid,target_id uuid,attack_index integer default 0,advantage integer default 0)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare attacker public.characters;target public.characters;attack jsonb;first_roll integer;second_roll integer;natural_roll integer;bonus integer;total integer;hit boolean;critical boolean;damage integer:=0;dice text;active_session uuid;result jsonb;before_hp integer;next_hp integer;before_temp integer;next_temp integer;concentration_name text;concentration_dc integer;concentration_roll integer;concentration_success boolean;concentration_bonus integer;next_sheet jsonb;
begin
  select * into attacker from public.characters where id=attacker_id for update;select * into target from public.characters where id=target_id for update;
  if attacker.id is null or target.id is null or attacker.campaign_id<>target.campaign_id then raise exception 'Combatants must share a campaign';end if;
  if not (public.is_campaign_gm(attacker.campaign_id) or attacker.owner_id is not distinct from auth.uid()) then raise exception 'You can only attack with your own character';end if;
  if advantage not between -1 and 1 then raise exception 'Advantage must be -1, 0, or 1';end if;
  attack:=coalesce(attacker.sheet->'attacks'->attack_index,attacker.sheet->'attack');if attack is null then raise exception 'This character has no configured attack';end if;
  first_roll:=floor(random()*20+1)::integer;second_roll:=floor(random()*20+1)::integer;natural_roll:=case when advantage=1 then greatest(first_roll,second_roll) when advantage=-1 then least(first_roll,second_roll) else first_roll end;
  bonus:=coalesce((attack->>'bonus')::integer,0);total:=natural_roll+bonus;critical:=natural_roll=20;hit:=natural_roll<>1 and (critical or total>=coalesce((target.sheet->>'armor_class')::integer,10));
  before_hp:=coalesce(target.hp_current,0);before_temp:=greatest(0,coalesce((target.sheet->>'temp_hp')::integer,0));next_hp:=before_hp;next_temp:=before_temp;dice:=coalesce(attack->>'damage_dice',(attacker.sheet->'attack'->>'damage')||'d1');concentration_name:=nullif(target.sheet->>'concentration','');
  if hit then
    damage:=greatest(0,private.roll30_dice(dice,critical));next_temp:=greatest(0,before_temp-damage);next_hp:=greatest(0,before_hp-greatest(0,damage-before_temp));
    if damage>0 and concentration_name is not null then concentration_dc:=greatest(10,floor(damage/2.0)::integer);concentration_bonus:=floor((coalesce((target.sheet->'abilities'->>'con')::integer,10)-10)/2.0)::integer;concentration_roll:=floor(random()*20+1)::integer+concentration_bonus;concentration_success:=concentration_roll>=concentration_dc;end if;
    next_sheet:=jsonb_set(target.sheet,'{temp_hp}',to_jsonb(next_temp),true);if concentration_success is false then next_sheet:=jsonb_set(next_sheet,'{concentration}','null'::jsonb,true);end if;
    update public.characters set hp_current=next_hp,sheet=next_sheet,sheet_revision=sheet_revision+case when next_sheet is distinct from target.sheet then 1 else 0 end,updated_at=now() where id=target.id;
  end if;
  result:=jsonb_build_object('attacker_id',attacker.id,'target_id',target.id,'attacker',attacker.name,'target',target.name,'attack',attack->>'name','natural',natural_roll,'total',total,'hit',hit,'critical',critical,'damage',damage,'damage_type',coalesce(attack->>'damage_type','untyped'),'from_hp',before_hp,'hp',next_hp,'from_temp_hp',before_temp,'temp_hp',next_temp,'absorbed_by_temp',before_temp-next_temp,'concentration',concentration_name,'concentration_dc',concentration_dc,'concentration_roll',concentration_roll,'concentration_success',concentration_success);
  select id into active_session from public.sessions where campaign_id=attacker.campaign_id and status='active';if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'combat_attack',result);end if;insert into public.messages(campaign_id,sender_id,kind,body) values(attacker.campaign_id,auth.uid(),'attack',result);return result;
end;
$$;

create or replace function public.undo_roll30_last_action(target_session uuid)
returns public.session_events
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions;event_row public.session_events;undo_event public.session_events;token_key text;move_state jsonb;spent numeric;character_key text;character_row public.characters;restored_sheet jsonb;
begin
  select * into session_row from public.sessions where id=target_session for update;if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can undo table actions';end if;
  select event_item.* into event_row from public.session_events event_item where event_item.session_id=target_session and event_item.event_type in ('automation_chain_completed','token_moved','object_toggled','hp_changed','combat_attack') and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id) order by event_item.created_at desc,event_item.id desc limit 1 for update;
  if event_row.id is null then raise exception 'There is no reversible action to undo';end if;
  if event_row.event_type='automation_chain_completed' then perform public.restore_roll30_snapshot((event_row.payload->>'snapshot_id')::uuid);
  elsif event_row.event_type='token_moved' then
    update public.session_tokens set x=(event_row.payload->>'from_x')::integer,y=(event_row.payload->>'from_y')::integer where id=(event_row.payload->>'token_id')::uuid and session_id=target_session;
    token_key:=event_row.payload->>'token_id';move_state:=coalesce(session_row.state->'movement','{}'::jsonb);spent:=greatest(0,coalesce((move_state->token_key->>'spent')::numeric,0)-coalesce((event_row.payload->>'movement_cost')::numeric,0));if move_state?token_key then move_state:=jsonb_set(move_state,array[token_key,'spent'],to_jsonb(spent),false);end if;update public.sessions set state=jsonb_set(state,'{movement}',move_state,true),updated_at=now() where id=target_session;
  elsif event_row.event_type in ('hp_changed','combat_attack') then
    character_key:=case when event_row.event_type='combat_attack' then 'target_id' else 'character_id' end;select * into character_row from public.characters where id=(event_row.payload->>character_key)::uuid and campaign_id=session_row.campaign_id for update;
    restored_sheet:=character_row.sheet;if event_row.payload?'from_temp_hp' then restored_sheet:=jsonb_set(restored_sheet,'{temp_hp}',to_jsonb((event_row.payload->>'from_temp_hp')::integer),true);end if;if event_row.event_type='combat_attack' and event_row.payload->>'concentration' is not null then restored_sheet:=jsonb_set(restored_sheet,'{concentration}',to_jsonb(event_row.payload->>'concentration'),true);end if;
    update public.characters set hp_current=(event_row.payload->>'from_hp')::integer,sheet=restored_sheet,sheet_revision=sheet_revision+case when restored_sheet is distinct from character_row.sheet then 1 else 0 end,updated_at=now() where id=character_row.id;update public.sessions set updated_at=now() where id=target_session;
  else update public.scene_objects set state=jsonb_set(coalesce(state,'{}'::jsonb),'{active}',to_jsonb(coalesce((event_row.payload->>'from_active')::boolean,false)),true) where id=(event_row.payload->>'object_id')::uuid and scene_id=session_row.scene_id;update public.sessions set updated_at=now() where id=target_session;end if;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,auth.uid(),'action_undone',jsonb_build_object('original_event_id',event_row.id,'original_type',event_row.event_type)) returning * into undo_event;insert into public.session_event_undos(original_event_id,undo_event_id,undone_by) values(event_row.id,undo_event.id,auth.uid());return undo_event;
end;
$$;
