create or replace function public.resolve_roll30_attack(attacker_id uuid, target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attacker public.characters;
  target public.characters;
  attack jsonb;
  roll integer;
  total integer;
  damage integer;
  armor_class integer;
  result jsonb;
begin
  select * into attacker from public.characters where id = attacker_id for update;
  select * into target from public.characters where id = target_id for update;
  if attacker.id is null or target.id is null or attacker.campaign_id <> target.campaign_id then raise exception 'Choose characters from the same campaign'; end if;
  if attacker.owner_id is distinct from auth.uid() and not public.is_campaign_gm(attacker.campaign_id) then raise exception 'You can only attack with your own character'; end if;
  attack := coalesce(attacker.sheet->'attack', '{}'::jsonb);
  if coalesce(attack->>'name','') = '' then raise exception 'This character has no configured attack'; end if;
  roll := floor(random() * 20)::integer + 1;
  total := roll + coalesce((attack->>'bonus')::integer, 0);
  armor_class := coalesce((target.sheet->>'armor_class')::integer, 10);
  if roll = 1 or (roll <> 20 and total < armor_class) then
    result := jsonb_build_object('hit',false,'roll',roll,'total',total,'target',target.name,'attack',attack->>'name');
  else
    damage := greatest(1, coalesce((attack->>'damage')::integer, 1));
    update public.characters set hp_current=greatest(0,coalesce(hp_current,0)-damage),updated_at=now() where id=target.id;
    result := jsonb_build_object('hit',true,'roll',roll,'total',total,'damage',damage,'target',target.name,'attack',attack->>'name');
  end if;
  insert into public.messages(campaign_id,sender_id,kind,body)
  values(attacker.campaign_id,auth.uid(),'attack',jsonb_build_object('text',attacker.name || ' uses ' || (attack->>'name') || ' against ' || target.name || ': ' || case when (result->>'hit')::boolean then 'hit for ' || (result->>'damage') || ' damage' else 'miss' end || ' (' || total || ')','result',result));
  return result;
end;
$$;

revoke all on function public.resolve_roll30_attack(uuid,uuid) from public, anon;
grant execute on function public.resolve_roll30_attack(uuid,uuid) to authenticated;
