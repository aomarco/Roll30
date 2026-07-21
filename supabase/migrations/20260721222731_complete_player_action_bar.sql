create or replace function private.create_roll30_session_snapshot(target_session uuid,snapshot_label text,actor uuid)
returns public.session_snapshots
language plpgsql security definer set search_path=public
as $$
declare current_session public.sessions;token_state jsonb;object_state jsonb;snapshot_state jsonb;result public.session_snapshots;
begin
  select * into current_session from public.sessions where id=target_session for update;
  if current_session.id is null then raise exception 'Session not found';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'character_id',character_id,'name',name,'x',x,'y',y,'speed',speed,'size_ft',size_ft,'hidden',hidden,'presentation',presentation) order by created_at,id),'[]'::jsonb) into token_state from public.session_tokens where session_id=target_session;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'object_type',object_type,'x',x,'y',y,'state',state,'config',config,'layer',layer,'z_index',z_index,'visible_to_players',visible_to_players) order by z_index,created_at,id),'[]'::jsonb) into object_state from public.scene_objects where scene_id=current_session.scene_id;
  snapshot_state:=jsonb_set(coalesce(current_session.state,'{}'::jsonb),'{tokens}',token_state,true);
  snapshot_state:=jsonb_set(snapshot_state,'{scene_objects}',object_state,true);
  insert into public.session_snapshots(session_id,created_by,label,state,session_round,session_active_turn,scene_id)
  values(target_session,actor,coalesce(nullif(trim(snapshot_label),''),'Snapshot'),snapshot_state,current_session.round,current_session.active_turn,current_session.scene_id) returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,actor,'snapshot_saved',jsonb_build_object('snapshot_id',result.id,'label',result.label));
  return result;
end;
$$;

create or replace function public.snapshot_roll30_session(target_session uuid,snapshot_label text default null)
returns public.session_snapshots
language plpgsql security definer set search_path=public
as $$
declare current_session public.sessions;
begin
  select * into current_session from public.sessions where id=target_session;
  if current_session.id is null or not public.is_campaign_gm(current_session.campaign_id) then raise exception 'Only the GM can save a snapshot';end if;
  return private.create_roll30_session_snapshot(target_session,snapshot_label,auth.uid());
end;
$$;

create or replace function private.assert_roll30_character_turn(target_character uuid)
returns void
language plpgsql stable security definer set search_path=public
as $$
declare character_row public.characters;session_row public.sessions;active_token uuid;active_character uuid;
begin
  select * into character_row from public.characters where id=target_character;
  if character_row.id is null then raise exception 'Character not found';end if;
  if public.is_campaign_gm(character_row.campaign_id) then return;end if;
  select * into session_row from public.sessions where campaign_id=character_row.campaign_id and status='active';
  if session_row.id is null or jsonb_array_length(coalesce(session_row.state->'initiative','[]'::jsonb))=0 then return;end if;
  active_token:=(session_row.state->'initiative'->session_row.active_turn->>'token_id')::uuid;
  select character_id into active_character from public.session_tokens where id=active_token and session_id=session_row.id;
  if active_character is distinct from target_character then raise exception 'It is not this character''s turn';end if;
end;
$$;

create or replace function public.advance_roll30_turn(target_session uuid)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare result public.sessions;initiative_count integer;next_turn integer;next_round integer;active_token uuid;active_owner uuid;is_gm boolean;
begin
  select * into result from public.sessions where id=target_session for update;
  if result.id is null or not public.is_campaign_member(result.campaign_id) then raise exception 'Session not found';end if;
  initiative_count:=jsonb_array_length(coalesce(result.state->'initiative','[]'::jsonb));
  is_gm:=public.is_campaign_gm(result.campaign_id);
  if not is_gm then
    if initiative_count=0 then raise exception 'Only the GM can advance a table without initiative';end if;
    active_token:=(result.state->'initiative'->result.active_turn->>'token_id')::uuid;
    select character_row.owner_id into active_owner from public.session_tokens token join public.characters character_row on character_row.id=token.character_id where token.id=active_token and token.session_id=result.id;
    if active_owner is distinct from auth.uid() then raise exception 'Only the active player or GM can end this turn';end if;
  end if;
  next_turn:=result.active_turn+1;next_round:=result.round;
  if initiative_count>0 and next_turn>=initiative_count then
    next_turn:=0;next_round:=result.round+1;
    perform private.create_roll30_session_snapshot(result.id,'Before round '||next_round,auth.uid());
  end if;
  update public.sessions set active_turn=next_turn,round=next_round,updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,auth.uid(),'turn_advanced',jsonb_build_object('active_turn',result.active_turn,'round',result.round));
  return result;
