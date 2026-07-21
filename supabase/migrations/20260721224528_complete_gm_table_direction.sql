create or replace function public.present_roll30_portrait(
  target_session uuid,
  target_token uuid default null,
  portrait_caption text default null,
  show_portrait boolean default true
)
returns public.sessions
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions;token_row public.session_tokens;character_row public.characters;portrait_id uuid;next_dialog jsonb;
begin
  select * into session_row from public.sessions where id=target_session for update;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can present portraits';end if;
  if not show_portrait then
    update public.sessions set state=state-'presentation_dialog',updated_at=now() where id=session_row.id returning * into session_row;
    insert into public.session_events(session_id,actor_id,event_type,payload) values(session_row.id,auth.uid(),'portrait_dismissed','{}'::jsonb);
    return session_row;
  end if;
  select * into token_row from public.session_tokens where id=target_token and session_id=session_row.id;
  if token_row.id is null then raise exception 'Token is not on this live table';end if;
  select * into character_row from public.characters where id=token_row.character_id;
  portrait_id:=coalesce((token_row.presentation->>'portrait_asset_id')::uuid,character_row.portrait_asset_id);
  if portrait_id is null then raise exception 'Choose a portrait for this token or character first';end if;
  if not exists(select 1 from public.campaign_assets where id=portrait_id and campaign_id=session_row.campaign_id and kind in ('image','portrait')) then raise exception 'Portrait is not in this campaign';end if;
  update public.campaign_assets set visible_to_players=true,audience='{}'::uuid[] where id=portrait_id;
  next_dialog:=jsonb_build_object('token_id',token_row.id,'character_id',token_row.character_id,'portrait_asset_id',portrait_id,'name',token_row.name,'caption',left(coalesce(trim(portrait_caption),''),500),'presented_at',now(),'presented_by',auth.uid());
  update public.sessions set state=jsonb_set(state,'{presentation_dialog}',next_dialog,true),updated_at=now() where id=session_row.id returning * into session_row;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(session_row.id,auth.uid(),'portrait_presented',next_dialog);
  return session_row;
end;
$$;

create or replace function public.record_roll30_custom_outcome(target_session uuid,outcome_text text)
returns public.session_events
language plpgsql security definer set search_path=public
as $$
declare session_row public.sessions;result public.session_events;message_body text:=trim(coalesce(outcome_text,''));
begin
  select * into session_row from public.sessions where id=target_session;
  if session_row.id is null or not public.is_campaign_gm(session_row.campaign_id) then raise exception 'Only the GM can declare a custom outcome';end if;
  if length(message_body) not between 1 and 2000 then raise exception 'Custom outcome must be between 1 and 2000 characters';end if;
  insert into public.messages(campaign_id,sender_id,kind,body) values(session_row.campaign_id,auth.uid(),'action',jsonb_build_object('text',message_body,'custom_outcome',true));
  insert into public.session_events(session_id,actor_id,event_type,payload) values(session_row.id,auth.uid(),'custom_outcome',jsonb_build_object('name',message_body,'text',message_body)) returning * into result;
  return result;
end;
$$;

revoke all on function public.present_roll30_portrait(uuid,uuid,text,boolean) from public,anon;
revoke all on function public.record_roll30_custom_outcome(uuid,text) from public,anon;
grant execute on function public.present_roll30_portrait(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.record_roll30_custom_outcome(uuid,text) to authenticated;
