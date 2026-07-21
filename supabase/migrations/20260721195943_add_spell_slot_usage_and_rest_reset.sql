create or replace function public.use_roll30_spell_slot(target_character uuid,slot_level integer)
returns public.characters language plpgsql security definer set search_path=public as $$
declare c public.characters; slots jsonb; entry jsonb; slot_index integer; current_value integer; result public.characters; active_session uuid;
begin
  if slot_level not between 1 and 9 then raise exception 'Spell level must be from 1 to 9'; end if;
  select * into c from public.characters where id=target_character for update;
  if c.id is null or not (public.is_campaign_gm(c.campaign_id) or c.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  slots:=coalesce(c.sheet->'spellcasting'->'slots','[]'::jsonb);
  for slot_index in 0..jsonb_array_length(slots)-1 loop entry:=slots->slot_index;if (entry->>'level')::integer=slot_level then current_value:=coalesce((entry->>'current')::integer,0);if current_value<1 then raise exception 'No level % spell slots remain',slot_level;end if;slots:=jsonb_set(slots,array[slot_index::text,'current'],to_jsonb(current_value-1),false);update public.characters set sheet=jsonb_set(sheet,'{spellcasting,slots}',slots,true),sheet_revision=sheet_revision+1,updated_at=now() where id=c.id returning * into result;select id into active_session from public.sessions where campaign_id=c.campaign_id and status='active';if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'spell_slot_used',jsonb_build_object('character',c.name,'level',slot_level));end if;return result;end if;end loop;
  raise exception 'That spell-slot level is not configured';
end; $$;

create or replace function public.rest_roll30_character(target_character uuid, rest_type text)
returns public.characters language plpgsql security definer set search_path=public as $$
declare c public.characters; resources jsonb; entry jsonb; resource_index integer; reset_kind text; slots jsonb; slot_index integer; result public.characters;
begin
  if rest_type not in ('short','long') then raise exception 'Rest must be short or long'; end if;select * into c from public.characters where id=target_character for update;if c.id is null or not (public.is_campaign_gm(c.campaign_id) or c.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted';end if;
  resources:=coalesce(c.sheet->'resources','[]'::jsonb);if jsonb_typeof(resources)='array' and jsonb_array_length(resources)>0 then for resource_index in 0..jsonb_array_length(resources)-1 loop entry:=resources->resource_index;reset_kind:=coalesce(entry->>'reset','long');if rest_type='long' or reset_kind='short' then resources:=jsonb_set(resources,array[resource_index::text,'current'],to_jsonb(coalesce((entry->>'max')::integer,0)),true);end if;end loop;end if;
  slots:=coalesce(c.sheet->'spellcasting'->'slots','[]'::jsonb);if rest_type='long' and jsonb_typeof(slots)='array' and jsonb_array_length(slots)>0 then for slot_index in 0..jsonb_array_length(slots)-1 loop slots:=jsonb_set(slots,array[slot_index::text,'current'],to_jsonb(coalesce((slots->slot_index->>'max')::integer,0)),true);end loop;end if;
  update public.characters set sheet=jsonb_set(jsonb_set(sheet,'{resources}',resources,true),'{spellcasting,slots}',slots,true),sheet_revision=sheet_revision+1,hp_current=case when rest_type='long' then hp_max else hp_current end,updated_at=now() where id=c.id returning * into result;return result;
end; $$;

revoke all on function public.use_roll30_spell_slot(uuid,integer) from public,anon;
grant execute on function public.use_roll30_spell_slot(uuid,integer) to authenticated;
