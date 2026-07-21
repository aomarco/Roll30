alter table public.purchase_requests
add column if not exists quote jsonb not null default '{}'::jsonb;

drop policy if exists "members read shops" on public.shops;
create policy "members read available shops"
on public.shops for select to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and (
      jsonb_array_length(coalesce(settings->'audience','[]'::jsonb))=0
      or coalesce(settings->'audience','[]'::jsonb) ? auth.uid()::text
    )
  )
);

drop policy if exists "members read visible shop stock" on public.shop_stock;
create policy "members read visible shop stock"
on public.shop_stock for select to authenticated
using (exists(
  select 1 from public.shops shop
  where shop.id=shop_id
    and (
      public.is_campaign_gm(shop.campaign_id)
      or (
        public.is_campaign_member(shop.campaign_id)
        and not hidden
        and (
          jsonb_array_length(coalesce(shop.settings->'audience','[]'::jsonb))=0
          or coalesce(shop.settings->'audience','[]'::jsonb) ? auth.uid()::text
        )
      )
    )
));

create or replace function public.create_roll30_shop(
  target_campaign uuid,
  shop_name text,
  shop_npc uuid default null
)
returns public.shops
language plpgsql security definer set search_path=public
as $$
declare result public.shops;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'Only a campaign GM can create shops';end if;
  if nullif(trim(shop_name),'') is null or length(trim(shop_name))>160 then raise exception 'Shop name must be between 1 and 160 characters';end if;
  if shop_npc is not null and not exists(select 1 from public.characters where id=shop_npc and campaign_id=target_campaign and kind='npc') then raise exception 'Shopkeeper must be an NPC in this campaign';end if;
  insert into public.shops(campaign_id,npc_id,name) values(target_campaign,shop_npc,trim(shop_name)) returning * into result;
  return result;
end;
$$;

create or replace function public.configure_roll30_shop(
  target_shop uuid,
  shop_name text,
  shop_npc uuid,
  purchase_mode text,
  discount_percent integer,
  target_audience uuid[],
  bargaining_enabled boolean,
  bargain_discount integer,
  persuasion_required boolean,
  persuasion_dc integer
)
returns public.shops
language plpgsql security definer set search_path=public
as $$
declare result public.shops;audience_ids uuid[]:=coalesce(target_audience,'{}'::uuid[]);
begin
  select * into result from public.shops where id=target_shop;
  if result.id is null or not public.is_campaign_gm(result.campaign_id) then raise exception 'Only a campaign GM can configure this shop';end if;
  if nullif(trim(shop_name),'') is null or length(trim(shop_name))>160 then raise exception 'Shop name must be between 1 and 160 characters';end if;
  if purchase_mode not in ('automatic','approval','manual') then raise exception 'Purchase mode is invalid';end if;
  if discount_percent not between -500 and 100 then raise exception 'Price adjustment must be between -500 and 100 percent';end if;
  if bargain_discount not between 0 and 50 then raise exception 'Bargaining discount must be between 0 and 50 percent';end if;
  if persuasion_dc not between 1 and 30 then raise exception 'Persuasion DC must be between 1 and 30';end if;
  if shop_npc is not null and not exists(select 1 from public.characters where id=shop_npc and campaign_id=result.campaign_id and kind='npc') then raise exception 'Shopkeeper must be an NPC in this campaign';end if;
  if exists(select 1 from unnest(audience_ids) audience_id where not exists(select 1 from public.campaign_members where campaign_id=result.campaign_id and user_id=audience_id and role='player')) then raise exception 'Shop audiences must be players in this campaign';end if;
  update public.shops set
    name=trim(shop_name),npc_id=shop_npc,
    settings=jsonb_build_object(
      'mode',purchase_mode,'discount',discount_percent,'audience',to_jsonb(audience_ids),
      'bargaining',coalesce(bargaining_enabled,false),'bargain_discount',bargain_discount,
      'require_persuasion',coalesce(persuasion_required,false),'persuasion_dc',persuasion_dc
    )
  where id=result.id returning * into result;
  return result;
end;
$$;

