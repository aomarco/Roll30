-- Players own their responses, while the campaign GM needs a separate read
-- policy to review the answers for prompts they created.

create policy "gms read campaign prompt responses"
on public.prompt_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.prompts p
    where p.id = prompt_id
      and public.is_campaign_gm(p.campaign_id)
  )
);
