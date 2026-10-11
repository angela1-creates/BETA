-- Real, adult-only partner matching for the Bay Area Movement pilot.
-- Apply after 0003_research_mvp.sql. All discovery is authenticated and the
-- functions expose only the small profile surface needed to arrange a climb.

insert into public.gyms (id, name, city) values
  ('ba000000-0000-4000-8000-000000000001', 'Movement Belmont', 'Belmont'),
  ('ba000000-0000-4000-8000-000000000002', 'Movement Mountain View', 'Mountain View'),
  ('ba000000-0000-4000-8000-000000000003', 'Movement San Francisco', 'San Francisco'),
  ('ba000000-0000-4000-8000-000000000004', 'Movement Santa Clara', 'Santa Clara'),
  ('ba000000-0000-4000-8000-000000000005', 'Movement Sunnyvale', 'Sunnyvale')
on conflict (id) do update set name = excluded.name, city = excluded.city;

alter table public.availability drop constraint if exists availability_status_check;
alter table public.availability add constraint availability_status_check
  check (status in ('active', 'pending', 'confirmed', 'cancelled'));

-- Preserve the account/media deletion promise after a tester has participated in
-- matching. Deleting either participant removes their dependent pilot records.
alter table public.invitations drop constraint if exists invitations_sender_id_fkey;
alter table public.invitations add constraint invitations_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete cascade;
alter table public.invitations drop constraint if exists invitations_recipient_id_fkey;
alter table public.invitations add constraint invitations_recipient_id_fkey foreign key (recipient_id) references public.profiles(id) on delete cascade;
alter table public.sessions drop constraint if exists sessions_created_by_fkey;
alter table public.sessions add constraint sessions_created_by_fkey foreign key (created_by) references public.profiles(id) on delete cascade;
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles(id) on delete cascade;
alter table public.reports drop constraint if exists reports_reported_id_fkey;
alter table public.reports add constraint reports_reported_id_fkey foreign key (reported_id) references public.profiles(id) on delete cascade;

create or replace function public.is_adult_research_participant()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_adult and consented_at is not null
  );
$$;

revoke all on function public.is_adult_research_participant() from public;
grant execute on function public.is_adult_research_participant() to authenticated;

create or replace function public.partner_board(p_gym_id uuid)
returns table (
  id uuid, owner_id uuid, display_name text, experience_level text,
  gym_id uuid, gym_name text, starts_at timestamptz, ends_at timestamptz,
  disciplines text[], looking_for text, message text, status text
)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.owner_id, p.display_name, p.experience_level,
    g.id, g.name, a.starts_at, a.ends_at, a.disciplines,
    a.looking_for, coalesce(a.message, ''), a.status
  from public.availability a
  join public.profiles p on p.id = a.owner_id
  join public.gyms g on g.id = a.gym_id
  where public.is_adult_research_participant()
    and a.gym_id = p_gym_id
    and a.status = 'active'
    and a.expires_at > now()
    and a.owner_id <> auth.uid()
    and p.is_adult
    and p.consented_at is not null
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = a.owner_id)
         or (b.blocker_id = a.owner_id and b.blocked_id = auth.uid())
    )
  order by a.starts_at asc;
$$;

revoke all on function public.partner_board(uuid) from public;
grant execute on function public.partner_board(uuid) to authenticated;

