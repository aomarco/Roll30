create or replace function public.preview_roll30_last_undo(target_session uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare session_row public.sessions;event_row public.session_events;
begin
  select * into session_row from public.sessions where id=target_session;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can preview undo';end if;
  select event_item.* into event_row from public.session_events event_item
  where event_item.session_id=target_session
    and event_item.event_type in ('automation_chain_completed','scene_state_applied','token_moved','object_toggled','hp_changed','combat_attack','spell_cast','ability_used','item_used','item_charge_used')
    and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id)
  order by event_item.created_at desc,event_item.id desc limit 1;
  if event_row.id is null then return jsonb_build_object('available',false);end if;
  return jsonb_build_object('available',true,'event_id',event_row.id,'event_type',event_row.event_type,'created_at',event_row.created_at,'name',coalesce(event_row.payload->>'name',event_row.payload->>'spell',event_row.payload->>'ability',event_row.payload->>'item',event_row.event_type),'summary',case event_row.event_type
    when 'automation_chain_completed' then 'Restore the table to before this automation chain'
    when 'scene_state_applied' then 'Restore the table to before this scene state'
    when 'token_moved' then 'Move the token back to its previous position'
    when 'hp_changed' then 'Restore the previous hit points'
    when 'combat_attack' then 'Undo this attack and restore its target'
    when 'spell_cast' then 'Restore the spell slot spent by this cast'
    when 'ability_used' then 'Restore this ability use and its previous hit points'
    when 'item_used' then 'Restore the consumed item and previous hit points'
    when 'item_charge_used' then 'Restore the spent item charges'
    else 'Restore the object to its previous state' end);
end;
$$;

