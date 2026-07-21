alter table public.campaign_assets
  add column audience uuid[] not null default '{}'::uuid[];

create index campaign_assets_audience_idx on public.campaign_assets using gin(audience);
create index shop_stock_item_idx on public.shop_stock(item_id);

create or replace function public.set_roll30_asset_audience(
  target_asset uuid,
  reveal_to_players boolean,
  target_audience uuid[] default '{}'::uuid[]
)
returns public.campaign_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.campaign_assets;
  member_id uuid;
begin
  select * into result from public.campaign_assets where id = target_asset for update;
  if result.id is null or not public.is_campaign_gm(result.campaign_id) then
    raise exception 'Only a campaign GM can change media visibility';
  end if;
  foreach member_id in array coalesce(target_audience, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.campaign_members
      where campaign_id = result.campaign_id and user_id = member_id and role = 'player'
    ) then raise exception 'Media audience contains a non-player'; end if;
  end loop;
  update public.campaign_assets
  set visible_to_players = reveal_to_players,
      audience = case when reveal_to_players then coalesce(target_audience, '{}'::uuid[]) else '{}'::uuid[] end
  where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.set_roll30_shop_stock(
  target_shop uuid,
  target_item uuid,
  stock_price integer,
  stock_quantity integer,
  stock_hidden boolean
)
returns public.shop_stock
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign uuid;
  result public.shop_stock;
begin
  select campaign_id into campaign from public.shops where id = target_shop;
  if campaign is null or not public.is_campaign_gm(campaign) then
    raise exception 'Only a campaign GM can manage shop stock';
  end if;
  if not exists (select 1 from public.items where id = target_item and campaign_id = campaign) then
    raise exception 'The item does not belong to this campaign';
  end if;
  if stock_price < 0 then raise exception 'Price cannot be negative'; end if;
  if stock_quantity is not null and stock_quantity < 0 then raise exception 'Quantity cannot be negative'; end if;
  insert into public.shop_stock(shop_id,item_id,price,quantity,hidden)
  values(target_shop,target_item,stock_price,stock_quantity,coalesce(stock_hidden,false))
  on conflict(shop_id,item_id) do update set
    price=excluded.price, quantity=excluded.quantity, hidden=excluded.hidden
  returning * into result;
  return result;
end;
$$;

create or replace function public.remove_roll30_shop_stock(target_shop uuid, target_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare campaign uuid;
begin
  select campaign_id into campaign from public.shops where id = target_shop;
  if campaign is null or not public.is_campaign_gm(campaign) then
    raise exception 'Only a campaign GM can manage shop stock';
  end if;
  delete from public.shop_stock where shop_id=target_shop and item_id=target_item;
  if not found then raise exception 'Stock item not found'; end if;
end;
$$;

drop policy if exists "members read revealed or safe live campaign assets" on public.campaign_assets;
create policy "members read addressed or safe live campaign assets"
on public.campaign_assets for select to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and (
      (visible_to_players and (cardinality(audience)=0 or (select auth.uid())=any(audience)))
      or exists (
        select 1 from public.scenes scene
        join public.sessions session_row on session_row.scene_id=scene.id and session_row.status='active'
        where scene.background_asset_id=campaign_assets.id
          and session_row.campaign_id=campaign_assets.campaign_id
          and coalesce((session_row.state->>'fog')::boolean,false)=false
          and coalesce(scene.config->>'ambient_light','bright')='bright'
      )
    )
  )
);

drop policy if exists "members read revealed assets or authorized map tiles" on storage.objects;
create policy "members read addressed assets or authorized map tiles"
on storage.objects for select to authenticated
using (
  bucket_id='campaign-media' and (
    exists (
      select 1 from public.campaign_assets asset
      where asset.storage_path=name and (
        public.is_campaign_gm(asset.campaign_id)
        or (
          public.is_campaign_member(asset.campaign_id)
          and asset.visible_to_players
          and (cardinality(asset.audience)=0 or (select auth.uid())=any(asset.audience))
        )
        or exists (
          select 1 from public.scenes scene
          join public.sessions session_row on session_row.scene_id=scene.id and session_row.status='active'
          where scene.background_asset_id=asset.id
            and session_row.campaign_id=asset.campaign_id
            and public.is_campaign_member(asset.campaign_id)
            and coalesce((session_row.state->>'fog')::boolean,false)=false
            and coalesce(scene.config->>'ambient_light','bright')='bright'
        )
      )
    )
    or exists (
      select 1 from public.scene_map_tiles tile
      join public.scenes scene on scene.id=tile.scene_id
      where tile.storage_path=name and (
        public.is_campaign_gm(scene.campaign_id)
        or exists (
          select 1 from public.session_map_tile_access access_row
          where access_row.tile_id=tile.id and access_row.user_id=(select auth.uid())
        )
      )
    )
  )
);

revoke all on function public.set_roll30_asset_audience(uuid,boolean,uuid[]) from public,anon;
revoke all on function public.set_roll30_shop_stock(uuid,uuid,integer,integer,boolean) from public,anon;
revoke all on function public.remove_roll30_shop_stock(uuid,uuid) from public,anon;
grant execute on function public.set_roll30_asset_audience(uuid,boolean,uuid[]) to authenticated;
grant execute on function public.set_roll30_shop_stock(uuid,uuid,integer,integer,boolean) to authenticated;
grant execute on function public.remove_roll30_shop_stock(uuid,uuid) to authenticated;
