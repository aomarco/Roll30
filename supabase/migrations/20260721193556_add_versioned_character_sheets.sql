alter table public.characters
  add column sheet_schema_version smallint not null default 1 check (sheet_schema_version = 1),
  add column sheet_revision bigint not null default 0 check (sheet_revision >= 0),
  add column portrait_asset_id uuid references public.campaign_assets(id) on delete set null;

alter table public.characters
  add constraint characters_sheet_is_object check (jsonb_typeof(sheet) = 'object'),
  add constraint characters_hp_is_valid check (
    (hp_max is null or hp_max >= 0)
    and (hp_current is null or hp_current >= 0)
    and (hp_max is null or hp_current is null or hp_current <= hp_max)
  );

create index characters_portrait_asset_idx on public.characters(portrait_asset_id) where portrait_asset_id is not null;

drop policy if exists "players update owned characters" on public.characters;
create policy "players create owned player characters" on public.characters for insert to authenticated
with check (
  kind = 'pc'
  and owner_id = (select auth.uid())
  and public.is_campaign_member(campaign_id)
);
create policy "players delete owned player characters" on public.characters for delete to authenticated
using (
  kind = 'pc'
  and owner_id = (select auth.uid())
  and public.is_campaign_member(campaign_id)
);

revoke update on public.characters from authenticated;

create or replace function public.update_roll30_character_sheet(
  target_character uuid,
  expected_revision bigint,
  next_sheet jsonb,
  target_hp_current integer,
  target_hp_max integer,
  target_portrait uuid default null
)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare
  current_character public.characters;
  result public.characters;
  ability_value jsonb;
begin
  select * into current_character from public.characters where id = target_character for update;
  if current_character.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(current_character.campaign_id) or current_character.owner_id is not distinct from auth.uid()) then
    raise exception 'Not permitted';
  end if;
  if current_character.sheet_revision <> expected_revision then
    raise exception 'This sheet changed elsewhere. Reopen it before saving.';
  end if;
  if next_sheet is null or jsonb_typeof(next_sheet) <> 'object' then raise exception 'Sheet must be an object'; end if;
  if next_sheet ? 'abilities' and jsonb_typeof(next_sheet -> 'abilities') <> 'object' then raise exception 'Abilities must be an object'; end if;
  if next_sheet ? 'conditions' and jsonb_typeof(next_sheet -> 'conditions') <> 'array' then raise exception 'Conditions must be a list'; end if;
  if next_sheet ? 'features' and jsonb_typeof(next_sheet -> 'features') <> 'array' then raise exception 'Features must be a list'; end if;
  if next_sheet ? 'equipment' and jsonb_typeof(next_sheet -> 'equipment') <> 'array' then raise exception 'Equipment must be a list'; end if;
  if next_sheet ? 'attacks' and jsonb_typeof(next_sheet -> 'attacks') <> 'array' then raise exception 'Attacks must be a list'; end if;
  if next_sheet ? 'currency' and jsonb_typeof(next_sheet -> 'currency') <> 'object' then raise exception 'Currency must be an object'; end if;
  for ability_value in select value from jsonb_each(coalesce(next_sheet -> 'abilities', '{}'::jsonb)) loop
    if jsonb_typeof(ability_value) <> 'number' or (ability_value #>> '{}')::integer not between 1 and 30 then
      raise exception 'Ability scores must be whole numbers from 1 to 30';
    end if;
  end loop;
  if coalesce((next_sheet -> 'currency' ->> 'gp')::numeric, 0) < 0 then raise exception 'Currency cannot be negative'; end if;
  if target_hp_max is not null and target_hp_max < 0 then raise exception 'Maximum HP cannot be negative'; end if;
  if target_hp_current is not null and target_hp_current < 0 then raise exception 'Current HP cannot be negative'; end if;
  if target_hp_max is not null and target_hp_current is not null and target_hp_current > target_hp_max then raise exception 'Current HP cannot exceed maximum HP'; end if;
  if target_portrait is not null and not exists (
    select 1 from public.campaign_assets
    where id = target_portrait and campaign_id = current_character.campaign_id and kind in ('image','portrait')
  ) then raise exception 'Portrait must be an image from this campaign'; end if;

  update public.characters
  set sheet = next_sheet,
      sheet_schema_version = 1,
      sheet_revision = sheet_revision + 1,
      hp_current = target_hp_current,
      hp_max = target_hp_max,
      portrait_asset_id = target_portrait,
      updated_at = now()
  where id = target_character
  returning * into result;
  return result;
end;
$$;

revoke all on function public.update_roll30_character_sheet(uuid, bigint, jsonb, integer, integer, uuid) from public, anon;
grant execute on function public.update_roll30_character_sheet(uuid, bigint, jsonb, integer, integer, uuid) to authenticated;