create or replace function public.my_partner_activity()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select case when not public.is_adult_research_participant() then
    jsonb_build_object('requests', '[]'::jsonb, 'invitations', '[]'::jsonb, 'sessions', '[]'::jsonb)
  else jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'owner_id', a.owner_id, 'display_name', p.display_name,
        'experience_level', p.experience_level, 'gym_id', g.id, 'gym_name', g.name,
        'starts_at', a.starts_at, 'ends_at', a.ends_at, 'disciplines', a.disciplines,
        'looking_for', a.looking_for, 'message', coalesce(a.message, ''),
        'status', case when a.expires_at <= now() then 'expired' else a.status end
      ) order by a.starts_at desc)
      from public.availability a
      join public.profiles p on p.id = a.owner_id
      join public.gyms g on g.id = a.gym_id
      where a.owner_id = auth.uid()
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'availability_id', i.availability_id, 'status', i.status,
        'direction', case when i.sender_id = auth.uid() then 'sent' else 'received' end,
        'counterpart_id', case when i.sender_id = auth.uid() then i.recipient_id else i.sender_id end,
        'counterpart_name', cp.display_name, 'gym_id', g.id, 'gym_name', g.name,
        'starts_at', a.starts_at, 'ends_at', a.ends_at, 'disciplines', a.disciplines,
        'looking_for', a.looking_for, 'message', coalesce(a.message, '')
      ) order by i.created_at desc)
      from public.invitations i
      join public.availability a on a.id = i.availability_id
      join public.gyms g on g.id = a.gym_id
      join public.profiles cp on cp.id = case when i.sender_id = auth.uid() then i.recipient_id else i.sender_id end
      where i.sender_id = auth.uid() or i.recipient_id = auth.uid()
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'gym_name', g.name, 'starts_at', s.starts_at, 'status', s.status
      ) order by s.starts_at desc)
      from public.sessions s
      join public.gyms g on g.id = s.gym_id
      join public.session_members sm on sm.session_id = s.id
      where sm.profile_id = auth.uid()
    ), '[]'::jsonb)
  ) end;
$$;

revoke all on function public.my_partner_activity() from public;
grant execute on function public.my_partner_activity() to authenticated;

create or replace function public.send_partner_invitation(p_availability_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  target public.availability;
  invitation_id uuid;
begin
  if not public.is_adult_research_participant() then raise exception 'Adult consent is required'; end if;
  select * into target from public.availability where id = p_availability_id for update;
  if target.id is null or target.status <> 'active' or target.expires_at <= now() then raise exception 'This request is no longer active'; end if;
  if target.owner_id = auth.uid() then raise exception 'You cannot invite yourself'; end if;
  if exists (select 1 from public.blocks b where (b.blocker_id = auth.uid() and b.blocked_id = target.owner_id) or (b.blocker_id = target.owner_id and b.blocked_id = auth.uid())) then raise exception 'This request is unavailable'; end if;
  update public.availability set status = 'pending' where id = target.id;
  insert into public.invitations (availability_id, sender_id, recipient_id)
    values (target.id, auth.uid(), target.owner_id) returning id into invitation_id;
  return invitation_id;
end;
$$;

revoke all on function public.send_partner_invitation(uuid) from public;
grant execute on function public.send_partner_invitation(uuid) to authenticated;

create or replace function public.respond_partner_invitation(p_invitation_id uuid, p_response text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  invite public.invitations;
  target public.availability;
  new_session_id uuid;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'Invalid response'; end if;
  if not public.is_adult_research_participant() then raise exception 'Adult consent is required'; end if;
  select * into invite from public.invitations where id = p_invitation_id for update;
  if invite.id is null or invite.recipient_id <> auth.uid() or invite.status <> 'pending' then raise exception 'Invitation is unavailable'; end if;
  select * into target from public.availability where id = invite.availability_id for update;
  if target.expires_at <= now() then raise exception 'This request has expired'; end if;
  update public.invitations set status = p_response where id = invite.id;
  if p_response = 'declined' then
    update public.availability set status = 'active' where id = target.id;
    return null;
  end if;
  update public.availability set status = 'confirmed' where id = target.id;
  insert into public.sessions (gym_id, starts_at, status, created_by)
    values (target.gym_id, target.starts_at, 'confirmed', target.owner_id)
    returning id into new_session_id;
  insert into public.session_members (session_id, profile_id)
    values (new_session_id, target.owner_id), (new_session_id, invite.sender_id);
  return new_session_id;
end;
$$;

revoke all on function public.respond_partner_invitation(uuid, text) from public;
grant execute on function public.respond_partner_invitation(uuid, text) to authenticated;

create or replace function public.cancel_partner_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare invite public.invitations;
begin
  select * into invite from public.invitations where id = p_invitation_id for update;
  if invite.id is null or invite.sender_id <> auth.uid() or invite.status <> 'pending' then raise exception 'Invitation is unavailable'; end if;
  update public.invitations set status = 'cancelled' where id = invite.id;
  update public.availability set status = 'active'
    where id = invite.availability_id and expires_at > now();
end;
$$;

revoke all on function public.cancel_partner_invitation(uuid) from public;
grant execute on function public.cancel_partner_invitation(uuid) to authenticated;
