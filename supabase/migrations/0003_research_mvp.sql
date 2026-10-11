-- Phase 2A: invitation-only route-reading research MVP.
-- Apply after 0001 and 0002. All participant data remains private by default.

alter table public.profiles add column if not exists consented_at timestamptz;
alter table public.profiles add column if not exists experience_level text
  check (experience_level in ('new','recreational','experienced'));
alter table public.profiles add column if not exists primary_style text
  check (primary_style in ('bouldering','top_rope','lead','mixed'));
alter table public.profiles add column if not exists height_cm numeric
  check (height_cm is null or height_cm between 100 and 250);
alter table public.profiles add column if not exists wingspan_cm numeric
  check (wingspan_cm is null or wingspan_cm between 100 and 280);
alter table public.profiles add column if not exists referral_code text;
update public.profiles set referral_code = encode(extensions.gen_random_bytes(12), 'hex') where referral_code is null;
alter table public.profiles alter column referral_code set default encode(extensions.gen_random_bytes(12), 'hex');
alter table public.profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_key on public.profiles(referral_code);

create table if not exists public.research_routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  route_key text not null,
  title text not null check (char_length(title) between 1 and 120),
  grade text,
  color_name text,
  media_path text,
  source_kind text not null default 'builtin' check (source_kind in ('builtin','upload')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, route_key)
);

create table if not exists public.route_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid not null references public.research_routes(id) on delete cascade,
  predicted_beta jsonb not null default '[]'::jsonb,
  actual_beta jsonb not null default '[]'::jsonb,
  hint_level_used integer not null default 0 check (hint_level_used between 0 and 4),
  confidence_before integer not null default 3 check (confidence_before between 1 and 5),
  confidence_after integer not null default 3 check (confidence_after between 1 and 5),
  reflection jsonb not null default '{}'::jsonb,
  media_path text,
  media_kind text check (media_kind is null or media_kind in ('image','video')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, route_id)
);

create table if not exists public.research_referrals (
  invitee_id uuid primary key references public.profiles(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);

create table if not exists public.research_invite_requests (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  email_hash text not null,
  created_at timestamptz not null default now(),
  unique(inviter_id, email_hash)
);

alter table public.research_routes enable row level security;
alter table public.route_attempts enable row level security;
alter table public.research_referrals enable row level security;
alter table public.research_invite_requests enable row level security;

create policy "owners select research routes" on public.research_routes for select
  using (owner_id = auth.uid());
create policy "owners insert research routes" on public.research_routes for insert
  with check (owner_id = auth.uid());
create policy "owners update research routes" on public.research_routes for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete research routes" on public.research_routes for delete
  using (owner_id = auth.uid());

create policy "owners select route attempts" on public.route_attempts for select
  using (owner_id = auth.uid());
create policy "owners insert route attempts" on public.route_attempts for insert
  with check (
    owner_id = auth.uid() and exists (
      select 1 from public.research_routes r where r.id = route_id and r.owner_id = auth.uid()
    )
  );
create policy "owners update route attempts" on public.route_attempts for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid() and exists (
      select 1 from public.research_routes r where r.id = route_id and r.owner_id = auth.uid()
    )
  );
create policy "owners delete route attempts" on public.route_attempts for delete
  using (owner_id = auth.uid());

-- Referral rows are never directly selectable from the browser. Aggregate-only RPCs
-- prevent inviters from learning invitees' account identifiers or contact details.
create or replace function public.claim_research_referral(code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into inviter from public.profiles where referral_code = code;
  if inviter is null or inviter = auth.uid() then return false; end if;
  insert into public.research_referrals(invitee_id, inviter_id)
  values (auth.uid(), inviter) on conflict (invitee_id) do nothing;
  return found;
end;
$$;
revoke all on function public.claim_research_referral(text) from public;
grant execute on function public.claim_research_referral(text) to authenticated;

create or replace function public.my_research_referral_metrics()
returns table(invited bigint, signed_up bigint, completed_workflow bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.research_invite_requests ir where ir.inviter_id = auth.uid())::bigint,
    (select count(*) from public.research_referrals rr where rr.inviter_id = auth.uid())::bigint,
    (select count(*) from public.research_referrals rr
      where rr.inviter_id = auth.uid()
        and exists (
          select 1 from public.route_attempts a
          where a.owner_id = rr.invitee_id
            and jsonb_array_length(a.predicted_beta) > 0
            and jsonb_array_length(a.actual_beta) > 0
            and a.reflection <> '{}'::jsonb
        ))::bigint;
$$;
revoke all on function public.my_research_referral_metrics() from public;
grant execute on function public.my_research_referral_metrics() to authenticated;

create or replace function public.touch_research_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists touch_research_routes on public.research_routes;
create trigger touch_research_routes before update on public.research_routes
for each row execute function public.touch_research_updated_at();
drop trigger if exists touch_route_attempts on public.route_attempts;
create trigger touch_route_attempts before update on public.route_attempts
for each row execute function public.touch_research_updated_at();
