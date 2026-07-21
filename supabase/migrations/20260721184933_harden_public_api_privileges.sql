-- RLS remains the primary authorization boundary, but anonymous clients do
-- not need direct access to any Roll30 data or RPC. Removing the redundant
-- grants makes accidental policy regressions less dangerous.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

-- RPCs and policy helpers intentionally exposed to signed-in users.
grant execute on function public.is_campaign_member(uuid) to authenticated;
grant execute on function public.is_campaign_gm(uuid) to authenticated;
grant execute on function public.create_roll30_campaign(text) to authenticated;
grant execute on function public.join_roll30_campaign(text) to authenticated;
grant execute on function public.change_roll30_hp(uuid, integer) to authenticated;
grant execute on function public.resolve_roll30_purchase(uuid, boolean) to authenticated;
grant execute on function public.assign_roll30_character(uuid, uuid) to authenticated;
grant execute on function public.execute_roll30_trigger(uuid, uuid) to authenticated;
grant execute on function public.advance_roll30_turn(uuid) to authenticated;
grant execute on function public.request_roll30_purchase(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.duplicate_roll30_scene(uuid) to authenticated;
grant execute on function public.resolve_roll30_attack(uuid, uuid) to authenticated;
grant execute on function public.save_roll30_scene_template(uuid, text) to authenticated;
grant execute on function public.create_roll30_scene_from_template(uuid, text) to authenticated;
grant execute on function public.move_roll30_token(uuid, text, integer, integer) to authenticated;
grant execute on function public.get_visible_roll30_tokens(uuid) to authenticated;
grant execute on function public.add_roll30_session_token(uuid, uuid) to authenticated;
grant execute on function public.snapshot_roll30_session(uuid, text) to authenticated;
grant execute on function public.restore_roll30_snapshot(uuid) to authenticated;
grant execute on function public.add_roll30_initiative_entry(uuid, uuid, numeric) to authenticated;
grant execute on function public.remove_roll30_initiative_entry(uuid, uuid) to authenticated;
grant execute on function public.remove_roll30_session_token(uuid, uuid) to authenticated;

-- The access-gate validator is server-only and update-trigger functions are
-- invoked by Postgres triggers, never directly by browser clients.
revoke all on function public.validate_access_password(text, text) from authenticated;
grant execute on function public.validate_access_password(text, text) to service_role;
revoke execute on function public.touch_updated_at() from authenticated;
