do $$
declare table_name text;
begin
  foreach table_name in array array[
    'campaign_assets','campaign_members','campaign_notes','character_inventory','items',
    'scene_templates','scenes','session_exploration','session_reveals','session_snapshots',
    'shop_stock','shops','automation_executions'
  ] loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then execute format('alter publication supabase_realtime add table public.%I',table_name); end if;
  end loop;
end;
$$;
