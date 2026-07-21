-- Separate GM write privileges from member reads so PostgreSQL evaluates one
-- permissive policy per role/action. This also removes the obsolete shop-stock
-- read policy that exposed rows marked hidden.

drop policy "gms manage assets" on public.campaign_assets;
create policy "gms insert assets" on public.campaign_assets for insert to authenticated with check(public.is_campaign_gm(campaign_id));
create policy "gms update assets" on public.campaign_assets for update to authenticated using(public.is_campaign_gm(campaign_id)) with check(public.is_campaign_gm(campaign_id));
create policy "gms delete assets" on public.campaign_assets for delete to authenticated using(public.is_campaign_gm(campaign_id));

drop policy "gms manage memberships" on public.campaign_members;
drop policy "owners add initial gm membership" on public.campaign_members;
create policy "authorized membership insert" on public.campaign_members for insert to authenticated with check(
  public.is_campaign_gm(campaign_id) or (
    user_id=(select auth.uid()) and role='gm' and exists(select 1 from public.campaigns campaign where campaign.id=campaign_id and campaign.owner_id=(select auth.uid()))
  )
);
create policy "gms update memberships" on public.campaign_members for update to authenticated using(public.is_campaign_gm(campaign_id)) with check(public.is_campaign_gm(campaign_id));
create policy "gms delete memberships" on public.campaign_members for delete to authenticated using(public.is_campaign_gm(campaign_id));

drop policy "members read campaigns" on public.campaigns;
drop policy "owners read owned campaigns" on public.campaigns;
create policy "members or owners read campaigns" on public.campaigns for select to authenticated
using(public.is_campaign_member(id) or owner_id=(select auth.uid()));

drop policy "gms manage inventory" on public.character_inventory;
create policy "gms insert inventory" on public.character_inventory for insert to authenticated with check(exists(select 1 from public.characters character where character.id=character_id and public.is_campaign_gm(character.campaign_id)));
create policy "gms update inventory" on public.character_inventory for update to authenticated using(exists(select 1 from public.characters character where character.id=character_id and public.is_campaign_gm(character.campaign_id))) with check(exists(select 1 from public.characters character where character.id=character_id and public.is_campaign_gm(character.campaign_id)));
create policy "gms delete inventory" on public.character_inventory for delete to authenticated using(exists(select 1 from public.characters character where character.id=character_id and public.is_campaign_gm(character.campaign_id)));

drop policy "gms manage characters" on public.characters;
drop policy "players create owned player characters" on public.characters;
drop policy "players update owned character" on public.characters;
drop policy "players delete owned player characters" on public.characters;
create policy "authorized character insert" on public.characters for insert to authenticated with check(
  public.is_campaign_gm(campaign_id) or (kind='pc' and owner_id=(select auth.uid()) and public.is_campaign_member(campaign_id))
);
create policy "authorized character update" on public.characters for update to authenticated using(
  public.is_campaign_gm(campaign_id) or owner_id=(select auth.uid())
) with check(
  public.is_campaign_gm(campaign_id) or (kind='pc' and owner_id=(select auth.uid()) and public.is_campaign_member(campaign_id))
);
create policy "authorized character delete" on public.characters for delete to authenticated using(
  public.is_campaign_gm(campaign_id) or (kind='pc' and owner_id=(select auth.uid()) and public.is_campaign_member(campaign_id))
);

drop policy "gms manage items" on public.items;
create policy "gms insert items" on public.items for insert to authenticated with check(public.is_campaign_gm(campaign_id));
create policy "gms update items" on public.items for update to authenticated using(public.is_campaign_gm(campaign_id)) with check(public.is_campaign_gm(campaign_id));
create policy "gms delete items" on public.items for delete to authenticated using(public.is_campaign_gm(campaign_id));

drop policy "campaign members read table profiles" on public.profiles;
drop policy "read own profile" on public.profiles;
create policy "self or table members read profiles" on public.profiles for select to authenticated using(
  id=(select auth.uid()) or exists(select 1 from public.campaign_members member where member.user_id=profiles.id and public.is_campaign_member(member.campaign_id))
);

drop policy "respond to permitted prompts" on public.prompt_responses;
drop policy "gms read campaign prompt responses" on public.prompt_responses;
create policy "authorized prompt responses read" on public.prompt_responses for select to authenticated using(
  exists(select 1 from public.prompts prompt where prompt.id=prompt_id and (
    public.is_campaign_gm(prompt.campaign_id) or (
      user_id=(select auth.uid()) and public.is_campaign_member(prompt.campaign_id)
      and (cardinality(prompt.audience)=0 or (select auth.uid())=any(prompt.audience))
    )
  ))
);
create policy "players insert own prompt responses" on public.prompt_responses for insert to authenticated with check(
  user_id=(select auth.uid()) and exists(select 1 from public.prompts prompt where prompt.id=prompt_id and public.is_campaign_member(prompt.campaign_id) and (cardinality(prompt.audience)=0 or (select auth.uid())=any(prompt.audience)))
);
create policy "players update own prompt responses" on public.prompt_responses for update to authenticated using(user_id=(select auth.uid())) with check(
  user_id=(select auth.uid()) and exists(select 1 from public.prompts prompt where prompt.id=prompt_id and public.is_campaign_member(prompt.campaign_id) and (cardinality(prompt.audience)=0 or (select auth.uid())=any(prompt.audience)))
);
create policy "players delete own prompt responses" on public.prompt_responses for delete to authenticated using(user_id=(select auth.uid()));