create or replace function public.undo_roll30_last_action(target_session uuid)
returns public.session_events
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions;event_row public.session_events;undo_event public.session_events;token_key text;move_state jsonb;spent numeric;character_key text;character_row public.characters;restored_sheet jsonb;entries jsonb;entry jsonb;entry_index integer;current_value integer;maximum_value integer;
begin
  select * into session_row from public.sessions where id=target_session for update;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can undo table actions';end if;
  select event_item.* into event_row from public.session_events event_item
  where event_item.session_id=target_session
    and event_item.event_type in ('automation_chain_completed','scene_state_applied','token_moved','object_toggled','hp_changed','combat_attack','spell_cast','ability_used','item_used','item_charge_used')
    and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id)
  order by event_item.created_at desc,event_item.id desc limit 1 for update;
  if event_row.id is null then raise exception 'There is no reversible action to undo';end if;
  if event_row.event_type in ('automation_chain_completed','scene_state_applied') then
    perform public.restore_roll30_snapshot((event_row.payload->>'snapshot_id')::uuid);
  elsif event_row.event_type='token_moved' then
    update public.session_tokens set x=(event_row.payload->>'from_x')::integer,y=(event_row.payload->>'from_y')::integer where id=(event_row.payload->>'token_id')::uuid and session_id=target_session;
    token_key:=event_row.payload->>'token_id';move_state:=coalesce(session_row.state->'movement','{}'::jsonb);spent:=greatest(0,coalesce((move_state->token_key->>'spent')::numeric,0)-coalesce((event_row.payload->>'movement_cost')::numeric,0));if move_state?token_key then move_state:=jsonb_set(move_state,array[token_key,'spent'],to_jsonb(spent),false);end if;update public.sessions set state=jsonb_set(state,'{movement}',move_state,true),updated_at=now() where id=target_session;
  elsif event_row.event_type in ('hp_changed','combat_attack') then
    character_key:=case when event_row.event_type='combat_attack' then 'target_id' else 'character_id' end;select * into character_row from public.characters where id=(event_row.payload->>character_key)::uuid and campaign_id=session_row.campaign_id for update;restored_sheet:=character_row.sheet;if event_row.payload?'from_temp_hp' then restored_sheet:=jsonb_set(restored_sheet,'{temp_hp}',to_jsonb((event_row.payload->>'from_temp_hp')::integer),true);end if;if event_row.event_type='combat_attack' and event_row.payload->>'concentration' is not null then restored_sheet:=jsonb_set(restored_sheet,'{concentration}',to_jsonb(event_row.payload->>'concentration'),true);end if;update public.characters set hp_current=(event_row.payload->>'from_hp')::integer,sheet=restored_sheet,sheet_revision=sheet_revision+case when restored_sheet is distinct from character_row.sheet then 1 else 0 end,updated_at=now() where id=character_row.id;
  elsif event_row.event_type='spell_cast' then
    select * into character_row from public.characters where id=(event_row.payload->>'character_id')::uuid and campaign_id=session_row.campaign_id for update;restored_sheet:=character_row.sheet;
    if coalesce((event_row.payload->>'slot_level')::integer,0)>0 then entries:=coalesce(restored_sheet->'spellcasting'->'slots','[]'::jsonb);if jsonb_array_length(entries)>0 then for entry_index in 0..jsonb_array_length(entries)-1 loop entry:=entries->entry_index;if (entry->>'level')::integer=(event_row.payload->>'slot_level')::integer then current_value:=coalesce((entry->>'current')::integer,0);maximum_value:=greatest(current_value,coalesce((entry->>'max')::integer,current_value+1));entries:=jsonb_set(entries,array[entry_index::text,'current'],to_jsonb(least(maximum_value,current_value+1)),false);exit;end if;end loop;end if;restored_sheet:=jsonb_set(restored_sheet,'{spellcasting,slots}',entries,true);update public.characters set sheet=restored_sheet,sheet_revision=sheet_revision+1,updated_at=now() where id=character_row.id;end if;
  elsif event_row.event_type='ability_used' then
    select * into character_row from public.characters where id=(event_row.payload->>'character_id')::uuid and campaign_id=session_row.campaign_id for update;restored_sheet:=character_row.sheet;entries:=coalesce(restored_sheet->'resources','[]'::jsonb);if jsonb_array_length(entries)>0 then for entry_index in 0..jsonb_array_length(entries)-1 loop entry:=entries->entry_index;if lower(entry->>'name')=lower(event_row.payload->>'ability') then current_value:=coalesce((entry->>'current')::integer,0);maximum_value:=greatest(current_value,coalesce((entry->>'max')::integer,current_value+1));entries:=jsonb_set(entries,array[entry_index::text,'current'],to_jsonb(least(maximum_value,current_value+1)),false);exit;end if;end loop;end if;restored_sheet:=jsonb_set(restored_sheet,'{resources}',entries,true);update public.characters set hp_current=(event_row.payload->>'from_hp')::integer,sheet=restored_sheet,sheet_revision=sheet_revision+1,updated_at=now() where id=character_row.id;
  elsif event_row.event_type='item_used' then
    update public.character_inventory set quantity=(event_row.payload->>'from_quantity')::integer where character_id=(event_row.payload->>'character_id')::uuid and item_id=(event_row.payload->>'item_id')::uuid;
    update public.characters set hp_current=(event_row.payload->>'from_hp')::integer,updated_at=now() where id=(event_row.payload->>'character_id')::uuid and campaign_id=session_row.campaign_id;
  elsif event_row.event_type='item_charge_used' then
    update public.character_inventory set metadata=jsonb_set(metadata,'{charges,current}',to_jsonb((event_row.payload->>'from_charges')::integer),false) where character_id=(event_row.payload->>'character_id')::uuid and item_id=(event_row.payload->>'item_id')::uuid;
  else
    update public.scene_objects set state=jsonb_set(coalesce(state,'{}'::jsonb),'{active}',to_jsonb(coalesce((event_row.payload->>'from_active')::boolean,false)),true) where id=(event_row.payload->>'object_id')::uuid and scene_id=session_row.scene_id;
  end if;
  update public.sessions set updated_at=now() where id=target_session;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,auth.uid(),'action_undone',jsonb_build_object('original_event_id',event_row.id,'original_type',event_row.event_type)) returning * into undo_event;
  insert into public.session_event_undos(original_event_id,undo_event_id,undone_by) values(event_row.id,undo_event.id,auth.uid());
  return undo_event;
end;
$$;
