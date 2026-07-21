create or replace function private.prepare_roll30_charged_inventory()
returns trigger
language plpgsql set search_path=public
as $$
declare maximum_charges integer;
begin
  select greatest(0,coalesce((item.item_data->>'charges')::integer,0))
  into maximum_charges from public.items item where item.id=new.item_id;
  if maximum_charges>0 then
    if new.quantity<>1 then raise exception 'Charged items are tracked individually and cannot be stacked'; end if;
    if exists(select 1 from public.character_inventory existing where existing.character_id=new.character_id and existing.item_id=new.item_id) then
      raise exception 'That character already has this charged item';
    end if;
    if not (coalesce(new.metadata,'{}'::jsonb)?'charges') then
      new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('charges',jsonb_build_object('current',maximum_charges,'max',maximum_charges));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_roll30_charged_inventory on public.character_inventory;
create trigger prepare_roll30_charged_inventory
before insert on public.character_inventory
for each row execute function private.prepare_roll30_charged_inventory();

create or replace function public.mutate_roll30_inventory(source_character uuid,target_item uuid,operation text,amount integer default 1,destination_character uuid default null)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare source_row public.characters;destination_row public.characters;item_row public.items;inventory_row public.character_inventory;next_quantity integer;maximum_charges integer;
begin
  if operation not in ('equip','unequip','consume','transfer') then raise exception 'Unknown inventory operation'; end if;
  if amount<1 then raise exception 'Quantity must be at least one'; end if;
  select * into source_row from public.characters where id=source_character;
  if source_row.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(source_row.campaign_id) or source_row.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  select * into item_row from public.items where id=target_item and campaign_id=source_row.campaign_id;
  if item_row.id is null then raise exception 'Item not found'; end if;
  maximum_charges:=greatest(0,coalesce((item_row.item_data->>'charges')::integer,0));
  select * into inventory_row from public.character_inventory where character_id=source_character and item_id=target_item for update;
  if inventory_row.item_id is null or inventory_row.quantity<amount then raise exception 'Not enough of that item'; end if;
  if operation in ('equip','unequip') then
    update public.character_inventory set metadata=jsonb_set(metadata,'{equipped}',to_jsonb(operation='equip'),true)
    where character_id=source_character and item_id=target_item;
    return jsonb_build_object('operation',operation,'quantity',inventory_row.quantity);
  end if;
  if operation='transfer' then
    if destination_character is null or destination_character=source_character then raise exception 'Choose another character'; end if;
    select * into destination_row from public.characters where id=destination_character;
    if destination_row.id is null or destination_row.campaign_id<>source_row.campaign_id then raise exception 'Destination must be in this campaign'; end if;
    if maximum_charges>0 and amount<>inventory_row.quantity then raise exception 'A charged item must be transferred as one item'; end if;
  end if;
  next_quantity:=inventory_row.quantity-amount;
  if next_quantity=0 then delete from public.character_inventory where character_id=source_character and item_id=target_item;
  else update public.character_inventory set quantity=next_quantity where character_id=source_character and item_id=target_item; end if;
  if operation='consume' then
    if coalesce((item_row.item_data->'effect'->>'healing')::integer,0)>0 then
      update public.characters set hp_current=least(coalesce(hp_max,999999),coalesce(hp_current,0)+(item_row.item_data->'effect'->>'healing')::integer),updated_at=now()
      where id=source_character;
    end if;
    return jsonb_build_object('operation','consume','remaining',next_quantity);
  end if;
  if maximum_charges>0 then
    insert into public.character_inventory(character_id,item_id,quantity,metadata)
    values(destination_character,target_item,amount,inventory_row.metadata);
  else
    insert into public.character_inventory(character_id,item_id,quantity)
    values(destination_character,target_item,amount)
    on conflict(character_id,item_id) do update set quantity=public.character_inventory.quantity+excluded.quantity;
  end if;
  return jsonb_build_object('operation','transfer','quantity',amount,'destination',destination_character);
end;
$$;
