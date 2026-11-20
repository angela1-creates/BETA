-- Partner matching lifecycle, reminder outbox, and pilot-safe SMS preferences.
-- Apply after 0006_fix_crew_invitation_expiry.sql.

alter table public.availability drop constraint if exists availability_status_check;
update public.availability set status = 'active' where status = 'pending';
update public.availability set status = 'matched' where status = 'confirmed';
alter table public.availability add constraint availability_status_check
  check (status in ('active', 'matched', 'cancelled'));

alter table public.invitations add column if not exists expires_at timestamptz;
update public.invitations
set expires_at = least(created_at + interval '12 hours', (select starts_at - interval '30 minutes' from public.availability where id = availability_id))
where expires_at is null;
alter table public.invitations alter column expires_at set default (now() + interval '12 hours');
alter table public.invitations alter column expires_at set not null;
with ranked as (
  select id, row_number() over (partition by availability_id, sender_id order by created_at, id) as position
  from public.invitations where status = 'pending'
)
update public.invitations i set status = 'cancelled' from ranked r where i.id = r.id and r.position > 1;
create unique index if not exists invitations_one_pending_sender_idx
  on public.invitations(availability_id, sender_id) where status = 'pending';

alter table public.sessions add column if not exists ends_at timestamptz;
update public.sessions set ends_at = starts_at + interval '2 hours' where ends_at is null;
alter table public.sessions alter column ends_at set not null;
alter table public.sessions add column if not exists cancelled_by uuid references public.profiles(id) on delete set null;
alter table public.sessions add column if not exists cancellation_reason text;
alter table public.sessions add column if not exists reconfirm_by timestamptz;
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check check (
  status in ('confirmed', 'reconfirmation_pending', 'reconfirmed', 'at_risk', 'completed', 'cancelled', 'disputed')
);

alter table public.session_members add column if not exists reconfirmed_at timestamptz;
alter table public.session_members add column if not exists completion_response text
  check (completion_response in ('climbed', 'did_not_climb'));
alter table public.session_members add column if not exists completion_responded_at timestamptz;

create table if not exists public.partner_sms_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone_e164 text not null,
  phone_last4 text not null check (char_length(phone_last4) = 4),
  verified_at timestamptz not null,
  sms_opt_in boolean not null default true,
  consent_version text not null default 'partner-sms-v1',
  consented_at timestamptz not null default now(),
  stopped_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists partner_sms_preferences_phone_key on public.partner_sms_preferences(phone_e164);

create table if not exists public.partner_notification_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('interest_received', 'session_confirmed', 'session_reminder', 'session_cancelled', 'reconfirmation_due', 'session_at_risk')),
  event_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('inbox_only', 'queued', 'sending', 'sent', 'delivered', 'delivery_unknown', 'failed', 'opted_out')),
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz
);

create index if not exists partner_notification_queue_idx
  on public.partner_notification_events(status, created_at) where status in ('queued', 'failed');

alter table public.partner_sms_preferences enable row level security;
alter table public.partner_notification_events enable row level security;
revoke all on public.partner_sms_preferences, public.partner_notification_events from anon, authenticated;

