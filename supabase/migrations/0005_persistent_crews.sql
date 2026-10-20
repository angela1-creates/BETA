-- Persistent private crews and revocable invitation links.
-- Apply after 0004_partner_matching.sql.

alter table public.crews add column if not exists created_at timestamptz not null default now();
alter table public.crews add column if not exists updated_at timestamptz not null default now();
alter table public.crews drop constraint if exists crews_name_check;
alter table public.crews add constraint crews_name_check check (char_length(btrim(name)) between 1 and 60);
alter table public.crews drop constraint if exists crews_kind_check;
alter table public.crews add constraint crews_kind_check check (kind in ('Friends', 'Couple', 'Family', 'Gym group'));
alter table public.crews drop constraint if exists crews_owner_id_fkey;
alter table public.crews add constraint crews_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.crew_members add column if not exists joined_at timestamptz not null default now();
alter table public.crew_members drop constraint if exists crew_members_role_check;
alter table public.crew_members add constraint crew_members_role_check check (role in ('owner', 'member'));
create index if not exists crew_members_profile_idx on public.crew_members(profile_id, joined_at desc);

create table if not exists public.crew_invitations (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (expires_at > created_at)
);
create index if not exists crew_invitations_crew_created_idx on public.crew_invitations(crew_id, created_at desc);
create index if not exists crew_invitations_inviter_created_idx on public.crew_invitations(inviter_id, created_at desc);
alter table public.crew_invitations enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_current_crew_member(p_crew_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.crew_members cm
    where cm.crew_id = p_crew_id and cm.profile_id = (select auth.uid())
  );
$$;
revoke all on function private.is_current_crew_member(uuid) from public;
grant execute on function private.is_current_crew_member(uuid) to authenticated;

create or replace function private.is_current_crew_owner(p_crew_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.crews c
    where c.id = p_crew_id and c.owner_id = (select auth.uid())
  );
$$;
revoke all on function private.is_current_crew_owner(uuid) from public;
grant execute on function private.is_current_crew_owner(uuid) to authenticated;

drop policy if exists "crew members" on public.crews;
drop policy if exists "crew owners insert crews" on public.crews;
drop policy if exists "crew owners update crews" on public.crews;
drop policy if exists "crew owners manage membership" on public.crew_members;
drop policy if exists "members read crew membership" on public.crew_members;

create policy "members read crews" on public.crews for select to authenticated
  using (private.is_current_crew_member(id));
create policy "owners update crews" on public.crews for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owners delete crews" on public.crews for delete to authenticated
  using (owner_id = (select auth.uid()));
create policy "members read memberships" on public.crew_members for select to authenticated
  using (private.is_current_crew_member(crew_id));
create policy "inviters read crew invitations" on public.crew_invitations for select to authenticated
  using (inviter_id = (select auth.uid()) or private.is_current_crew_owner(crew_id));

revoke all on public.crews, public.crew_members, public.crew_invitations from anon;
revoke insert, update, delete on public.crews, public.crew_members, public.crew_invitations from authenticated;
grant select on public.crews, public.crew_members, public.crew_invitations to authenticated;

create or replace function public.create_crew(p_name text, p_kind text, p_guardian_managed boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_crew_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.is_adult_research_participant() then raise exception 'Adult consent is required'; end if;
  if char_length(btrim(p_name)) not between 1 and 60 then raise exception 'Crew name must be 1 to 60 characters'; end if;
  if p_kind not in ('Friends', 'Couple', 'Family', 'Gym group') then raise exception 'Invalid crew type'; end if;

  insert into public.crews(owner_id, name, kind, guardian_managed)
    values ((select auth.uid()), btrim(p_name), p_kind, coalesce(p_guardian_managed, false))
    returning id into new_crew_id;
  insert into public.crew_members(crew_id, profile_id, role)
    values (new_crew_id, (select auth.uid()), 'owner');
  return new_crew_id;
end;
$$;
revoke all on function public.create_crew(text, text, boolean) from public;
grant execute on function public.create_crew(text, text, boolean) to authenticated;

create or replace function public.my_crews()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'kind', c.kind,
    'guardian_managed', c.guardian_managed,
    'owner_id', c.owner_id,
    'role', self.role,
    'created_at', c.created_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cm.profile_id,
        'display_name', p.display_name,
        'role', cm.role,
        'joined_at', cm.joined_at
      ) order by case when cm.role = 'owner' then 0 else 1 end, cm.joined_at)
      from public.crew_members cm
      join public.profiles p on p.id = cm.profile_id
      where cm.crew_id = c.id
    ), '[]'::jsonb)
  ) order by c.created_at desc), '[]'::jsonb)
  from public.crews c
  join public.crew_members self on self.crew_id = c.id and self.profile_id = (select auth.uid())
  where public.is_adult_research_participant();
$$;
revoke all on function public.my_crews() from public;
grant execute on function public.my_crews() to authenticated;

