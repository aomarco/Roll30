-- Automation rules may change only a tightly defined subset of session state.
create or replace function public.execute_roll30_trigger(target_trigger uuid, target_session uuid)
returns public.session_events
language plpgsql
security definer
set search_path = public
as $$
declare
  rule public.scene_triggers;
  sess public.sessions;
  result public.session_events;
  effect jsonb;
  next_state jsonb;
  next_round integer;
  rule_campaign uuid;
begin
  select * into rule from public.scene_triggers where id = target_trigger and enabled;
  if rule.id is null then raise exception 'Trigger not found or disabled'; end if;
  select campaign_id into rule_campaign from public.scenes where id = rule.scene_id;
  select * into sess from public.sessions where id = target_session for update;
  if sess.id is null or sess.campaign_id <> rule_campaign then
    raise exception 'Trigger and session must belong to the same campaign';
  end if;
  if not public.is_campaign_gm(sess.campaign_id) then
    raise exception 'Only the GM can execute this trigger';
  end if;

  next_state := coalesce(sess.state, '{}'::jsonb);
  next_round := sess.round;
  for effect in select value from jsonb_array_elements(coalesce(rule.effects, '[]'::jsonb)) loop
    case effect->>'type'
      when 'show_fog' then next_state := jsonb_set(next_state, '{fog}', 'true'::jsonb, true);
      when 'clear_fog' then next_state := jsonb_set(next_state, '{fog}', 'false'::jsonb, true);
      when 'advance_round' then next_round := next_round + 1;
      else null;
    end case;
  end loop;

  update public.sessions set state = next_state, round = next_round, updated_at = now() where id = sess.id;
  insert into public.session_events(session_id, actor_id, event_type, payload)
  values(target_session, auth.uid(), 'trigger_executed', jsonb_build_object('trigger_id', rule.id, 'name', rule.name, 'effects', rule.effects))
  returning * into result;
  return result;
end;
$$;

revoke all on function public.execute_roll30_trigger(uuid, uuid) from public, anon;
grant execute on function public.execute_roll30_trigger(uuid, uuid) to authenticated;
