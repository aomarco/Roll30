do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='characters') then
    alter publication supabase_realtime add table public.characters;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='scene_objects') then
    alter publication supabase_realtime add table public.scene_objects;
  end if;
end $$;
