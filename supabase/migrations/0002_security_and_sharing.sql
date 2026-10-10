-- Production hardening for BETA. Apply after 0001_beta_social.sql.
-- This migration intentionally keeps the climbing-media bucket private.

alter table public.availability add column if not exists expires_at timestamptz;
update public.availability set expires_at = ends_at where expires_at is null;
alter table public.availability alter column expires_at set not null;

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null check (resource_type in ('climb','challenge','crew_invitation')),
  resource_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.session_invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid references public.profiles(id) on delete cascade,
  guest_token_hash text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

alter table public.share_links enable row level security;
alter table public.session_invitations enable row level security;

create or replace function public.is_blocked_between(left_id uuid, right_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = left_id and blocked_id = right_id)
       or (blocker_id = right_id and blocked_id = left_id)
  );
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

drop policy if exists "adult active availability discovery" on public.availability;
create policy "adult active availability discovery" on public.availability for select using (
  ends_at > now() and expires_at > now() and status = 'active'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_adult)
  and not public.is_blocked_between(auth.uid(), owner_id)
);

drop policy if exists "invitation participants" on public.invitations;
create policy "invitation participants read" on public.invitations for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "invitation senders create" on public.invitations for insert
  with check (sender_id = auth.uid() and recipient_id <> auth.uid());
create policy "invitation participants update" on public.invitations for update
  using (sender_id = auth.uid() or recipient_id = auth.uid())
  with check (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "owners manage share links" on public.share_links
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "session invitation participants read" on public.session_invitations
  for select using (inviter_id = auth.uid() or invitee_id = auth.uid());
create policy "session members create invitations" on public.session_invitations
  for insert with check (
    inviter_id = auth.uid() and exists (
      select 1 from public.session_members sm where sm.session_id = session_id and sm.profile_id = auth.uid()
    )
  );
create policy "invitees respond to invitations" on public.session_invitations
  for update using (invitee_id = auth.uid())
  with check (invitee_id = auth.uid());

create or replace function public.protect_session_invitation_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.session_id <> new.session_id or old.inviter_id <> new.inviter_id
     or old.invitee_id is distinct from new.invitee_id or old.guest_token_hash is distinct from new.guest_token_hash then
    raise exception 'Invitation participants and token cannot be changed';
  end if;
  if new.status not in ('accepted','declined','cancelled') then
    raise exception 'Invalid invitation response';
  end if;
  new.responded_at = now();
  return new;
end;
$$;
drop trigger if exists protect_session_invitation_identity on public.session_invitations;
create trigger protect_session_invitation_identity before update on public.session_invitations
for each row execute function public.protect_session_invitation_identity();

create policy "session creators update sessions" on public.sessions
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "session creators insert sessions" on public.sessions
  for insert with check (created_by = auth.uid());
create policy "members read session membership" on public.session_members
  for select using (profile_id = auth.uid() or exists (
    select 1 from public.sessions s where s.id = session_id and s.created_by = auth.uid()
  ));
create policy "session creators manage membership" on public.session_members
  for all using (exists (select 1 from public.sessions s where s.id = session_id and s.created_by = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.created_by = auth.uid()));

create policy "crew owners insert crews" on public.crews
  for insert with check (owner_id = auth.uid());
create policy "crew owners update crews" on public.crews
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "crew owners manage membership" on public.crew_members
  for all using (exists (select 1 from public.crews c where c.id = crew_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.crews c where c.id = crew_id and c.owner_id = auth.uid()));
create policy "members read crew membership" on public.crew_members
  for select using (profile_id = auth.uid() or exists (
    select 1 from public.crews c where c.id = crew_id and c.owner_id = auth.uid()
  ));

create policy "challenge participants read responses" on public.challenge_responses
  for select using (
    author_id = auth.uid() or exists (
      select 1 from public.challenges c where c.id = challenge_id and c.owner_id = auth.uid()
    )
  );
create policy "response authors update responses" on public.challenge_responses
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('climbing-media', 'climbing-media', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do update set public = false;

create policy "owners upload climbing media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'climbing-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "owners read climbing media" on storage.objects
  for select to authenticated using (
    bucket_id = 'climbing-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "owners update climbing media" on storage.objects
  for update to authenticated using (
    bucket_id = 'climbing-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "owners delete climbing media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'climbing-media' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Token resolution must happen in a trusted Edge Function. Never expose token_hash,
-- private object paths, or a service-role key to the browser.
