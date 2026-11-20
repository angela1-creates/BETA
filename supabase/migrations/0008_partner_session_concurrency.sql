-- Serialize partner matching and session responses, and atomically claim SMS work.
-- Apply after 0007_partner_sessions_and_notifications.sql.

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

  -- Different availability rows can involve the same climber. Lock both profiles in
  -- stable order so two concurrent acceptances cannot both pass the overlap check.
  if target.owner_id::text < invite.sender_id::text then
    perform pg_advisory_xact_lock(hashtextextended(target.owner_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(invite.sender_id::text, 0));
  else
    perform pg_advisory_xact_lock(hashtextextended(invite.sender_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(target.owner_id::text, 0));
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

create or replace function public.reconfirm_partner_session(p_session_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare confirmations integer;
declare session_status text;
begin
  select s.status into session_status
  from public.sessions s join public.session_members sm on sm.session_id = s.id
  where s.id = p_session_id and sm.profile_id = auth.uid()
  for update of s;
  if session_status is null then raise exception 'Session is unavailable'; end if;
  if session_status not in ('confirmed', 'reconfirmation_pending', 'at_risk') then raise exception 'Session cannot be reconfirmed'; end if;
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
declare session_status text;
begin
  select s.status into session_status
  from public.sessions s join public.session_members sm on sm.session_id = s.id
  where s.id = p_session_id and sm.profile_id = auth.uid() and s.ends_at <= now()
  for update of s;
  if session_status is null or session_status in ('cancelled', 'completed', 'disputed') then raise exception 'Completion can be recorded after the session'; end if;
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

create or replace function public.claim_partner_notification_events(p_limit integer default 50)
returns setof public.partner_notification_events
language sql security definer set search_path = public as $$
  with claimed as (
    select id
    from public.partner_notification_events
    where status in ('queued', 'failed') and attempt_count < 2
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 50))
  )
  update public.partner_notification_events event
  set status = 'sending', attempt_count = event.attempt_count + 1
  from claimed
  where event.id = claimed.id
  returning event.*;
$$;
revoke all on function public.claim_partner_notification_events(integer) from public, anon, authenticated;
grant execute on function public.claim_partner_notification_events(integer) to service_role;
