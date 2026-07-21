-- GM receives all positions. Player views are reduced to their own token plus
-- tokens within range that do not have a wall between them.
create or replace function public.get_visible_roll30_tokens(target_session uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare sess public.sessions; own_character uuid; own_token public.session_tokens; vision numeric; candidate public.session_tokens; result jsonb := '[]'::jsonb; is_blocked boolean;
begin
  select * into sess from public.sessions where id=target_session;
  if sess.id is null or not public.is_campaign_member(sess.campaign_id) then raise exception 'Not permitted'; end if;
  if public.is_campaign_gm(sess.campaign_id) or coalesce((sess.state->>'fog')::boolean,false)=false then
    select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'character_id',t.character_id,'name',t.name,'x',t.x,'y',t.y,'speed',t.speed)),'[]'::jsonb) into result from public.session_tokens t where t.session_id=sess.id;
    return result;
  end if;
  select character_id into own_character from public.campaign_members where campaign_id=sess.campaign_id and user_id=auth.uid();
  select * into own_token from public.session_tokens where session_id=sess.id and character_id=own_character;
  if own_token.id is null then return result; end if;
  select coalesce((sheet->>'vision')::numeric,30) into vision from public.characters where id=own_character;
  for candidate in select * from public.session_tokens where session_id=sess.id loop
    is_blocked := exists(select 1 from public.scene_objects w where w.scene_id=sess.scene_id and w.object_type='wall' and coalesce((w.state->>'active')::boolean,true) and w.config ? 'x2' and w.config ? 'y2' and private.roll30_segments_intersect(own_token.x,own_token.y,candidate.x,candidate.y,w.x,w.y,(w.config->>'x2')::double precision,(w.config->>'y2')::double precision));
    if candidate.id=own_token.id or (sqrt(power(candidate.x-own_token.x,2)+power(candidate.y-own_token.y,2))<=vision and not is_blocked) then result := result || jsonb_build_array(jsonb_build_object('id',candidate.id,'character_id',candidate.character_id,'name',candidate.name,'x',candidate.x,'y',candidate.y,'speed',candidate.speed)); end if;
  end loop;
  return result;
end;
$$;

create or replace function public.add_roll30_session_token(target_session uuid, target_character uuid)
returns public.session_tokens language plpgsql security definer set search_path=public as $$
declare sess public.sessions; character public.characters; result public.session_tokens;
begin
  select * into sess from public.sessions where id=target_session for update;
  if sess.id is null or not public.is_campaign_gm(sess.campaign_id) then raise exception 'Only the GM can add tokens'; end if;
  select * into character from public.characters where id=target_character;
  if character.id is null or character.campaign_id<>sess.campaign_id then raise exception 'Character is not in this campaign'; end if;
  insert into public.session_tokens(session_id,character_id,name,x,y,speed) values(sess.id,character.id,character.name,50,50,coalesce((character.sheet->>'speed')::numeric,30)) returning * into result;
  update public.sessions set updated_at=now() where id=sess.id;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(sess.id,auth.uid(),'token_added',jsonb_build_object('token_id',result.id,'character_id',result.character_id));
  return result;
end;
$$;

revoke all on function public.get_visible_roll30_tokens(uuid) from public,anon;
revoke all on function public.add_roll30_session_token(uuid,uuid) from public,anon;
grant execute on function public.get_visible_roll30_tokens(uuid) to authenticated;
grant execute on function public.add_roll30_session_token(uuid,uuid) to authenticated;

create or replace function public.move_roll30_token(target_session uuid, target_token text, target_x integer, target_y integer)
returns public.sessions language plpgsql security definer set search_path=public as $$
declare
  current_session public.sessions; token public.session_tokens; character_owner uuid; result public.sessions;
  origin_x integer; origin_y integer; destination_x integer := greatest(2,least(98,target_x)); destination_y integer := greatest(2,least(98,target_y)); wall public.scene_objects;
  is_gm boolean; move_state jsonb; spent numeric; distance numeric; next_state jsonb;
begin
  select * into current_session from public.sessions where id=target_session for update;
  if current_session.id is null or not public.is_campaign_member(current_session.campaign_id) then raise exception 'Not permitted'; end if;
  select * into token from public.session_tokens where id=target_token::uuid and session_id=current_session.id for update;
  if token.id is null then raise exception 'Token not found'; end if;
  select owner_id into character_owner from public.characters where id=token.character_id;
  is_gm := public.is_campaign_gm(current_session.campaign_id);
  if not (is_gm or character_owner = auth.uid()) then raise exception 'You can only move your own token'; end if;
  origin_x := token.x; origin_y := token.y; distance := sqrt(power(destination_x-origin_x,2)+power(destination_y-origin_y,2));
  move_state := coalesce(current_session.state->'movement','{}'::jsonb);
  spent := case when coalesce((move_state->target_token->>'turn')::integer,-1)=current_session.active_turn then coalesce((move_state->target_token->>'spent')::numeric,0) else 0 end;
  if not is_gm and spent+distance>token.speed then raise exception 'That move exceeds this token''s speed for the turn'; end if;
  if current_session.scene_id is not null then
    for wall in select * from public.scene_objects where scene_id=current_session.scene_id and object_type='wall' and coalesce((state->>'active')::boolean,true) loop
      if wall.config ? 'x2' and wall.config ? 'y2' and private.roll30_segments_intersect(origin_x,origin_y,destination_x,destination_y,wall.x,wall.y,(wall.config->>'x2')::double precision,(wall.config->>'y2')::double precision) then raise exception 'That movement crosses a wall'; end if;
    end loop;
  end if;
  update public.session_tokens set x=destination_x,y=destination_y where id=token.id;
  move_state := jsonb_set(move_state,array[target_token],jsonb_build_object('turn',current_session.active_turn,'spent',spent+distance),true);
  next_state := jsonb_set(current_session.state,'{movement}',move_state,true);
  update public.sessions set state=next_state,updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,auth.uid(),'token_moved',jsonb_build_object('token_id',target_token,'x',destination_x,'y',destination_y,'distance',distance));
  return result;
end;
$$;

revoke all on function public.move_roll30_token(uuid,text,integer,integer) from public,anon;
grant execute on function public.move_roll30_token(uuid,text,integer,integer) to authenticated;
