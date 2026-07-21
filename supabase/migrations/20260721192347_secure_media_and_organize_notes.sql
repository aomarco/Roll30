alter table public.campaign_assets add column visible_to_players boolean not null default false;

drop policy if exists "members read campaign assets" on public.campaign_assets;
drop policy if exists "members read assets" on public.campaign_assets;
create policy "members read revealed or live campaign assets"
on public.campaign_assets for select to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or (
    public.is_campaign_member(campaign_id)
    and (
      visible_to_players
      or exists (
        select 1
        from public.scenes scene
        join public.sessions session on session.scene_id = scene.id and session.status = 'active'
        where scene.background_asset_id = campaign_assets.id
          and session.campaign_id = campaign_assets.campaign_id
      )
    )
  )
);

drop policy if exists "members read campaign media" on storage.objects;
create policy "members read revealed or live campaign media"
on storage.objects for select to authenticated
using (
  bucket_id = 'campaign-media'
  and exists (
    select 1
    from public.campaign_assets asset
    where asset.storage_path = name
      and (
        asset.visible_to_players
        or public.is_campaign_gm(asset.campaign_id)
        or exists (
          select 1
          from public.scenes scene
          join public.sessions session on session.scene_id = scene.id and session.status = 'active'
          where scene.background_asset_id = asset.id
            and session.campaign_id = asset.campaign_id
            and public.is_campaign_member(asset.campaign_id)
        )
      )
  )
);

alter table public.campaign_notes add column folder text;
alter table public.campaign_notes add column tags text[] not null default '{}'::text[];
alter table public.campaign_notes add column audience uuid[] not null default '{}'::uuid[];
alter table public.campaign_notes add column deleted_at timestamptz;
create index campaign_notes_organization_idx on public.campaign_notes(campaign_id, deleted_at, folder, updated_at desc);
create index campaign_notes_tags_idx on public.campaign_notes using gin(tags);

drop policy if exists "members read revealed campaign notes" on public.campaign_notes;
create policy "members read addressed campaign notes"
on public.campaign_notes for select to authenticated
using (
  deleted_at is null
  and public.is_campaign_member(campaign_id)
  and (
    public.is_campaign_gm(campaign_id)
    or (
      not hidden
      and (cardinality(audience) = 0 or (select auth.uid()) = any(audience))
    )
  )
);