end;
$$;

create or replace function public.cast_roll30_spell(target_character uuid,spell_name text,slot_level integer default 0)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters;spell_entry jsonb;known boolean:=false;active_session uuid;result jsonb;
begin
  select * into character_row from public.characters where id=target_character for update;
  if character_row.id is null or not (public.is_campaign_gm(character_row.campaign_id) or character_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted';end if;
  perform private.assert_roll30_character_turn(target_character);
  if length(trim(spell_name)) not between 1 and 120 then raise exception 'Spell name is required';end if;
  for spell_entry in select value from jsonb_array_elements(coalesce(character_row.sheet->'spellcasting'->'spells','[]'::jsonb)) loop
    if lower(coalesce(spell_entry->>'name',trim(both '"' from spell_entry::text)))=lower(trim(spell_name)) then known:=true;exit;end if;
  end loop;
  if not known then raise exception 'That spell is not on this character sheet';end if;
  if slot_level<0 or slot_level>9 then raise exception 'Spell slot level must be from 0 to 9';end if;
  if slot_level>0 then perform public.use_roll30_spell_slot(target_character,slot_level);end if;
  result:=jsonb_build_object('character_id',character_row.id,'character',character_row.name,'spell',trim(spell_name),'slot_level',slot_level);
  insert into public.messages(campaign_id,sender_id,kind,body) values(character_row.campaign_id,auth.uid(),'action',jsonb_build_object('text',character_row.name||' casts '||trim(spell_name),'spell',trim(spell_name),'slot_level',slot_level));
  select id into active_session from public.sessions where campaign_id=character_row.campaign_id and status='active';
  if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'spell_cast',result);end if;
  return result;
end;
$$;