create or replace function public.create_crew_invitation(p_crew_id uuid, p_token_hash text)
returns table(id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; new_expiry timestamptz := now() + interval '7 days';
begin
  if not public.is_adult_research_participant() then raise exception 'Adult consent is required'; end if;
  if not private.is_current_crew_member(p_crew_id) then raise exception 'Crew membership required'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation token'; end if;
  if (select count(*) from public.crew_invitations
      where inviter_id = (select auth.uid()) and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Invitation limit reached. Try again later';
  end if;

  update public.crew_invitations set status = 'expired', responded_at = now()
    where status = 'pending' and expires_at <= now();
  insert into public.crew_invitations(crew_id, inviter_id, token_hash, expires_at)
    values (p_crew_id, (select auth.uid()), p_token_hash, new_expiry)
    returning crew_invitations.id into new_id;
  return query select new_id, new_expiry;
end;
$$;
revoke all on function public.create_crew_invitation(uuid, text) from public;
grant execute on function public.create_crew_invitation(uuid, text) to authenticated;

create or replace function public.resolve_crew_invitation(p_token_hash text)
returns table(crew_name text, inviter_name text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.name, p.display_name, ci.expires_at
  from public.crew_invitations ci
  join public.crews c on c.id = ci.crew_id
  join public.profiles p on p.id = ci.inviter_id
  where ci.token_hash = p_token_hash
    and ci.status = 'pending'
    and ci.expires_at > now();
$$;
revoke all on function public.resolve_crew_invitation(text) from public;
grant execute on function public.resolve_crew_invitation(text) to anon, authenticated;

create or replace function public.respond_crew_invitation(p_token_hash text, p_response text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.crew_invitations;
begin
  if not public.is_adult_research_participant() then raise exception 'Adult consent is required'; end if;
  if p_response not in ('accepted', 'declined') then raise exception 'Invalid response'; end if;
  select * into invite from public.crew_invitations
    where token_hash = p_token_hash for update;
  if invite.id is null or invite.status <> 'pending' or invite.expires_at <= now() then
    raise exception 'This invitation is unavailable or expired';
  end if;

  if p_response = 'accepted' then
    insert into public.crew_members(crew_id, profile_id, role)
      values (invite.crew_id, (select auth.uid()), 'member')
      on conflict (crew_id, profile_id) do nothing;
    update public.crew_invitations set status = 'accepted', accepted_by = (select auth.uid()), responded_at = now()
      where id = invite.id;
  else
    update public.crew_invitations set status = 'declined', responded_at = now()
      where id = invite.id;
  end if;
  return invite.crew_id;
end;
$$;
revoke all on function public.respond_crew_invitation(text, text) from public;
grant execute on function public.respond_crew_invitation(text, text) to authenticated;

create or replace function public.revoke_crew_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare invite public.crew_invitations;
begin
  select * into invite from public.crew_invitations where id = p_invitation_id for update;
  if invite.id is null or invite.status <> 'pending' then raise exception 'Invitation is unavailable'; end if;
  if invite.inviter_id <> (select auth.uid()) and not private.is_current_crew_owner(invite.crew_id) then
    raise exception 'Only the inviter or crew owner can revoke this invitation';
  end if;
  update public.crew_invitations set status = 'revoked', responded_at = now() where id = invite.id;
end;
$$;
revoke all on function public.revoke_crew_invitation(uuid) from public;
grant execute on function public.revoke_crew_invitation(uuid) to authenticated;

create or replace function public.delete_crew(p_crew_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_current_crew_owner(p_crew_id) then raise exception 'Crew owner access required'; end if;
  delete from public.crews where id = p_crew_id and owner_id = (select auth.uid());
end;
$$;
revoke all on function public.delete_crew(uuid) from public;
grant execute on function public.delete_crew(uuid) to authenticated;

create or replace function public.leave_crew(p_crew_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.is_current_crew_owner(p_crew_id) then raise exception 'Transfer or delete the crew before leaving'; end if;
  delete from public.crew_members where crew_id = p_crew_id and profile_id = (select auth.uid());
  if not found then raise exception 'Crew membership not found'; end if;
end;
$$;
revoke all on function public.leave_crew(uuid) from public;
grant execute on function public.leave_crew(uuid) to authenticated;

create or replace function public.remove_crew_member(p_crew_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_current_crew_owner(p_crew_id) then raise exception 'Crew owner access required'; end if;
  if p_profile_id = (select auth.uid()) then raise exception 'The crew owner cannot remove themselves'; end if;
  delete from public.crew_members where crew_id = p_crew_id and profile_id = p_profile_id and role = 'member';
  if not found then raise exception 'Crew member not found'; end if;
end;
$$;
revoke all on function public.remove_crew_member(uuid, uuid) from public;
grant execute on function public.remove_crew_member(uuid, uuid) to authenticated;

drop trigger if exists touch_crews on public.crews;
create trigger touch_crews before update on public.crews
for each row execute function public.touch_research_updated_at();
