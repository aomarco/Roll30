alter table public.sessions
  add column session_code text not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  add column ended_at timestamptz;
create unique index sessions_session_code_idx on public.sessions(session_code);
create unique index sessions_one_active_per_campaign_idx on public.sessions(campaign_id) where status='active';
revoke insert, update, delete on public.sessions from authenticated;

create or replace function public.start_roll30_session(target_campaign uuid,target_scene uuid)
returns public.sessions language plpgsql security definer set search_path=public as $$
declare scene_row public.scenes; result public.sessions;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'Only a GM can start a session'; end if;
  if exists(select 1 from public.sessions where campaign_id=target_campaign and status='active') then raise exception 'This campaign already has an active session'; end if;
  select * into scene_row from public.scenes where id=target_scene and campaign_id=target_campaign and deleted_at is null;
  if scene_row.id is null then raise exception 'Scene not found'; end if;
  insert into public.sessions(campaign_id,scene_id,state) values(target_campaign,target_scene,'{"fog":false,"initiative":[],"movement":{}}') returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'session_started',jsonb_build_object('scene_id',target_scene,'session_code',result.session_code));
  return result;
end; $$;

create or replace function public.end_roll30_session(target_session uuid)
returns public.sessions language plpgsql security definer set search_path=public as $$
declare result public.sessions;
begin
  select * into result from public.sessions where id=target_session for update;
  if result.id is null or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only a GM can end this session'; end if;
  if result.status<>'active' then raise exception 'Session is not active'; end if;
  update public.sessions set status='ended',ended_at=now(),updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'session_ended','{}');
  return result;
end; $$;

create or replace function public.resume_roll30_session(target_session uuid)
returns public.sessions language plpgsql security definer set search_path=public as $$
declare result public.sessions;
begin
  select * into result from public.sessions where id=target_session for update;
  if result.id is null or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only a GM can resume this session'; end if;
  if exists(select 1 from public.sessions where campaign_id=result.campaign_id and status='active' and id<>result.id) then raise exception 'End the current session before resuming another'; end if;
  update public.sessions set status='active',ended_at=null,updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'session_resumed','{}');
  return result;
end; $$;

create or replace function public.change_roll30_session_scene(target_session uuid,target_scene uuid)
returns public.sessions language plpgsql security definer set search_path=public as $$
declare result public.sessions;
begin
  select * into result from public.sessions where id=target_session for update;
  if result.id is null or result.status<>'active' or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only a GM can change the active scene'; end if;
  if not exists(select 1 from public.scenes where id=target_scene and campaign_id=result.campaign_id and deleted_at is null) then raise exception 'Scene not found'; end if;
  update public.sessions set scene_id=target_scene,updated_at=now() where id=target_session returning * into result;
  insert into public.session_events(session_id,actor_id,event_type,payload) values(result.id,auth.uid(),'scene_changed',jsonb_build_object('scene_id',target_scene));
  return result;
end; $$;

revoke all on function public.start_roll30_session(uuid,uuid) from public,anon;
revoke all on function public.end_roll30_session(uuid) from public,anon;
revoke all on function public.resume_roll30_session(uuid) from public,anon;
revoke all on function public.change_roll30_session_scene(uuid,uuid) from public,anon;
grant execute on function public.start_roll30_session(uuid,uuid) to authenticated;
grant execute on function public.end_roll30_session(uuid) to authenticated;
grant execute on function public.resume_roll30_session(uuid) to authenticated;
grant execute on function public.change_roll30_session_scene(uuid,uuid) to authenticated;
