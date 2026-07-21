-- SQL comparisons with NULL yield NULL rather than false. Explicit distinctness
-- checks prevent players from controlling ownerless NPCs and monsters.

create or replace function public.change_roll30_hp(target_character uuid, delta integer)
returns public.characters
language plpgsql
security definer
set search_path = public
as $$
declare result public.characters;
begin
  select * into result from public.characters where id = target_character for update;
  if result.id is null then raise exception 'Character not found'; end if;
  if not (public.is_campaign_gm(result.campaign_id) or result.owner_id is not distinct from auth.uid()) then
    raise exception 'Not permitted';
  end if;
  update public.characters
  set hp_current = greatest(0, least(coalesce(result.hp_max, 999999), coalesce(result.hp_current, 0) + delta)),
      updated_at = now()
  where id = target_character returning * into result;
  return result;
end;
$$;

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
  if character.owner_id is distinct from auth.uid() and not public.is_campaign_gm(shop.campaign_id) then raise exception 'You can only purchase for your own character'; end if;
  select * into stock from public.shop_stock where shop_id = target_shop and item_id = target_item for update;
  if stock.item_id is null then raise exception 'Item is no longer stocked'; end if;
  if stock.quantity is not null and stock.quantity < requested_quantity then raise exception 'Not enough stock'; end if;

  mode := coalesce(shop.settings ->> 'mode', 'approval');
  insert into public.purchase_requests(shop_id, item_id, character_id, quantity, requested_by, status)
  values(target_shop, target_item, target_character, requested_quantity, auth.uid(), case when mode = 'automatic' then 'completed' else 'pending' end)
  returning * into result;
  if mode <> 'automatic' then return result; end if;

  gp := coalesce((character.sheet -> 'currency' ->> 'gp')::integer, 0);
  total := stock.price * requested_quantity;
  if gp < total then raise exception 'Character cannot afford this purchase'; end if;
  update public.characters set sheet = jsonb_set(character.sheet, '{currency,gp}', to_jsonb(gp - total), true), updated_at = now() where id = character.id;
  insert into public.character_inventory(character_id, item_id, quantity) values(character.id, target_item, requested_quantity)
  on conflict(character_id, item_id) do update set quantity = public.character_inventory.quantity + excluded.quantity;
  if stock.quantity is not null then update public.shop_stock set quantity = quantity - requested_quantity where shop_id = stock.shop_id and item_id = stock.item_id; end if;
  update public.purchase_requests set resolved_at = now() where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.move_roll30_token(target_session uuid, target_token text, target_x integer, target_y integer)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_session public.sessions; token public.session_tokens; character_owner uuid; result public.sessions;
  origin_x integer; origin_y integer; destination_x integer := greatest(2, least(98, target_x)); destination_y integer := greatest(2, least(98, target_y)); wall public.scene_objects;
  is_gm boolean; move_state jsonb; spent numeric; distance numeric; next_state jsonb;
begin
  select * into current_session from public.sessions where id = target_session for update;
  if current_session.id is null or not public.is_campaign_member(current_session.campaign_id) then raise exception 'Not permitted'; end if;
  select * into token from public.session_tokens where id = target_token::uuid and session_id = current_session.id for update;
  if token.id is null then raise exception 'Token not found'; end if;
  select owner_id into character_owner from public.characters where id = token.character_id;
  is_gm := public.is_campaign_gm(current_session.campaign_id);
  if not (is_gm or character_owner is not distinct from auth.uid()) then raise exception 'You can only move your own token'; end if;
  origin_x := token.x; origin_y := token.y;
  distance := sqrt(power(destination_x - origin_x, 2) + power(destination_y - origin_y, 2));
  move_state := coalesce(current_session.state -> 'movement', '{}'::jsonb);
  spent := case when coalesce((move_state -> target_token ->> 'turn')::integer, -1) = current_session.active_turn then coalesce((move_state -> target_token ->> 'spent')::numeric, 0) else 0 end;
  if not is_gm and spent + distance > token.speed then raise exception 'That move exceeds this token''s speed for the turn'; end if;
  if current_session.scene_id is not null then
    for wall in select * from public.scene_objects where scene_id = current_session.scene_id and object_type = 'wall' and coalesce((state ->> 'active')::boolean, true) loop
      if wall.config ? 'x2' and wall.config ? 'y2' and private.roll30_segments_intersect(origin_x, origin_y, destination_x, destination_y, wall.x, wall.y, (wall.config ->> 'x2')::double precision, (wall.config ->> 'y2')::double precision) then raise exception 'That movement crosses a wall'; end if;
    end loop;
  end if;
  update public.session_tokens set x = destination_x, y = destination_y where id = token.id;
  move_state := jsonb_set(move_state, array[target_token], jsonb_build_object('turn', current_session.active_turn, 'spent', spent + distance), true);
  next_state := jsonb_set(current_session.state, '{movement}', move_state, true);
  update public.sessions set state = next_state, updated_at = now() where id = target_session returning * into result;
  insert into public.session_events(session_id, actor_id, event_type, payload)
  values(target_session, auth.uid(), 'token_moved', jsonb_build_object('token_id', target_token, 'x', destination_x, 'y', destination_y, 'distance', distance));
  return result;
end;
$$;

revoke all on function public.change_roll30_hp(uuid, integer) from public, anon;
revoke all on function public.request_roll30_purchase(uuid, uuid, uuid, integer) from public, anon;
revoke all on function public.move_roll30_token(uuid, text, integer, integer) from public, anon;
grant execute on function public.change_roll30_hp(uuid, integer) to authenticated;
grant execute on function public.request_roll30_purchase(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.move_roll30_token(uuid, text, integer, integer) to authenticated;
