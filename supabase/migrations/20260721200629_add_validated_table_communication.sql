create table public.message_reads(message_id uuid not null references public.messages(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,read_at timestamptz not null default now(),primary key(message_id,user_id));
alter table public.message_reads enable row level security;
grant select on public.message_reads to authenticated;
create policy "members read own message receipts" on public.message_reads for select to authenticated using(user_id=(select auth.uid()));
revoke insert on public.messages from authenticated;

create or replace function public.send_roll30_message(target_campaign uuid,message_kind text,message_text text default '',target_recipient uuid default null,dice_expression text default null)
returns public.messages language plpgsql security definer set search_path=public as $$
declare result public.messages;body jsonb;total integer;
begin
  if not public.is_campaign_member(target_campaign) then raise exception 'Campaign not found';end if;if message_kind not in ('message','whisper','action','roll','check_request') then raise exception 'Unsupported message type';end if;if target_recipient is not null and not exists(select 1 from public.campaign_members where campaign_id=target_campaign and user_id=target_recipient) then raise exception 'Recipient is not in this campaign';end if;if message_kind='whisper' and target_recipient is null then raise exception 'Choose a whisper recipient';end if;if message_kind='check_request' and (not public.is_campaign_gm(target_campaign) or target_recipient is null) then raise exception 'Only a GM can send a check request to a player';end if;
  if message_kind='roll' then total:=private.roll30_dice(coalesce(dice_expression,'1d20'),false);body:=jsonb_build_object('text',coalesce(nullif(trim(message_text),''),auth.uid()::text||' rolled '||total),'dice',coalesce(dice_expression,'1d20'),'total',total);else if length(trim(message_text)) not between 1 and 2000 then raise exception 'Message must be from 1 to 2000 characters';end if;body:=jsonb_build_object('text',trim(message_text));end if;
  insert into public.messages(campaign_id,sender_id,recipient_id,kind,body) values(target_campaign,auth.uid(),target_recipient,message_kind,body) returning * into result;return result;
end; $$;

create or replace function public.mark_roll30_messages_read(target_campaign uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  if not public.is_campaign_member(target_campaign) then raise exception 'Campaign not found';end if;insert into public.message_reads(message_id,user_id) select id,auth.uid() from public.messages where campaign_id=target_campaign and sender_id<>auth.uid() and (recipient_id is null or recipient_id=auth.uid() or public.is_campaign_gm(target_campaign)) on conflict do nothing;get diagnostics affected=row_count;return affected;
end; $$;

alter table public.prompts add column updated_at timestamptz not null default now();
alter table public.prompt_responses add column updated_at timestamptz not null default now();
revoke insert,update,delete on public.prompts from authenticated;
revoke insert,update,delete on public.prompt_responses from authenticated;

create or replace function public.create_roll30_prompt(target_campaign uuid,prompt_title text,prompt_body text,prompt_audience uuid[] default '{}',prompt_options jsonb default '[]')
returns public.prompts language plpgsql security definer set search_path=public as $$
declare member_id uuid;result public.prompts;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'Only a GM can create prompts';end if;foreach member_id in array prompt_audience loop if not exists(select 1 from public.campaign_members where campaign_id=target_campaign and user_id=member_id and role='player') then raise exception 'Prompt audience contains a non-player';end if;end loop;insert into public.prompts(campaign_id,created_by,title,body,audience,options) values(target_campaign,auth.uid(),trim(prompt_title),trim(prompt_body),prompt_audience,coalesce(prompt_options,'[]')) returning * into result;return result;
end; $$;

create or replace function public.set_roll30_prompt_status(target_prompt uuid,next_status text)
returns public.prompts language plpgsql security definer set search_path=public as $$
declare result public.prompts;
begin select * into result from public.prompts where id=target_prompt for update;if result.id is null or not public.is_campaign_gm(result.campaign_id) then raise exception 'Prompt not found';end if;if next_status not in ('open','closed') then raise exception 'Unknown prompt status';end if;update public.prompts set status=next_status,updated_at=now() where id=target_prompt returning * into result;return result;end; $$;

create or replace function public.submit_roll30_prompt_response(target_prompt uuid,next_response jsonb)
returns public.prompt_responses language plpgsql security definer set search_path=public as $$
declare p public.prompts;result public.prompt_responses;
begin select * into p from public.prompts where id=target_prompt;if p.id is null or p.status<>'open' or not public.is_campaign_member(p.campaign_id) or (cardinality(p.audience)>0 and not auth.uid()=any(p.audience)) then raise exception 'Prompt is not open for you';end if;insert into public.prompt_responses(prompt_id,user_id,response) values(target_prompt,auth.uid(),next_response) on conflict(prompt_id,user_id) do update set response=excluded.response,updated_at=now() returning * into result;return result;end; $$;

revoke all on function public.send_roll30_message(uuid,text,text,uuid,text) from public,anon;
revoke all on function public.mark_roll30_messages_read(uuid) from public,anon;
revoke all on function public.create_roll30_prompt(uuid,text,text,uuid[],jsonb) from public,anon;
revoke all on function public.set_roll30_prompt_status(uuid,text) from public,anon;
revoke all on function public.submit_roll30_prompt_response(uuid,jsonb) from public,anon;
grant execute on function public.send_roll30_message(uuid,text,text,uuid,text) to authenticated;
grant execute on function public.mark_roll30_messages_read(uuid) to authenticated;
grant execute on function public.create_roll30_prompt(uuid,text,text,uuid[],jsonb) to authenticated;
grant execute on function public.set_roll30_prompt_status(uuid,text) to authenticated;
grant execute on function public.submit_roll30_prompt_response(uuid,jsonb) to authenticated;
