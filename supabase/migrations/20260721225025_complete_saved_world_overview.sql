create or replace function public.set_roll30_world_flag(
  target_campaign uuid,
  flag_name text,
  flag_enabled boolean default true,
  remove_flag boolean default false
)
returns public.campaigns
language plpgsql security definer set search_path=public
as $$
declare campaign_row public.campaigns;flags jsonb;normalized_name text:=trim(coalesce(flag_name,''));active_session uuid;
begin
  select * into campaign_row from public.campaigns where id=target_campaign for update;
  if campaign_row.id is null or not public.is_campaign_gm(campaign_row.id) then raise exception 'Only a campaign GM can manage world flags';end if;
  if length(normalized_name) not between 1 and 160 then raise exception 'World flag name must be between 1 and 160 characters';end if;
  select coalesce(jsonb_agg(flag),'[]'::jsonb) into flags
  from jsonb_array_elements(coalesce(campaign_row.settings->'world_flags','[]'::jsonb)) flag
  where lower(flag->>'name')<>lower(normalized_name);
  if not remove_flag then flags:=flags||jsonb_build_array(jsonb_build_object('name',normalized_name,'enabled',coalesce(flag_enabled,true),'updated_at',now(),'updated_by',auth.uid()));end if;
  update public.campaigns set settings=jsonb_set(settings,'{world_flags}',flags,true),updated_at=now() where id=campaign_row.id returning * into campaign_row;
  select id into active_session from public.sessions where campaign_id=campaign_row.id and status='active';
  if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'world_flag_changed',jsonb_build_object('name',normalized_name,'enabled',flag_enabled,'removed',remove_flag));end if;
  return campaign_row;
end;
$$;

revoke all on function public.set_roll30_world_flag(uuid,text,boolean,boolean) from public,anon;
grant execute on function public.set_roll30_world_flag(uuid,text,boolean,boolean) to authenticated;