create or replace function public.use_roll30_character_ability(target_character uuid,resource_name text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters;resources jsonb;resource jsonb;resource_index integer;current_value integer;healing_expression text;healing integer:=0;before_hp integer;next_hp integer;next_sheet jsonb;active_session uuid;result jsonb;
begin
  select * into character_row from public.characters where id=target_character for update;
  if character_row.id is null or not (public.is_campaign_gm(character_row.campaign_id) or character_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted';end if;
  perform private.assert_roll30_character_turn(target_character);
  resources:=coalesce(character_row.sheet->'resources','[]'::jsonb);
  if jsonb_typeof(resources)<>'array' or jsonb_array_length(resources)=0 then raise exception 'This character has no limited abilities';end if;
  for resource_index in 0..jsonb_array_length(resources)-1 loop
    resource:=resources->resource_index;
    if lower(resource->>'name')=lower(trim(resource_name)) then
      current_value:=coalesce((resource->>'current')::integer,0);if current_value<1 then raise exception 'No uses of % remain',resource->>'name';end if;
      resources:=jsonb_set(resources,array[resource_index::text,'current'],to_jsonb(current_value-1),false);
      healing_expression:=nullif(resource->>'healing','');
      if healing_expression is null and lower(resource->>'name')='second wind' then healing_expression:='1d10+'||greatest(1,coalesce((character_row.sheet->>'level')::integer,1));end if;
      if healing_expression is not null then healing:=greatest(0,private.roll30_dice(healing_expression,false));end if;
      before_hp:=coalesce(character_row.hp_current,0);next_hp:=least(coalesce(character_row.hp_max,999999),before_hp+healing);
      next_sheet:=jsonb_set(character_row.sheet,'{resources}',resources,true);
      if before_hp=0 and next_hp>0 then next_sheet:=jsonb_set(next_sheet,'{death_saves}','{"successes":0,"failures":0}'::jsonb,true);end if;
      update public.characters set sheet=next_sheet,sheet_revision=sheet_revision+1,hp_current=next_hp,updated_at=now() where id=character_row.id;
      result:=jsonb_build_object('character_id',character_row.id,'character',character_row.name,'ability',resource->>'name','remaining',current_value-1,'healing',healing,'from_hp',before_hp,'hp',next_hp);
      insert into public.messages(campaign_id,sender_id,kind,body) values(character_row.campaign_id,auth.uid(),'action',jsonb_build_object('text',character_row.name||' uses '||(resource->>'name'),'ability',resource->>'name','healing',healing));
      select id into active_session from public.sessions where campaign_id=character_row.campaign_id and status='active';if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'ability_used',result);end if;
      return result;
    end if;
  end loop;
  raise exception 'That ability is not configured';
end;
$$;

create or replace function public.use_roll30_inventory_item(source_character uuid,target_item uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters;item_row public.items;inventory_row public.character_inventory;before_hp integer;before_quantity integer;operation_result jsonb;active_session uuid;result jsonb;
begin
  select * into character_row from public.characters where id=source_character for update;
  if character_row.id is null or not (public.is_campaign_gm(character_row.campaign_id) or character_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted';end if;
  perform private.assert_roll30_character_turn(source_character);
  select * into item_row from public.items where id=target_item and campaign_id=character_row.campaign_id;
  select * into inventory_row from public.character_inventory where character_id=source_character and item_id=target_item for update;
  if item_row.id is null or inventory_row.item_id is null then raise exception 'Item is not in this inventory';end if;
  if inventory_row.metadata?'charges' then raise exception 'Use a charge instead of consuming this item';end if;
  before_hp:=coalesce(character_row.hp_current,0);before_quantity:=inventory_row.quantity;
  operation_result:=public.mutate_roll30_inventory(source_character,target_item,'consume',1,null);
  select * into character_row from public.characters where id=source_character;
  result:=operation_result||jsonb_build_object('character_id',character_row.id,'character',character_row.name,'item_id',item_row.id,'item',item_row.name,'from_quantity',before_quantity,'from_hp',before_hp,'hp',character_row.hp_current);
  insert into public.messages(campaign_id,sender_id,kind,body) values(character_row.campaign_id,auth.uid(),'action',jsonb_build_object('text',character_row.name||' uses '||item_row.name,'item',item_row.name,'healing',character_row.hp_current-before_hp));
  select id into active_session from public.sessions where campaign_id=character_row.campaign_id and status='active';if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'item_used',result);end if;
  return result;
end;
$$;

create or replace function public.use_roll30_item_charge(source_character uuid,target_item uuid,amount integer default 1)
returns public.character_inventory
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters;inventory_row public.character_inventory;current_charges integer;result public.character_inventory;item_name text;active_session uuid;
begin
  if amount<1 then raise exception 'Charge use must be at least one';end if;
  select * into character_row from public.characters where id=source_character;
  if character_row.id is null or not (public.is_campaign_gm(character_row.campaign_id) or character_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted';end if;
  perform private.assert_roll30_character_turn(source_character);
  select * into inventory_row from public.character_inventory where character_id=source_character and item_id=target_item for update;
  if inventory_row.item_id is null then raise exception 'Item not found in inventory';end if;
  current_charges:=coalesce((inventory_row.metadata->'charges'->>'current')::integer,0);if current_charges<amount then raise exception 'Not enough item charges remain';end if;
  update public.character_inventory set metadata=jsonb_set(metadata,'{charges,current}',to_jsonb(current_charges-amount),false) where character_id=source_character and item_id=target_item returning * into result;
  select name into item_name from public.items where id=target_item;
  insert into public.messages(campaign_id,sender_id,kind,body) values(character_row.campaign_id,auth.uid(),'action',jsonb_build_object('text',character_row.name||' uses '||item_name,'item',item_name,'charges_spent',amount));
  select id into active_session from public.sessions where campaign_id=character_row.campaign_id and status='active';if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'item_charge_used',jsonb_build_object('character_id',character_row.id,'item_id',target_item,'item',item_name,'from_charges',current_charges,'charges',current_charges-amount));end if;
  return result;
end;
$$;

create or replace function public.resolve_roll30_combat_attack(attacker_id uuid,target_id uuid,attack_index integer default 0,advantage integer default 0)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare attacker public.characters;target public.characters;attack jsonb;first_roll integer;second_roll integer;natural_roll integer;bonus integer;total integer;hit boolean;critical boolean;damage integer:=0;dice text;active_session public.sessions;result jsonb;before_hp integer;next_hp integer;before_temp integer;next_temp integer;concentration_name text;concentration_dc integer;concentration_roll integer;concentration_success boolean;concentration_bonus integer;next_sheet jsonb;is_gm boolean;active_token uuid;active_character uuid;target_visible boolean;
begin
  select * into attacker from public.characters where id=attacker_id for update;select * into target from public.characters where id=target_id for update;
  if attacker.id is null or target.id is null or attacker.campaign_id<>target.campaign_id then raise exception 'Combatants must share a campaign';end if;
  is_gm:=public.is_campaign_gm(attacker.campaign_id);
  if not (is_gm or attacker.owner_id is not distinct from auth.uid()) then raise exception 'You can only attack with your own character';end if;
  select * into active_session from public.sessions where campaign_id=attacker.campaign_id and status='active' for update;
  if active_session.id is not null and not is_gm then
    if jsonb_array_length(coalesce(active_session.state->'initiative','[]'::jsonb))>0 then
      active_token:=(active_session.state->'initiative'->active_session.active_turn->>'token_id')::uuid;
      select character_id into active_character from public.session_tokens where id=active_token and session_id=active_session.id;
      if active_character is distinct from attacker.id then raise exception 'It is not this character''s turn';end if;
    end if;
    select exists(
      select 1 from jsonb_array_elements(public.get_visible_roll30_tokens(active_session.id)) visible
      where visible->>'character_id'=target.id::text
    ) into target_visible;
    if not target_visible then raise exception 'That target is not visible on the live table';end if;
  end if;
  if advantage not between -1 and 1 then raise exception 'Advantage must be -1, 0, or 1';end if;
  attack:=coalesce(attacker.sheet->'attacks'->attack_index,attacker.sheet->'attack');if attack is null then raise exception 'This character has no configured attack';end if;
  first_roll:=floor(random()*20+1)::integer;second_roll:=floor(random()*20+1)::integer;natural_roll:=case when advantage=1 then greatest(first_roll,second_roll) when advantage=-1 then least(first_roll,second_roll) else first_roll end;
  bonus:=coalesce((attack->>'bonus')::integer,0);total:=natural_roll+bonus;critical:=natural_roll=20;hit:=natural_roll<>1 and (critical or total>=coalesce((target.sheet->>'armor_class')::integer,10));
  before_hp:=coalesce(target.hp_current,0);before_temp:=greatest(0,coalesce((target.sheet->>'temp_hp')::integer,0));next_hp:=before_hp;next_temp:=before_temp;dice:=coalesce(attack->>'damage_dice',(attacker.sheet->'attack'->>'damage')||'d1');concentration_name:=nullif(target.sheet->>'concentration','');
  if hit then damage:=greatest(0,private.roll30_dice(dice,critical));next_temp:=greatest(0,before_temp-damage);next_hp:=greatest(0,before_hp-greatest(0,damage-before_temp));if damage>0 and concentration_name is not null then concentration_dc:=greatest(10,floor(damage/2.0)::integer);concentration_bonus:=floor((coalesce((target.sheet->'abilities'->>'con')::integer,10)-10)/2.0)::integer;concentration_roll:=floor(random()*20+1)::integer+concentration_bonus;concentration_success:=concentration_roll>=concentration_dc;end if;next_sheet:=jsonb_set(target.sheet,'{temp_hp}',to_jsonb(next_temp),true);if concentration_success is false then next_sheet:=jsonb_set(next_sheet,'{concentration}','null'::jsonb,true);end if;update public.characters set hp_current=next_hp,sheet=next_sheet,sheet_revision=sheet_revision+case when next_sheet is distinct from target.sheet then 1 else 0 end,updated_at=now() where id=target.id;end if;
  result:=jsonb_build_object('attacker_id',attacker.id,'target_id',target.id,'attacker',attacker.name,'target',target.name,'attack',attack->>'name','natural',natural_roll,'total',total,'hit',hit,'critical',critical,'damage',damage,'damage_type',coalesce(attack->>'damage_type','untyped'),'from_hp',before_hp,'hp',next_hp,'from_temp_hp',before_temp,'temp_hp',next_temp,'absorbed_by_temp',before_temp-next_temp,'concentration',concentration_name,'concentration_dc',concentration_dc,'concentration_roll',concentration_roll,'concentration_success',concentration_success);
  if active_session.id is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session.id,auth.uid(),'combat_attack',result);end if;
  insert into public.messages(campaign_id,sender_id,kind,body) values(attacker.campaign_id,auth.uid(),'attack',result);return result;
end;
$$;

revoke all on function private.create_roll30_session_snapshot(uuid,text,uuid) from public,anon,authenticated;
revoke all on function private.assert_roll30_character_turn(uuid) from public,anon,authenticated;
revoke all on function public.cast_roll30_spell(uuid,text,integer) from public,anon;
revoke all on function public.use_roll30_character_ability(uuid,text) from public,anon;
revoke all on function public.use_roll30_inventory_item(uuid,uuid) from public,anon;
grant execute on function public.cast_roll30_spell(uuid,text,integer) to authenticated;
grant execute on function public.use_roll30_character_ability(uuid,text) to authenticated;
grant execute on function public.use_roll30_inventory_item(uuid,uuid) to authenticated;
