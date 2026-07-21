alter table public.scene_objects drop constraint scene_objects_object_type_check;
alter table public.scene_objects add constraint scene_objects_object_type_check check (object_type in ('object','door','lever','trap','light','wall'));

create schema if not exists private;
create or replace function private.roll30_segments_intersect(ax double precision, ay double precision, bx double precision, by double precision, cx double precision, cy double precision, dx double precision, dy double precision)
returns boolean language sql immutable set search_path=pg_catalog as $$
  select (((bx-ax)*(cy-ay)-(by-ay)*(cx-ax)) * ((bx-ax)*(dy-ay)-(by-ay)*(dx-ax)) < 0)
    and (((dx-cx)*(ay-cy)-(dy-cy)*(ax-cx)) * ((dx-cx)*(by-cy)-(dy-cy)*(bx-cx)) < 0)
$$;

create or replace function public.move_roll30_token(target_session uuid, target_token text, target_x integer, target_y integer)
returns public.sessions language plpgsql security definer set search_path=public as $$
declare
  current_session public.sessions; token jsonb; character_owner uuid; updated_tokens jsonb; result public.sessions;
  origin_x integer; origin_y integer; destination_x integer := greatest(2,least(98,target_x)); destination_y integer := greatest(2,least(98,target_y)); wall public.scene_objects;
begin
  select * into current_session from public.sessions where id = target_session for update;
  if current_session.id is null or not public.is_campaign_member(current_session.campaign_id) then raise exception 'Not permitted'; end if;
  select value into token from jsonb_array_elements(coalesce(current_session.state->'tokens','[]'::jsonb)) where value->>'id' = target_token;
  if token is null then raise exception 'Token not found'; end if;
  select owner_id into character_owner from public.characters where id = (token->>'character_id')::uuid;
  if not (public.is_campaign_gm(current_session.campaign_id) or character_owner = auth.uid()) then raise exception 'You can only move your own token'; end if;
  origin_x := (token->>'x')::integer; origin_y := (token->>'y')::integer;
  if current_session.scene_id is not null then
    for wall in select * from public.scene_objects where scene_id=current_session.scene_id and object_type='wall' and coalesce((state->>'active')::boolean,true) loop
      if wall.config ? 'x2' and wall.config ? 'y2' and private.roll30_segments_intersect(origin_x,origin_y,destination_x,destination_y,wall.x,wall.y,(wall.config->>'x2')::double precision,(wall.config->>'y2')::double precision) then raise exception 'That movement crosses a wall'; end if;
    end loop;
  end if;
  select jsonb_agg(case when value->>'id' = target_token then value || jsonb_build_object('x', destination_x, 'y', destination_y) else value end) into updated_tokens from jsonb_array_elements(coalesce(current_session.state->'tokens','[]'::jsonb));
  update public.sessions set state = jsonb_set(current_session.state,'{tokens}',coalesce(updated_tokens,'[]'::jsonb)), updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(target_session,auth.uid(),'token_moved',jsonb_build_object('token_id',target_token,'x',destination_x,'y',destination_y));
  return result;
end;
$$;

revoke all on function public.move_roll30_token(uuid,text,integer,integer) from public,anon;
grant execute on function public.move_roll30_token(uuid,text,integer,integer) to authenticated;