create or replace function public.request_roll30_purchase(target_shop uuid,target_item uuid,target_character uuid,requested_quantity integer default 1)
returns public.purchase_requests
language plpgsql security definer set search_path=public
as $$
declare shop public.shops;stock public.shop_stock;character public.characters;result public.purchase_requests;mode text;gp integer;total integer;base_total integer;persuasion_roll integer;persuasion_bonus integer:=0;persuasion_dc integer;persuasion_success boolean:=true;extra_discount integer:=0;quote jsonb;
begin
  if requested_quantity<1 then raise exception 'Quantity must be at least one';end if;
  select * into shop from public.shops where id=target_shop;
  if shop.id is null or not public.is_campaign_member(shop.campaign_id) then raise exception 'Shop not found';end if;
  if not public.is_campaign_gm(shop.campaign_id) and jsonb_array_length(coalesce(shop.settings->'audience','[]'::jsonb))>0 and not (coalesce(shop.settings->'audience','[]'::jsonb) ? auth.uid()::text) then raise exception 'Shop not found';end if;
  select * into character from public.characters where id=target_character for update;
  if character.id is null or character.campaign_id<>shop.campaign_id then raise exception 'Character is not in this campaign';end if;
  if character.owner_id is distinct from auth.uid() and not public.is_campaign_gm(shop.campaign_id) then raise exception 'You can only purchase for your own character';end if;
  select * into stock from public.shop_stock where shop_id=target_shop and item_id=target_item for update;
  if stock.item_id is null or (stock.hidden and not public.is_campaign_gm(shop.campaign_id)) then raise exception 'Item is no longer available';end if;
  if stock.quantity is not null and stock.quantity<requested_quantity then raise exception 'Not enough stock';end if;
  mode:=coalesce(shop.settings->>'mode','approval');
  persuasion_dc:=greatest(1,least(30,coalesce((shop.settings->>'persuasion_dc')::integer,12)));
  if coalesce((shop.settings->>'require_persuasion')::boolean,false) and not public.is_campaign_gm(shop.campaign_id) then
    persuasion_bonus:=floor((coalesce((character.sheet->'abilities'->>'cha')::integer,10)-10)/2.0)::integer;
    persuasion_roll:=floor(random()*20+1)::integer+persuasion_bonus;
    persuasion_success:=persuasion_roll>=persuasion_dc;
  end if;
  if coalesce((shop.settings->>'bargaining')::boolean,false) and persuasion_success then extra_discount:=greatest(0,least(50,coalesce((shop.settings->>'bargain_discount')::integer,0)));end if;
  base_total:=private.roll30_purchase_total(shop,stock,requested_quantity);
  total:=greatest(0,round(stock.price*requested_quantity*(100-greatest(-500,least(100,coalesce((shop.settings->>'discount')::numeric,0)+extra_discount)))/100.0)::integer);
  quote:=jsonb_build_object('base_total',base_total,'total',total,'discount',coalesce((shop.settings->>'discount')::integer,0),'bargain_discount',extra_discount,'persuasion_required',coalesce((shop.settings->>'require_persuasion')::boolean,false),'persuasion_roll',persuasion_roll,'persuasion_bonus',persuasion_bonus,'persuasion_dc',persuasion_dc,'persuasion_success',persuasion_success);
  insert into public.purchase_requests(shop_id,item_id,character_id,quantity,requested_by,status,quote)
  values(target_shop,target_item,target_character,requested_quantity,auth.uid(),case when mode='automatic' and persuasion_success then 'completed' else 'pending' end,quote) returning * into result;
  if result.status<>'completed' then return result;end if;
  gp:=coalesce((character.sheet->'currency'->>'gp')::integer,0);
  if gp<total then raise exception 'Character cannot afford this purchase';end if;
  update public.characters set sheet=jsonb_set(character.sheet,'{currency,gp}',to_jsonb(gp-total),true),sheet_revision=sheet_revision+1,updated_at=now() where id=character.id;
  insert into public.character_inventory(character_id,item_id,quantity) values(character.id,target_item,requested_quantity) on conflict(character_id,item_id) do update set quantity=public.character_inventory.quantity+excluded.quantity;
  if stock.quantity is not null then update public.shop_stock set quantity=quantity-requested_quantity where shop_id=stock.shop_id and item_id=stock.item_id;end if;
  update public.purchase_requests set resolved_at=now() where id=result.id returning * into result;
  return result;
end;
$$;

create or replace function public.resolve_roll30_purchase(target_request uuid,approve boolean)
returns public.purchase_requests
language plpgsql security definer set search_path=public
as $$
declare request_row public.purchase_requests;shop_row public.shops;stock_row public.shop_stock;character_row public.characters;gp integer;total integer;
begin
  select * into request_row from public.purchase_requests where id=target_request for update;if request_row.id is null then raise exception 'Purchase request not found';end if;
  select * into shop_row from public.shops where id=request_row.shop_id;if not public.is_campaign_gm(shop_row.campaign_id) then raise exception 'Only the GM can resolve purchases';end if;
  if request_row.status<>'pending' then raise exception 'Purchase request is already resolved';end if;
  if not approve then update public.purchase_requests set status='declined',resolved_at=now() where id=target_request returning * into request_row;return request_row;end if;
  select * into stock_row from public.shop_stock where shop_id=request_row.shop_id and item_id=request_row.item_id for update;if stock_row.item_id is null then raise exception 'Item is no longer stocked';end if;if stock_row.quantity is not null and stock_row.quantity<request_row.quantity then raise exception 'Not enough stock';end if;
  select * into character_row from public.characters where id=request_row.character_id for update;
  gp:=coalesce((character_row.sheet->'currency'->>'gp')::integer,0);total:=coalesce((request_row.quote->>'total')::integer,private.roll30_purchase_total(shop_row,stock_row,request_row.quantity));
  if gp<total then raise exception 'Character cannot afford this purchase';end if;
  update public.characters set sheet=jsonb_set(sheet,'{currency,gp}',to_jsonb(gp-total),true),sheet_revision=sheet_revision+1,updated_at=now() where id=character_row.id;
  insert into public.character_inventory(character_id,item_id,quantity) values(character_row.id,request_row.item_id,request_row.quantity) on conflict(character_id,item_id) do update set quantity=public.character_inventory.quantity+excluded.quantity;
  if stock_row.quantity is not null then update public.shop_stock set quantity=quantity-request_row.quantity where shop_id=stock_row.shop_id and item_id=stock_row.item_id;end if;
  update public.purchase_requests set status='completed',resolved_at=now() where id=target_request returning * into request_row;return request_row;
end;
$$;

revoke all on function public.create_roll30_shop(uuid,text,uuid) from public,anon;
revoke all on function public.configure_roll30_shop(uuid,text,uuid,text,integer,uuid[],boolean,integer,boolean,integer) from public,anon;
revoke all on function public.request_roll30_purchase(uuid,uuid,uuid,integer) from public,anon;
revoke all on function public.resolve_roll30_purchase(uuid,boolean) from public,anon;
grant execute on function public.create_roll30_shop(uuid,text,uuid) to authenticated;
grant execute on function public.configure_roll30_shop(uuid,text,uuid,text,integer,uuid[],boolean,integer,boolean,integer) to authenticated;
grant execute on function public.request_roll30_purchase(uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.resolve_roll30_purchase(uuid,boolean) to authenticated;
