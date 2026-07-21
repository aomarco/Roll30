create or replace function public.resolve_roll30_combat_attack(attacker_id uuid,target_id uuid,attack_index integer default 0,advantage integer default 0)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare attacker public.characters; target public.characters; attack jsonb; first_roll integer; second_roll integer; natural_roll integer; bonus integer; total integer; hit boolean; critical boolean; damage integer:=0; dice text; active_session uuid; result jsonb; before_hp integer; next_hp integer; concentration_name text; concentration_dc integer; concentration_roll integer; concentration_success boolean; concentration_bonus integer;
begin
  select * into attacker from public.characters where id=attacker_id for update;
  select * into target from public.characters where id=target_id for update;
  if attacker.id is null or target.id is null or attacker.campaign_id<>target.campaign_id then raise exception 'Combatants must share a campaign'; end if;
  if not (public.is_campaign_gm(attacker.campaign_id) or attacker.owner_id is not distinct from auth.uid()) then raise exception 'You can only attack with your own character'; end if;
  if advantage not between -1 and 1 then raise exception 'Advantage must be -1, 0, or 1'; end if;
  attack:=coalesce(attacker.sheet->'attacks'->attack_index,attacker.sheet->'attack');
  if attack is null then raise exception 'This character has no configured attack'; end if;
  first_roll:=floor(random()*20+1)::integer;second_roll:=floor(random()*20+1)::integer;
  natural_roll:=case when advantage=1 then greatest(first_roll,second_roll) when advantage=-1 then least(first_roll,second_roll) else first_roll end;
  bonus:=coalesce((attack->>'bonus')::integer,0);total:=natural_roll+bonus;critical:=natural_roll=20;
  hit:=natural_roll<>1 and (critical or total>=coalesce((target.sheet->>'armor_class')::integer,10));
  before_hp:=coalesce(target.hp_current,0);next_hp:=before_hp;
  dice:=coalesce(attack->>'damage_dice',(attacker.sheet->'attack'->>'damage')||'d1');
  concentration_name:=nullif(target.sheet->>'concentration','');
  if hit then
    damage:=greatest(0,private.roll30_dice(dice,critical));next_hp:=greatest(0,before_hp-damage);
    if damage>0 and concentration_name is not null then
      concentration_dc:=greatest(10,floor(damage/2.0)::integer);
      concentration_bonus:=floor((coalesce((target.sheet->'abilities'->>'con')::integer,10)-10)/2.0)::integer;
      concentration_roll:=floor(random()*20+1)::integer+concentration_bonus;
      concentration_success:=concentration_roll>=concentration_dc;
    end if;
    update public.characters set hp_current=next_hp,
      sheet=case when concentration_success is false then jsonb_set(sheet,'{concentration}','null'::jsonb,true) else sheet end,
      sheet_revision=sheet_revision+case when concentration_success is false then 1 else 0 end,updated_at=now()
    where id=target.id;
  end if;
  result:=jsonb_build_object('attacker_id',attacker.id,'target_id',target.id,'attacker',attacker.name,'target',target.name,
    'attack',attack->>'name','natural',natural_roll,'total',total,'hit',hit,'critical',critical,'damage',damage,
    'damage_type',coalesce(attack->>'damage_type','untyped'),'from_hp',before_hp,'hp',next_hp,
    'concentration',concentration_name,'concentration_dc',concentration_dc,'concentration_roll',concentration_roll,'concentration_success',concentration_success);
  select id into active_session from public.sessions where campaign_id=attacker.campaign_id and status='active';
  if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'combat_attack',result); end if;
  insert into public.messages(campaign_id,sender_id,kind,body) values(attacker.campaign_id,auth.uid(),'attack',result);
  return result;
end;
$$;

create or replace function public.grant_roll30_item(target_character uuid,target_item uuid,amount integer default 1)
returns public.character_inventory
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters; item_row public.items; result public.character_inventory; initial_metadata jsonb;
begin
  if amount<1 then raise exception 'Quantity must be at least one'; end if;
  select * into character_row from public.characters where id=target_character;
  select * into item_row from public.items where id=target_item;
  if character_row.id is null or item_row.id is null or character_row.campaign_id<>item_row.campaign_id then raise exception 'Character and item must share a campaign'; end if;
  if not public.is_campaign_gm(character_row.campaign_id) then raise exception 'Only a GM can grant items'; end if;
  initial_metadata:=case when coalesce((item_row.item_data->>'charges')::integer,0)>0 then jsonb_build_object('charges',jsonb_build_object('current',(item_row.item_data->>'charges')::integer,'max',(item_row.item_data->>'charges')::integer)) else '{}'::jsonb end;
  insert into public.character_inventory(character_id,item_id,quantity,metadata)
  values(character_row.id,item_row.id,amount,initial_metadata)
  on conflict(character_id,item_id) do update set quantity=public.character_inventory.quantity+excluded.quantity
  returning * into result;
  return result;
end;
$$;

