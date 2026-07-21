create or replace function public.move_roll30_token(target_session uuid, target_token text, target_x integer, target_y integer)
returns public.sessions language plpgsql security definer set search_path=public as $$
declare
  current_session public.sessions; token jsonb; character_owner uuid; updated_tokens jsonb; result public.sessions;
  origin_x integer; origin_y integer; destination_x integer := greatest(2,least(98,target_x)); destination_y integer := greatest(2,least(98,target_y)); wall public.scene_objects;
  is_gm boolean; move_state jsonb; spent numeric; distance numeric; speed numeric; next_state jsonb;
begin
  select * into current_session from public.sessions where id = target_session for update;
  if current_session.id is null or not public.is_campaign_member(current_session.campaign_id) then raise exception 'Not permitted'; end if;
  select value into token from jsonb_array_elements(coalesce(current_session.state->'tokens','[]'::jsonb)) where value->>'id' = target_token;
  if token is null then raise exception 'Token not found'; end if;
  select owner_id into character_owner from public.characters where id = (token->>'character_id')::uuid;
  is_gm := public.is_campaign_gm(current_session.campaign_id);
  if not (is_gm or character_owner = auth.uid()) then raise exception 'You can only move your own token'; end if;
  origin_x := (token->>'x')::integer; origin_y := (token->>'y')::integer;
  distance := sqrt(power(destination_x-origin_x,2) + power(destination_y-origin_y,2)); speed := coalesce((token->>'speed')::numeric,30);
  move_state := coalesce(current_session.state->'movement','{}'::jsonb);
  spent := case when coalesce((move_state->target_token->>'turn')::integer,-1)=current_session.active_turn then coalesce((move_state->target_token->>'spent')::numeric,0) else 0 end;
  if not is_gm and spent + distance > speed then raise exception 'That move exceeds this token''s speed for the turn'; end if;
  if current_session.scene_id is not null then
    for wall in select * from public.scene_objects where scene_id=current_session.scene_id and object_type='wall' and coalesce((state->>'active')::boolean,true) loop
      if wall.config ? 'x2' and wall.config ? 'y2' and private.roll30_segments_intersect(origin_x,origin_y,destination_x,destination_y,wall.x,wall.y,(wall.config->>'x2')::double precision,(wall.config->>'y2')::double precision) then raise exception 'That movement crosses a wall'; end if;
    end loop;
  end if;
  select jsonb_agg(case when value->>'id' = target_token then value || jsonb_build_object('x', destination_x, 'y', destination_y) else value end) into updated_tokens from jsonb_array_elements(coalesce(current_session.state->'tokens','[]'::jsonb));
  move_state := jsonb_set(move_state,array[target_token],jsonb_build_object('turn',current_session.active_turn,'spent',spent+distance),true);
  next_state := jsonb_set(jsonb_set(current_session.state,'{tokens}',coalesce(updated_tokens,'[]'::jsonb),true),'{movement}',move_state,true);
  update public.sessions set state = next_state, updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,auth.uid(),'token_moved',jsonb_build_object('token_id',target_token,'x',destination_x,'y',destination_y,'distance',distance));
  return result;
end;
$$;

revoke all on function public.move_roll30_token(uuid,text,integer,integer) from public,anon;
grant execute on function public.move_roll30_token(uuid,text,integer,integer) to authenticated;
