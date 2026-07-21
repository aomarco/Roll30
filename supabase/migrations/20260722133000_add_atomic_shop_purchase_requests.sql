create or replace function public.request_roll30_purchase(target_shop uuid, target_item uuid, target_character uuid, requested_quantity integer default 1)
returns public.purchase_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  shop public.shops;
  stock public.shop_stock;
  character public.characters;
  result public.purchase_requests;
  mode text;
  gp integer;
  total integer;
begin
  if requested_quantity < 1 then raise exception 'Quantity must be at least one'; end if;
  select * into shop from public.shops where id = target_shop;
  if shop.id is null or not public.is_campaign_member(shop.campaign_id) then raise exception 'Shop not found'; end if;
  select * into character from public.characters where id = target_character for update;
  if character.id is null or character.campaign_id <> shop.campaign_id then raise exception 'Character is not in this campaign'; end if;
  if character.owner_id <> auth.uid() and not public.is_campaign_gm(shop.campaign_id) then raise exception 'You can only purchase for your own character'; end if;
  select * into stock from public.shop_stock where shop_id = target_shop and item_id = target_item for update;
  if stock.item_id is null then raise exception 'Item is no longer stocked'; end if;
  if stock.quantity is not null and stock.quantity < requested_quantity then raise exception 'Not enough stock'; end if;

  mode := coalesce(shop.settings->>'mode', 'approval');
  insert into public.purchase_requests(shop_id,item_id,character_id,quantity,requested_by,status)
  values(target_shop,target_item,target_character,requested_quantity,auth.uid(),case when mode = 'automatic' then 'completed' else 'pending' end)
  returning * into result;
  if mode <> 'automatic' then return result; end if;

  gp := coalesce((character.sheet->'currency'->>'gp')::integer,0);
  total := stock.price * requested_quantity;
  if gp < total then raise exception 'Character cannot afford this purchase'; end if;
  update public.characters set sheet=jsonb_set(character.sheet,'{currency,gp}',to_jsonb(gp-total),true),updated_at=now() where id=character.id;
  insert into public.character_inventory(character_id,item_id,quantity) values(character.id,target_item,requested_quantity)
  on conflict(character_id,item_id) do update set quantity=public.character_inventory.quantity+excluded.quantity;
  if stock.quantity is not null then update public.shop_stock set quantity=quantity-requested_quantity where shop_id=stock.shop_id and item_id=stock.item_id; end if;
  update public.purchase_requests set resolved_at=now() where id=result.id returning * into result;
  return result;
end;
$$;

revoke all on function public.request_roll30_purchase(uuid,uuid,uuid,integer) from public, anon;
grant execute on function public.request_roll30_purchase(uuid,uuid,uuid,integer) to authenticated;