create or replace function public.queue_partner_notification(
  p_profile_id uuid, p_event_type text, p_event_key text, p_payload jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare destination_status text;
begin
  select case when sms_opt_in and stopped_at is null and verified_at is not null then 'queued' else 'inbox_only' end
    into destination_status
  from public.partner_sms_preferences where profile_id = p_profile_id;
  destination_status := coalesce(destination_status, 'inbox_only');
  insert into public.partner_notification_events(profile_id, event_type, event_key, payload, status)
    values (p_profile_id, p_event_type, p_event_key, p_payload, destination_status)
  on conflict (event_key) do nothing;
end;
$$;
revoke all on function public.queue_partner_notification(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.queue_due_partner_notifications()
returns integer
language plpgsql security definer set search_path = public as $$
declare queued integer := 0;
declare item record;
begin
  for item in
    select s.id, s.starts_at, s.ends_at, sm.profile_id
    from public.sessions s join public.session_members sm on sm.session_id = s.id
    where s.status in ('confirmed', 'reconfirmation_pending')
      and s.starts_at > now() + interval '23 hours'
      and s.starts_at <= now() + interval '25 hours'
  loop
    perform public.queue_partner_notification(item.profile_id, 'session_reminder', 'reminder:' || item.id::text || ':' || item.profile_id::text, jsonb_build_object('session_id', item.id, 'starts_at', item.starts_at, 'ends_at', item.ends_at));
    queued := queued + 1;
  end loop;

  for item in
    select s.id, s.starts_at, s.ends_at, sm.profile_id
    from public.sessions s join public.session_members sm on sm.session_id = s.id
    where s.status = 'confirmed'
      and s.starts_at > now()
      and s.starts_at <= now() + interval '3 hours'
  loop
    perform public.queue_partner_notification(item.profile_id, 'reconfirmation_due', 'reconfirm:' || item.id::text || ':' || item.profile_id::text, jsonb_build_object('session_id', item.id, 'starts_at', item.starts_at, 'ends_at', item.ends_at));
    queued := queued + 1;
  end loop;
  update public.sessions set status = 'reconfirmation_pending'
    where status = 'confirmed' and starts_at > now() and starts_at <= now() + interval '3 hours';

  for item in
    select s.id, s.starts_at, s.ends_at, sm.profile_id
    from public.sessions s join public.session_members sm on sm.session_id = s.id
    where s.status = 'reconfirmation_pending' and s.reconfirm_by <= now() and s.starts_at > now() and sm.reconfirmed_at is not null
  loop
    perform public.queue_partner_notification(item.profile_id, 'session_at_risk', 'at-risk:' || item.id::text || ':' || item.profile_id::text, jsonb_build_object('session_id', item.id, 'starts_at', item.starts_at, 'ends_at', item.ends_at));
    queued := queued + 1;
  end loop;
  update public.sessions s set status = 'at_risk'
    where s.status = 'reconfirmation_pending' and s.reconfirm_by <= now() and s.starts_at > now()
      and exists (select 1 from public.session_members sm where sm.session_id = s.id and sm.reconfirmed_at is null);
  return queued;
end;
$$;
revoke all on function public.queue_due_partner_notifications() from public, anon, authenticated;
grant execute on function public.queue_due_partner_notifications() to service_role;

create or replace function public.send_partner_invitation(p_availability_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target public.availability;
  invitation_id uuid;
begin
  if not public.is_adult_research_participant() then raise exception 'Adult consent is required'; end if;
  select * into target from public.availability where id = p_availability_id for update;
  if target.id is null or target.status <> 'active' or target.expires_at <= now() then raise exception 'This request is no longer active'; end if;
  if target.owner_id = auth.uid() then raise exception 'You cannot express interest in your own request'; end if;
  if exists (select 1 from public.blocks b where (b.blocker_id = auth.uid() and b.blocked_id = target.owner_id) or (b.blocker_id = target.owner_id and b.blocked_id = auth.uid())) then raise exception 'This request is unavailable'; end if;

  select id into invitation_id from public.invitations
    where availability_id = target.id and sender_id = auth.uid() and status = 'pending';
  if invitation_id is not null then return invitation_id; end if;

  insert into public.invitations (availability_id, sender_id, recipient_id, expires_at)
    values (target.id, auth.uid(), target.owner_id, least(now() + interval '12 hours', target.starts_at - interval '30 minutes'))
    returning id into invitation_id;
  perform public.queue_partner_notification(
    target.owner_id, 'interest_received', 'interest:' || invitation_id::text,
    jsonb_build_object('invitation_id', invitation_id, 'availability_id', target.id, 'starts_at', target.starts_at, 'ends_at', target.ends_at)
  );
  return invitation_id;
end;
$$;
revoke all on function public.send_partner_invitation(uuid) from public;
grant execute on function public.send_partner_invitation(uuid) to authenticated;

create or replace function public.respond_partner_invitation(p_invitation_id uuid, p_response text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  invite public.invitations;
  target public.availability;
  new_session_id uuid;
  conflicting boolean;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'Invalid response'; end if;
  if not public.is_adult_research_participant() then raise exception 'Adult consent is required'; end if;
  select * into invite from public.invitations where id = p_invitation_id for update;
  if invite.id is null or invite.recipient_id <> auth.uid() or invite.status <> 'pending' or invite.expires_at <= now() then raise exception 'Interest is unavailable'; end if;
  select * into target from public.availability where id = invite.availability_id for update;
  if target.id is null or target.status <> 'active' or target.expires_at <= now() then raise exception 'This request is no longer active'; end if;

  if p_response = 'declined' then
    update public.invitations set status = 'declined' where id = invite.id;
    return null;
  end if;

  select exists (
    select 1 from public.sessions s join public.session_members sm on sm.session_id = s.id
    where sm.profile_id in (target.owner_id, invite.sender_id)
      and s.status not in ('cancelled', 'completed', 'disputed')
      and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(target.starts_at, target.ends_at, '[)')
  ) into conflicting;
  if conflicting then raise exception 'One climber already has a session during this time'; end if;

  update public.invitations set status = 'accepted' where id = invite.id;
  update public.invitations set status = 'cancelled'
    where availability_id = target.id and id <> invite.id and status = 'pending';
  update public.availability set status = 'matched' where id = target.id;
  insert into public.sessions (gym_id, starts_at, ends_at, status, created_by, reconfirm_by)
    values (target.gym_id, target.starts_at, target.ends_at, 'confirmed', target.owner_id, target.starts_at - interval '90 minutes')
    returning id into new_session_id;
  insert into public.session_members (session_id, profile_id)
    values (new_session_id, target.owner_id), (new_session_id, invite.sender_id);

  perform public.queue_partner_notification(target.owner_id, 'session_confirmed', 'confirmed:' || new_session_id::text || ':' || target.owner_id::text, jsonb_build_object('session_id', new_session_id, 'starts_at', target.starts_at, 'ends_at', target.ends_at));
  perform public.queue_partner_notification(invite.sender_id, 'session_confirmed', 'confirmed:' || new_session_id::text || ':' || invite.sender_id::text, jsonb_build_object('session_id', new_session_id, 'starts_at', target.starts_at, 'ends_at', target.ends_at));
  return new_session_id;
end;
$$;
revoke all on function public.respond_partner_invitation(uuid, text) from public;
grant execute on function public.respond_partner_invitation(uuid, text) to authenticated;

create or replace function public.cancel_partner_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare invite public.invitations;
begin
  select * into invite from public.invitations where id = p_invitation_id for update;
  if invite.id is null or invite.sender_id <> auth.uid() or invite.status <> 'pending' then raise exception 'Interest is unavailable'; end if;
  update public.invitations set status = 'cancelled' where id = invite.id;
end;
$$;
revoke all on function public.cancel_partner_invitation(uuid) from public;
grant execute on function public.cancel_partner_invitation(uuid) to authenticated;

create or replace function public.cancel_partner_session(p_session_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare session_row public.sessions;
declare other_member uuid;
begin
  select s.* into session_row from public.sessions s join public.session_members sm on sm.session_id = s.id
    where s.id = p_session_id and sm.profile_id = auth.uid() for update of s;
  if session_row.id is null or session_row.status in ('cancelled', 'completed', 'disputed') then raise exception 'Session is unavailable'; end if;
  update public.sessions set status = 'cancelled', cancelled_by = auth.uid(), cancellation_reason = nullif(left(trim(coalesce(p_reason, '')), 180), '') where id = p_session_id;
  select profile_id into other_member from public.session_members where session_id = p_session_id and profile_id <> auth.uid() limit 1;
  if other_member is not null then
    perform public.queue_partner_notification(other_member, 'session_cancelled', 'cancelled:' || p_session_id::text || ':' || other_member::text, jsonb_build_object('session_id', p_session_id, 'starts_at', session_row.starts_at));
  end if;
end;
$$;
revoke all on function public.cancel_partner_session(uuid, text) from public;
grant execute on function public.cancel_partner_session(uuid, text) to authenticated;

create or replace function public.reconfirm_partner_session(p_session_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare confirmations integer;
begin
  if not exists (select 1 from public.session_members where session_id = p_session_id and profile_id = auth.uid()) then raise exception 'Session is unavailable'; end if;
  if not exists (select 1 from public.sessions where id = p_session_id and status in ('confirmed', 'reconfirmation_pending', 'at_risk')) then raise exception 'Session cannot be reconfirmed'; end if;
  update public.session_members set reconfirmed_at = now() where session_id = p_session_id and profile_id = auth.uid();
  select count(*) into confirmations from public.session_members where session_id = p_session_id and reconfirmed_at is not null;
  update public.sessions set status = case when confirmations >= 2 then 'reconfirmed' else 'reconfirmation_pending' end where id = p_session_id;
  return case when confirmations >= 2 then 'reconfirmed' else 'waiting' end;
end;
$$;
revoke all on function public.reconfirm_partner_session(uuid) from public;
grant execute on function public.reconfirm_partner_session(uuid) to authenticated;

create or replace function public.complete_partner_session(p_session_id uuid, p_climbed boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare responses text[];
declare next_status text;
begin
  if not exists (select 1 from public.session_members where session_id = p_session_id and profile_id = auth.uid()) then raise exception 'Session is unavailable'; end if;
  if not exists (select 1 from public.sessions where id = p_session_id and ends_at <= now() and status not in ('cancelled', 'completed', 'disputed')) then raise exception 'Completion can be recorded after the session'; end if;
  update public.session_members set completion_response = case when p_climbed then 'climbed' else 'did_not_climb' end, completion_responded_at = now()
    where session_id = p_session_id and profile_id = auth.uid();
  select array_agg(completion_response) into responses from public.session_members where session_id = p_session_id and completion_response is not null;
  if coalesce(array_length(responses, 1), 0) < 2 then return 'waiting'; end if;
  next_status := case when responses <@ array['climbed']::text[] then 'completed' else 'disputed' end;
  update public.sessions set status = next_status where id = p_session_id;
  return next_status;
end;
$$;
revoke all on function public.complete_partner_session(uuid, boolean) from public;
grant execute on function public.complete_partner_session(uuid, boolean) to authenticated;

create or replace function public.block_partner_profile(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare item record;
begin
  if p_profile_id = auth.uid() then raise exception 'You cannot block yourself'; end if;
  insert into public.blocks(blocker_id, blocked_id) values (auth.uid(), p_profile_id) on conflict do nothing;
  update public.invitations set status = 'cancelled'
    where status = 'pending' and ((sender_id = auth.uid() and recipient_id = p_profile_id) or (sender_id = p_profile_id and recipient_id = auth.uid()));
  for item in
    update public.sessions s set status = 'cancelled', cancelled_by = auth.uid(), cancellation_reason = 'Match unavailable'
      where s.starts_at > now() and s.status not in ('cancelled', 'completed', 'disputed')
        and exists (select 1 from public.session_members a where a.session_id = s.id and a.profile_id = auth.uid())
        and exists (select 1 from public.session_members b where b.session_id = s.id and b.profile_id = p_profile_id)
      returning s.id, s.starts_at, s.ends_at
  loop
    perform public.queue_partner_notification(p_profile_id, 'session_cancelled', 'blocked-cancelled:' || item.id::text || ':' || p_profile_id::text, jsonb_build_object('session_id', item.id, 'starts_at', item.starts_at, 'ends_at', item.ends_at));
  end loop;
end;
$$;
revoke all on function public.block_partner_profile(uuid) from public;
grant execute on function public.block_partner_profile(uuid) to authenticated;

create or replace function public.my_partner_activity()
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_adult_research_participant() then
    jsonb_build_object('requests', '[]'::jsonb, 'invitations', '[]'::jsonb, 'sessions', '[]'::jsonb)
  else jsonb_build_object(
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'owner_id', a.owner_id, 'display_name', p.display_name, 'experience_level', p.experience_level,
      'gym_id', g.id, 'gym_name', g.name, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
      'disciplines', a.disciplines, 'looking_for', a.looking_for, 'message', coalesce(a.message, ''),
      'status', case when a.expires_at <= now() then 'expired' else a.status end
    ) order by a.starts_at desc) from public.availability a join public.profiles p on p.id = a.owner_id join public.gyms g on g.id = a.gym_id where a.owner_id = auth.uid()), '[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'availability_id', i.availability_id,
      'status', case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
      'direction', case when i.sender_id = auth.uid() then 'sent' else 'received' end,
      'counterpart_id', case when i.sender_id = auth.uid() then i.recipient_id else i.sender_id end,
      'counterpart_name', cp.display_name, 'gym_id', g.id, 'gym_name', g.name,
      'starts_at', a.starts_at, 'ends_at', a.ends_at, 'disciplines', a.disciplines,
      'looking_for', a.looking_for, 'message', coalesce(a.message, ''), 'expires_at', i.expires_at
    ) order by i.created_at desc) from public.invitations i join public.availability a on a.id = i.availability_id join public.gyms g on g.id = a.gym_id join public.profiles cp on cp.id = case when i.sender_id = auth.uid() then i.recipient_id else i.sender_id end where i.sender_id = auth.uid() or i.recipient_id = auth.uid()), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'gym_name', g.name, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'status', s.status,
      'counterpart_id', cp.id, 'counterpart_name', cp.display_name, 'reconfirm_by', s.reconfirm_by,
      'reconfirmed_at', mine.reconfirmed_at, 'completion_response', mine.completion_response
    ) order by s.starts_at desc) from public.sessions s join public.gyms g on g.id = s.gym_id join public.session_members mine on mine.session_id = s.id and mine.profile_id = auth.uid() left join public.session_members theirs on theirs.session_id = s.id and theirs.profile_id <> auth.uid() left join public.profiles cp on cp.id = theirs.profile_id), '[]'::jsonb)
  ) end;
$$;
revoke all on function public.my_partner_activity() from public;
grant execute on function public.my_partner_activity() to authenticated;
