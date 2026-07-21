drop policy if exists "members read available shops" on public.shops;
create policy "members read available shops"
on public.shops for select to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and (
      jsonb_array_length(coalesce(settings->'audience','[]'::jsonb))=0
      or coalesce(settings->'audience','[]'::jsonb) ? (select auth.uid())::text
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
          or coalesce(shop.settings->'audience','[]'::jsonb) ? (select auth.uid())::text
        )
      )
    )
));
