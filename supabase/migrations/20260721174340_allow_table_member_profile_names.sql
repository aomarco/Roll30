create policy "campaign members read table profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.campaign_members m
    where m.user_id = profiles.id
      and public.is_campaign_member(m.campaign_id)
  )
);
