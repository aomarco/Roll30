-- Turns cycle through the configured initiative order and roll the round only
-- when the order wraps.
create or replace function public.advance_roll30_turn(target_session uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.sessions;
  initiative_count integer;
  next_turn integer;
  next_round integer;
begin
  select * into result from public.sessions where id = target_session for update;
  if result.id is null then raise exception 'Session not found'; end if;
  if not public.is_campaign_gm(result.campaign_id) then raise exception 'Only the GM can advance the shared turn'; end if;
  initiative_count := jsonb_array_length(coalesce(result.state->'initiative', '[]'::jsonb));
  next_turn := result.active_turn + 1;
  next_round := result.round;
  if initiative_count > 0 and next_turn >= initiative_count then
    next_turn := 0;
    next_round := result.round + 1;
  end if;
  update public.sessions set active_turn = next_turn, round = next_round, updated_at = now()
  where id = target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload)
  values(target_session,auth.uid(),'turn_advanced',jsonb_build_object('active_turn',result.active_turn,'round',result.round));
  return result;
end;
$$;

revoke all on function public.advance_roll30_turn(uuid) from public, anon;
grant execute on function public.advance_roll30_turn(uuid) to authenticated;
