create or replace function public.list_roll30_trashed_campaigns()
returns setof public.campaigns
language sql
stable
security definer
set search_path = public
as $$
  select campaign.*
  from public.campaigns campaign
  where campaign.owner_id = (select auth.uid())
    and campaign.deleted_at is not null
  order by campaign.deleted_at desc;
$$;

revoke all on function public.list_roll30_trashed_campaigns() from public, anon;
grant execute on function public.list_roll30_trashed_campaigns() to authenticated;