create or replace function public.use_roll30_item_charge(source_character uuid,target_item uuid,amount integer default 1)
returns public.character_inventory
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters; inventory_row public.character_inventory; current_charges integer; result public.character_inventory;
begin
  if amount<1 then raise exception 'Charge use must be at least one'; end if;
  select * into character_row from public.characters where id=source_character;
  if character_row.id is null or not (public.is_campaign_gm(character_row.campaign_id) or character_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  select * into inventory_row from public.character_inventory where character_id=source_character and item_id=target_item for update;
  if inventory_row.item_id is null then raise exception 'Item not found in inventory'; end if;
  current_charges:=coalesce((inventory_row.metadata->'charges'->>'current')::integer,0);
  if current_charges<amount then raise exception 'Not enough item charges remain'; end if;
  update public.character_inventory set metadata=jsonb_set(metadata,'{charges,current}',to_jsonb(current_charges-amount),false)
  where character_id=source_character and item_id=target_item returning * into result;
  return result;
end;
$$;

create or replace function public.preview_roll30_last_undo(target_session uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare session_row public.sessions; event_row public.session_events;
begin
  select * into session_row from public.sessions where id=target_session;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can preview undo'; end if;
  select event_item.* into event_row from public.session_events event_item
  where event_item.session_id=target_session and event_item.event_type in ('automation_chain_completed','token_moved','object_toggled','hp_changed','combat_attack')
    and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id)
  order by event_item.created_at desc,event_item.id desc limit 1;
  if event_row.id is null then return jsonb_build_object('available',false); end if;
  return jsonb_build_object('available',true,'event_id',event_row.id,'event_type',event_row.event_type,'created_at',event_row.created_at,
    'name',coalesce(event_row.payload->>'name',event_row.payload->>'attack',event_row.event_type),
    'summary',case event_row.event_type when 'automation_chain_completed' then 'Restore the table to before this automation chain'
      when 'token_moved' then 'Move the token back to its previous position' when 'hp_changed' then 'Restore the character to its previous HP'
      when 'combat_attack' then 'Restore the attack target to its previous HP' else 'Restore the object to its previous state' end);
end;
$$;

create or replace function public.undo_roll30_last_action(target_session uuid)
returns public.session_events
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions; event_row public.session_events; undo_event public.session_events; token_key text; move_state jsonb; spent numeric;
begin
  select * into session_row from public.sessions where id=target_session for update;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can undo table actions'; end if;
  select event_item.* into event_row from public.session_events event_item
  where event_item.session_id=target_session and event_item.event_type in ('automation_chain_completed','token_moved','object_toggled','hp_changed','combat_attack')
    and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id)
  order by event_item.created_at desc,event_item.id desc limit 1 for update;
  if event_row.id is null then raise exception 'There is no reversible action to undo'; end if;
  if event_row.event_type='automation_chain_completed' then perform public.restore_roll30_snapshot((event_row.payload->>'snapshot_id')::uuid);
  elsif event_row.event_type='token_moved' then
    update public.session_tokens set x=(event_row.payload->>'from_x')::integer,y=(event_row.payload->>'from_y')::integer where id=(event_row.payload->>'token_id')::uuid and session_id=target_session;
    token_key:=event_row.payload->>'token_id';move_state:=coalesce(session_row.state->'movement','{}'::jsonb);
    spent:=greatest(0,coalesce((move_state->token_key->>'spent')::numeric,0)-coalesce((event_row.payload->>'movement_cost')::numeric,0));
    if move_state?token_key then move_state:=jsonb_set(move_state,array[token_key,'spent'],to_jsonb(spent),false); end if;
    update public.sessions set state=jsonb_set(state,'{movement}',move_state,true),updated_at=now() where id=target_session;
  elsif event_row.event_type in ('hp_changed','combat_attack') then
    update public.characters set hp_current=(event_row.payload->>'from_hp')::integer,updated_at=now()
    where id=(event_row.payload->>(case when event_row.event_type='combat_attack' then 'target_id' else 'character_id' end))::uuid and campaign_id=session_row.campaign_id;
    if event_row.event_type='combat_attack' and event_row.payload->>'concentration' is not null then
      update public.characters
      set sheet=jsonb_set(sheet,'{concentration}',to_jsonb(event_row.payload->>'concentration'),true),sheet_revision=sheet_revision+1,updated_at=now()
      where id=(event_row.payload->>'target_id')::uuid and campaign_id=session_row.campaign_id;
    end if;
    update public.sessions set updated_at=now() where id=target_session;
  else
    update public.scene_objects set state=jsonb_set(coalesce(state,'{}'::jsonb),'{active}',to_jsonb(coalesce((event_row.payload->>'from_active')::boolean,false)),true)
    where id=(event_row.payload->>'object_id')::uuid and scene_id=session_row.scene_id;
    update public.sessions set updated_at=now() where id=target_session;
  end if;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'action_undone',jsonb_build_object('original_event_id',event_row.id,'original_type',event_row.event_type)) returning * into undo_event;
  insert into public.session_event_undos(original_event_id,undo_event_id,undone_by) values(event_row.id,undo_event.id,auth.uid());return undo_event;
end;
$$;

revoke all on function public.use_roll30_item_charge(uuid,uuid,integer) from public,anon;
grant execute on function public.use_roll30_item_charge(uuid,uuid,integer) to authenticated;
