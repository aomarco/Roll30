-- The original remote schema used this shorter policy name. The clean
-- reconstruction used the longer name already removed by the prior migration.
drop policy if exists "members read assets" on public.campaign_assets;
