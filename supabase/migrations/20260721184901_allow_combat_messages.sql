-- resolve_roll30_attack records an attack in the shared message timeline.
-- The original constraint omitted that server-generated message kind.

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
check (kind in ('message', 'whisper', 'action', 'roll', 'check_request', 'attack'));