drop policy "gms manage prompts" on public.prompts;
create policy "gms insert prompts" on public.prompts for insert to authenticated with check(public.is_campaign_gm(campaign_id));
create policy "gms update prompts" on public.prompts for update to authenticated using(public.is_campaign_gm(campaign_id)) with check(public.is_campaign_gm(campaign_id));
create policy "gms delete prompts" on public.prompts for delete to authenticated using(public.is_campaign_gm(campaign_id));

drop policy "gms manage secure map tiles" on public.scene_map_tiles;
create policy "gms insert secure map tiles" on public.scene_map_tiles for insert to authenticated with check(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));
create policy "gms update secure map tiles" on public.scene_map_tiles for update to authenticated using(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id))) with check(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));
create policy "gms delete secure map tiles" on public.scene_map_tiles for delete to authenticated using(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));

drop policy "gms manage scene objects" on public.scene_objects;
create policy "gms insert scene objects" on public.scene_objects for insert to authenticated with check(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));
create policy "gms update scene objects" on public.scene_objects for update to authenticated using(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id))) with check(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));
create policy "gms delete scene objects" on public.scene_objects for delete to authenticated using(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));

drop policy "gms manage scene templates" on public.scene_templates;
create policy "gms insert scene templates" on public.scene_templates for insert to authenticated with check(public.is_campaign_gm(campaign_id) and created_by=(select auth.uid()));
create policy "gms update scene templates" on public.scene_templates for update to authenticated using(public.is_campaign_gm(campaign_id)) with check(public.is_campaign_gm(campaign_id) and created_by=(select auth.uid()));
create policy "gms delete scene templates" on public.scene_templates for delete to authenticated using(public.is_campaign_gm(campaign_id));

drop policy "gms manage triggers" on public.scene_triggers;
create policy "gms insert triggers" on public.scene_triggers for insert to authenticated with check(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));
create policy "gms update triggers" on public.scene_triggers for update to authenticated using(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id))) with check(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));
create policy "gms delete triggers" on public.scene_triggers for delete to authenticated using(exists(select 1 from public.scenes scene where scene.id=scene_id and public.is_campaign_gm(scene.campaign_id)));

drop policy "gms manage scenes" on public.scenes;
create policy "gms insert scenes" on public.scenes for insert to authenticated with check(public.is_campaign_gm(campaign_id));
create policy "gms update scenes" on public.scenes for update to authenticated using(public.is_campaign_gm(campaign_id)) with check(public.is_campaign_gm(campaign_id));
create policy "gms delete scenes" on public.scenes for delete to authenticated using(public.is_campaign_gm(campaign_id));

drop policy "gms manage snapshots" on public.session_snapshots;
create policy "gms insert snapshots" on public.session_snapshots for insert to authenticated with check(exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id)));
create policy "gms update snapshots" on public.session_snapshots for update to authenticated using(exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id))) with check(exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id)));
create policy "gms delete snapshots" on public.session_snapshots for delete to authenticated using(exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id)));

drop policy "gms manage session tokens" on public.session_tokens;
create policy "gms insert session tokens" on public.session_tokens for insert to authenticated with check(exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id)));
create policy "gms update session tokens" on public.session_tokens for update to authenticated using(exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id))) with check(exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id)));
create policy "gms delete session tokens" on public.session_tokens for delete to authenticated using(exists(select 1 from public.sessions session_row where session_row.id=session_id and public.is_campaign_gm(session_row.campaign_id)));

drop policy "gms manage sessions" on public.sessions;
create policy "gms insert sessions" on public.sessions for insert to authenticated with check(public.is_campaign_gm(campaign_id));
create policy "gms update sessions" on public.sessions for update to authenticated using(public.is_campaign_gm(campaign_id)) with check(public.is_campaign_gm(campaign_id));
create policy "gms delete sessions" on public.sessions for delete to authenticated using(public.is_campaign_gm(campaign_id));

drop policy "gms manage stock" on public.shop_stock;
drop policy "members read stock" on public.shop_stock;
drop policy "members read available shop stock" on public.shop_stock;
create policy "members read visible shop stock" on public.shop_stock for select to authenticated using(exists(
  select 1 from public.shops shop where shop.id=shop_id and public.is_campaign_member(shop.campaign_id) and (not hidden or public.is_campaign_gm(shop.campaign_id))
));
create policy "gms insert stock" on public.shop_stock for insert to authenticated with check(exists(select 1 from public.shops shop where shop.id=shop_id and public.is_campaign_gm(shop.campaign_id)));
create policy "gms update stock" on public.shop_stock for update to authenticated using(exists(select 1 from public.shops shop where shop.id=shop_id and public.is_campaign_gm(shop.campaign_id))) with check(exists(select 1 from public.shops shop where shop.id=shop_id and public.is_campaign_gm(shop.campaign_id)));
create policy "gms delete stock" on public.shop_stock for delete to authenticated using(exists(select 1 from public.shops shop where shop.id=shop_id and public.is_campaign_gm(shop.campaign_id)));

drop policy "gms manage shops" on public.shops;
create policy "gms insert shops" on public.shops for insert to authenticated with check(public.is_campaign_gm(campaign_id));
create policy "gms update shops" on public.shops for update to authenticated using(public.is_campaign_gm(campaign_id)) with check(public.is_campaign_gm(campaign_id));
create policy "gms delete shops" on public.shops for delete to authenticated using(public.is_campaign_gm(campaign_id));
