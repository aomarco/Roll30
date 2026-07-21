create or replace function private.roll30_dice(expression text, critical boolean default false)
returns integer language plpgsql volatile set search_path=public as $$
declare match text[]; dice_count integer; sides integer; modifier integer; total integer:=0; i integer;
begin
  match:=regexp_match(lower(replace(expression,' ','')),'^(\d{1,2})d(\d{1,3})([+-]\d+)?$');
  if match is null then raise exception 'Use dice like 1d8+3'; end if;
  dice_count:=(match[1])::integer; sides:=(match[2])::integer; modifier:=coalesce((match[3])::integer,0);
  if dice_count not between 1 and 20 or sides not between 2 and 100 then raise exception 'Dice expression is outside Roll30 limits'; end if;
  if critical then dice_count:=dice_count*2; end if;
  for i in 1..dice_count loop total:=total+floor(random()*sides+1)::integer; end loop;
  return total+modifier;
end; $$;

create or replace function public.resolve_roll30_combat_attack(attacker_id uuid,target_id uuid,attack_index integer default 0,advantage integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare attacker public.characters; target public.characters; attack jsonb; first_roll integer; second_roll integer; natural_roll integer; bonus integer; total integer; hit boolean; critical boolean; damage integer:=0; dice text; active_session uuid; result jsonb;
begin
  select * into attacker from public.characters where id=attacker_id for update;
  select * into target from public.characters where id=target_id for update;
  if attacker.id is null or target.id is null or attacker.campaign_id<>target.campaign_id then raise exception 'Combatants must share a campaign'; end if;
  if not (public.is_campaign_gm(attacker.campaign_id) or attacker.owner_id is not distinct from auth.uid()) then raise exception 'You can only attack with your own character'; end if;
  if advantage not between -1 and 1 then raise exception 'Advantage must be -1, 0, or 1'; end if;
  attack:=coalesce(attacker.sheet->'attacks'->attack_index,attacker.sheet->'attack');
  if attack is null then raise exception 'This character has no configured attack'; end if;
  first_roll:=floor(random()*20+1)::integer; second_roll:=floor(random()*20+1)::integer;
  natural_roll:=case when advantage=1 then greatest(first_roll,second_roll) when advantage=-1 then least(first_roll,second_roll) else first_roll end;
  bonus:=coalesce((attack->>'bonus')::integer,0); total:=natural_roll+bonus; critical:=natural_roll=20;
  hit:=natural_roll<>1 and (critical or total>=coalesce((target.sheet->>'armor_class')::integer,10));
  dice:=coalesce(attack->>'damage_dice',(attacker.sheet->'attack'->>'damage')||'d1');
  if hit then damage:=greatest(0,private.roll30_dice(dice,critical)); update public.characters set hp_current=greatest(0,coalesce(hp_current,0)-damage),updated_at=now() where id=target.id; end if;
  result:=jsonb_build_object('attacker',attacker.name,'target',target.name,'attack',attack->>'name','natural',natural_roll,'total',total,'hit',hit,'critical',critical,'damage',damage,'damage_type',coalesce(attack->>'damage_type','untyped'));
  select id into active_session from public.sessions where campaign_id=attacker.campaign_id and status='active';
  if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'combat_attack',result); end if;
  insert into public.messages(campaign_id,sender_id,kind,body) values(attacker.campaign_id,auth.uid(),'attack',result);
  return result;
end; $$;

create or replace function public.set_roll30_condition(target_character uuid,condition_name text,enabled boolean,concentration_effect text default null)
returns public.characters language plpgsql security definer set search_path=public as $$
declare c public.characters; conditions jsonb; result public.characters;
begin
  select * into c from public.characters where id=target_character for update;
  if c.id is null or not (public.is_campaign_gm(c.campaign_id) or c.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  if length(trim(condition_name)) not between 1 and 60 then raise exception 'Condition name is invalid'; end if;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into conditions from jsonb_array_elements_text(coalesce(c.sheet->'conditions','[]')) value where lower(value)<>lower(trim(condition_name));
  if enabled then conditions:=conditions||to_jsonb(trim(condition_name)); end if;
  update public.characters set sheet=jsonb_set(jsonb_set(sheet,'{conditions}',conditions,true),'{concentration}',coalesce(to_jsonb(concentration_effect),'null'::jsonb),true),sheet_revision=sheet_revision+1,updated_at=now() where id=c.id returning * into result;
  return result;
end; $$;

create or replace function public.roll_roll30_death_save(target_character uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.characters; roll_value integer; saves jsonb; successes integer; failures integer; result jsonb; active_session uuid;
begin
  select * into c from public.characters where id=target_character for update;
  if c.id is null or c.kind<>'pc' or coalesce(c.hp_current,0)>0 then raise exception 'Death saves require a player character at 0 HP'; end if;
  if not (public.is_campaign_gm(c.campaign_id) or c.owner_id is not distinct from auth.uid()) then raise exception 'Not permitted'; end if;
  roll_value:=floor(random()*20+1)::integer;saves:=coalesce(c.sheet->'death_saves','{"successes":0,"failures":0}');successes:=coalesce((saves->>'successes')::integer,0);failures:=coalesce((saves->>'failures')::integer,0);
  if roll_value=20 then update public.characters set hp_current=1,sheet=jsonb_set(sheet,'{death_saves}','{"successes":0,"failures":0}',true),sheet_revision=sheet_revision+1,updated_at=now() where id=c.id;
  else if roll_value=1 then failures:=least(3,failures+2); elsif roll_value>=10 then successes:=least(3,successes+1); else failures:=least(3,failures+1); end if; update public.characters set sheet=jsonb_set(sheet,'{death_saves}',jsonb_build_object('successes',successes,'failures',failures,'stable',successes=3,'dead',failures=3),true),sheet_revision=sheet_revision+1,updated_at=now() where id=c.id; end if;
  result:=jsonb_build_object('roll',roll_value,'successes',successes,'failures',failures,'revived',roll_value=20,'stable',successes=3,'dead',failures=3);
  select id into active_session from public.sessions where campaign_id=c.campaign_id and status='active';if active_session is not null then insert into public.session_events(session_id,actor_id,event_type,payload) values(active_session,auth.uid(),'death_save',result||jsonb_build_object('character',c.name));end if;return result;
end; $$;

revoke all on function public.resolve_roll30_combat_attack(uuid,uuid,integer,integer) from public,anon;
revoke all on function public.set_roll30_condition(uuid,text,boolean,text) from public,anon;
revoke all on function public.roll_roll30_death_save(uuid) from public,anon;
grant execute on function public.resolve_roll30_combat_attack(uuid,uuid,integer,integer) to authenticated;
grant execute on function public.set_roll30_condition(uuid,text,boolean,text) to authenticated;
grant execute on function public.roll_roll30_death_save(uuid) to authenticated;
