create or replace function public.use_roll30_character_resource(target_character uuid, resource_name text, amount integer default 1)
returns public.characters language plpgsql security definer set search_path=public as $$
declare c public.characters; resources jsonb; entry jsonb; resource_index integer; current_value integer; result public.characters;
begin
  if amount < 1 then raise exception 'Amount must be at least one'; end if;
  select * into c from public.characters where id=target_character for update;
  if c.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(c.campaign_id) or c.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  resources:=coalesce(c.sheet->'resources','[]'::jsonb);
  if jsonb_typeof(resources)<>'array' then raise exception 'Character resources are invalid'; end if;
  for resource_index in 0..jsonb_array_length(resources)-1 loop
    entry:=resources->resource_index;
    if lower(entry->>'name')=lower(resource_name) then
      current_value:=coalesce((entry->>'current')::integer,0);
      if current_value<amount then raise exception 'Not enough % remaining',resource_name; end if;
      resources:=jsonb_set(resources,array[resource_index::text,'current'],to_jsonb(current_value-amount),false);
      update public.characters set sheet=jsonb_set(sheet,'{resources}',resources,true),sheet_revision=sheet_revision+1,updated_at=now() where id=c.id returning * into result;
      return result;
    end if;
  end loop;
  raise exception 'Resource not found';
end; $$;

create or replace function public.rest_roll30_character(target_character uuid, rest_type text)
returns public.characters language plpgsql security definer set search_path=public as $$
declare c public.characters; resources jsonb; entry jsonb; resource_index integer; reset_kind text; result public.characters;
begin
  if rest_type not in ('short','long') then raise exception 'Rest must be short or long'; end if;
  select * into c from public.characters where id=target_character for update;
  if c.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(c.campaign_id) or c.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  resources:=coalesce(c.sheet->'resources','[]'::jsonb);
  if jsonb_typeof(resources)='array' and jsonb_array_length(resources)>0 then
    for resource_index in 0..jsonb_array_length(resources)-1 loop
      entry:=resources->resource_index; reset_kind:=coalesce(entry->>'reset','long');
      if rest_type='long' or reset_kind='short' then resources:=jsonb_set(resources,array[resource_index::text,'current'],to_jsonb(coalesce((entry->>'max')::integer,0)),true); end if;
    end loop;
  end if;
  update public.characters set sheet=jsonb_set(sheet,'{resources}',resources,true),sheet_revision=sheet_revision+1,hp_current=case when rest_type='long' then hp_max else hp_current end,updated_at=now() where id=c.id returning * into result;
  return result;
end; $$;

revoke all on function public.use_roll30_character_resource(uuid,text,integer) from public,anon;
revoke all on function public.rest_roll30_character(uuid,text) from public,anon;
grant execute on function public.use_roll30_character_resource(uuid,text,integer) to authenticated;
grant execute on function public.rest_roll30_character(uuid,text) to authenticated;
