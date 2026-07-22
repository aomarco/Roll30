create or replace function public.retreat_roll30_turn(target_session uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.sessions;
  initiative_count integer;
  previous_turn integer;
  previous_round integer;
begin
  select * into result
  from public.sessions
  where id = target_session and status = 'active'
  for update;
  if result.id is null then raise exception 'Active session not found'; end if;
  if not public.is_campaign_gm(result.campaign_id) then
    raise exception 'Only the GM can move to the previous turn';
  end if;

  initiative_count := jsonb_array_length(coalesce(result.state -> 'initiative', '[]'::jsonb));
  if initiative_count = 0 then raise exception 'Add initiative entries before changing turns'; end if;
  if result.active_turn = 0 and result.round = 1 then
    raise exception 'The table is already at the first turn';
  end if;

  previous_turn := result.active_turn - 1;
  previous_round := result.round;
  if previous_turn < 0 then
    previous_turn := initiative_count - 1;
    previous_round := greatest(1, result.round - 1);
  end if;

  update public.sessions
  set active_turn = previous_turn, round = previous_round, updated_at = now()
  where id = result.id
  returning * into result;
  insert into public.session_events(session_id, actor_id, event_type, payload)
  values(result.id, auth.uid(), 'turn_retreated', jsonb_build_object(
    'active_turn', result.active_turn,
    'round', result.round
  ));
  return result;
end;
$$;

revoke all on function public.retreat_roll30_turn(uuid) from public, anon;
grant execute on function public.retreat_roll30_turn(uuid) to authenticated;
