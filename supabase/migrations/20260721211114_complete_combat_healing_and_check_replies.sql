create or replace function public.change_roll30_hp(target_character uuid, delta integer)
returns public.characters
language plpgsql security definer set search_path=public
as $$
declare result public.characters; before_hp integer; active_session uuid;
begin
  select * into result from public.characters where id=target_character for update;
  if result.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(result.campaign_id) or result.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  before_hp:=coalesce(result.hp_current,0);
  update public.characters set hp_current=greatest(0,least(coalesce(result.hp_max,999999),before_hp+delta)),updated_at=now()
  where id=target_character returning * into result;
  select id into active_session from public.sessions where campaign_id=result.campaign_id and status='active';
  if active_session is not null then
    insert into public.session_events(session_id,actor_id,event_type,payload)
    values(active_session,auth.uid(),'hp_changed',jsonb_build_object(
      'character_id',result.id,'name',result.name,'from_hp',before_hp,'hp',result.hp_current,'delta',result.hp_current-before_hp,'source','manual'
    ));
  end if;
  return result;
end;
$$;

create or replace function public.resolve_roll30_hp_change(target_character uuid, change_kind text, dice_expression text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare character_row public.characters; before_hp integer; amount integer; next_hp integer; active_session uuid; result jsonb;
begin
  select * into character_row from public.characters where id=target_character for update;
  if character_row.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(character_row.campaign_id) or character_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  if change_kind not in ('damage','healing') then raise exception 'Choose damage or healing'; end if;
  amount:=private.roll30_dice(dice_expression,false);
  if amount<0 then raise exception 'HP amount cannot be negative'; end if;
  before_hp:=coalesce(character_row.hp_current,0);
  next_hp:=case when change_kind='damage' then greatest(0,before_hp-amount) else least(coalesce(character_row.hp_max,999999),before_hp+amount) end;
  update public.characters set hp_current=next_hp,updated_at=now() where id=character_row.id;
  select id into active_session from public.sessions where campaign_id=character_row.campaign_id and status='active';
  result:=jsonb_build_object('character_id',character_row.id,'name',character_row.name,'kind',change_kind,
    'expression',dice_expression,'amount',amount,'from_hp',before_hp,'hp',next_hp);
  if active_session is not null then
    insert into public.session_events(session_id,actor_id,event_type,payload)
    values(active_session,auth.uid(),'hp_changed',result||jsonb_build_object('delta',next_hp-before_hp,'source','dice'));
  end if;
  return result;
end;
$$;

create or replace function public.respond_roll30_check_request(target_message uuid,dice_expression text)
returns public.messages
language plpgsql security definer set search_path=public
as $$
declare request_row public.messages; total integer; result public.messages;
begin
  select * into request_row from public.messages where id=target_message for update;
  if request_row.id is null or request_row.kind<>'check_request' or request_row.recipient_id is distinct from auth.uid()
    or not public.is_campaign_member(request_row.campaign_id) then raise exception 'This check request is not addressed to you'; end if;
  if exists(select 1 from public.messages response where response.body->>'reply_to'=request_row.id::text and response.sender_id=auth.uid()) then
    raise exception 'You already answered this check request';
  end if;
  total:=private.roll30_dice(coalesce(nullif(trim(dice_expression),''),'1d20'),false);
  insert into public.messages(campaign_id,sender_id,recipient_id,kind,body)
  values(request_row.campaign_id,auth.uid(),request_row.sender_id,'roll',jsonb_build_object(
    'text','Check response','dice',coalesce(nullif(trim(dice_expression),''),'1d20'),'total',total,
    'reply_to',request_row.id,'request',request_row.body->>'text'
  )) returning * into result;
  return result;
end;
$$;

create or replace function public.send_roll30_message(target_campaign uuid,message_kind text,message_text text default '',target_recipient uuid default null,dice_expression text default null)
returns public.messages
language plpgsql security definer set search_path=public
as $$
declare result public.messages;body jsonb;total integer;
begin
  if not public.is_campaign_member(target_campaign) then raise exception 'Campaign not found'; end if;
  if message_kind not in ('message','whisper','action','roll','check_request') then raise exception 'Unsupported message type'; end if;
  if target_recipient is not null and not exists(select 1 from public.campaign_members where campaign_id=target_campaign and user_id=target_recipient) then raise exception 'Recipient is not in this campaign'; end if;
  if message_kind='whisper' and target_recipient is null then raise exception 'Choose a whisper recipient'; end if;
  if message_kind='check_request' and (
    not public.is_campaign_gm(target_campaign) or target_recipient is null
    or not exists(select 1 from public.campaign_members where campaign_id=target_campaign and user_id=target_recipient and role='player')
  ) then raise exception 'Only a GM can send a check request to a player'; end if;
  if message_kind='roll' then
    total:=private.roll30_dice(coalesce(dice_expression,'1d20'),false);
    body:=jsonb_build_object('text',coalesce(nullif(trim(message_text),''),auth.uid()::text||' rolled '||total),'dice',coalesce(dice_expression,'1d20'),'total',total);
  else
    if length(trim(message_text)) not between 1 and 2000 then raise exception 'Message must be from 1 to 2000 characters'; end if;
    body:=jsonb_build_object('text',trim(message_text));
  end if;
  insert into public.messages(campaign_id,sender_id,recipient_id,kind,body)
  values(target_campaign,auth.uid(),target_recipient,message_kind,body) returning * into result;
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
  where event_item.session_id=target_session
    and event_item.event_type in ('automation_chain_completed','token_moved','object_toggled','hp_changed')
    and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id)
  order by event_item.created_at desc,event_item.id desc limit 1;
  if event_row.id is null then return jsonb_build_object('available',false); end if;
  return jsonb_build_object('available',true,'event_id',event_row.id,'event_type',event_row.event_type,
    'created_at',event_row.created_at,'name',coalesce(event_row.payload->>'name',event_row.event_type),
    'summary',case event_row.event_type
      when 'automation_chain_completed' then 'Restore the table to before this automation chain'
      when 'token_moved' then 'Move the token back to its previous position'
      when 'hp_changed' then 'Restore the character to its previous HP'
      else 'Restore the object to its previous state' end);
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
  where event_item.session_id=target_session
    and event_item.event_type in ('automation_chain_completed','token_moved','object_toggled','hp_changed')
    and not exists(select 1 from public.session_event_undos undo_row where undo_row.original_event_id=event_item.id)
  order by event_item.created_at desc,event_item.id desc limit 1 for update;
  if event_row.id is null then raise exception 'There is no reversible action to undo'; end if;
  if event_row.event_type='automation_chain_completed' then
    perform public.restore_roll30_snapshot((event_row.payload->>'snapshot_id')::uuid);
  elsif event_row.event_type='token_moved' then
    update public.session_tokens set x=(event_row.payload->>'from_x')::integer,y=(event_row.payload->>'from_y')::integer
    where id=(event_row.payload->>'token_id')::uuid and session_id=target_session;
    token_key:=event_row.payload->>'token_id'; move_state:=coalesce(session_row.state->'movement','{}'::jsonb);
    spent:=greatest(0,coalesce((move_state->token_key->>'spent')::numeric,0)-coalesce((event_row.payload->>'movement_cost')::numeric,0));
    if move_state?token_key then move_state:=jsonb_set(move_state,array[token_key,'spent'],to_jsonb(spent),false); end if;
    update public.sessions set state=jsonb_set(state,'{movement}',move_state,true),updated_at=now() where id=target_session;
  elsif event_row.event_type='hp_changed' then
    update public.characters set hp_current=(event_row.payload->>'from_hp')::integer,updated_at=now()
    where id=(event_row.payload->>'character_id')::uuid and campaign_id=session_row.campaign_id;
    update public.sessions set updated_at=now() where id=target_session;
  else
    update public.scene_objects set state=jsonb_set(coalesce(state,'{}'::jsonb),'{active}',to_jsonb(coalesce((event_row.payload->>'from_active')::boolean,false)),true)
    where id=(event_row.payload->>'object_id')::uuid and scene_id=session_row.scene_id;
    update public.sessions set updated_at=now() where id=target_session;
  end if;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'action_undone',jsonb_build_object('original_event_id',event_row.id,'original_type',event_row.event_type)) returning * into undo_event;
  insert into public.session_event_undos(original_event_id,undo_event_id,undone_by) values(event_row.id,undo_event.id,auth.uid());
  return undo_event;
end;
$$;

revoke all on function public.resolve_roll30_hp_change(uuid,text,text) from public,anon;
revoke all on function public.respond_roll30_check_request(uuid,text) from public,anon;
grant execute on function public.resolve_roll30_hp_change(uuid,text,text) to authenticated;
grant execute on function public.respond_roll30_check_request(uuid,text) to authenticated;
